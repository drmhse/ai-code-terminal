use act_core::auth::AuthenticatedUser;
use act_persistence::auth_repository::SqlAuthRepository;
use chrono::{DateTime, Duration, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

#[sqlx::test]
async fn test_create_user() {
    let pool = SqlitePool::connect(":memory:").await.unwrap();
    sqlx::migrate!("migrations").run(&pool).await.unwrap();

    let repo = SqlAuthRepository::new(pool);

    let user = repo
        .create_user(
            "github123",
            "testuser",
            Some("test@example.com".to_string()),
            Some("avatar".to_string()),
        )
        .await
        .unwrap();

    assert_eq!(user.username, "testuser");
    assert_eq!(user.email, Some("test@example.com".to_string()));
    assert_eq!(user.avatar_url, Some("avatar".to_string()));
}

#[sqlx::test]
async fn test_update_user() {
    let pool = SqlitePool::connect(":memory:").await.unwrap();
    sqlx::migrate!("migrations").run(&pool).await.unwrap();

    let repo = SqlAuthRepository::new(pool);

    let initial_user = repo
        .create_user("github123", "initial", None, None)
        .await
        .unwrap();

    let updated_user = repo
        .update_user(
            &initial_user.user_id,
            "updated",
            Some("new@email.com".to_string()),
            Some("new_avatar".to_string()),
        )
        .await
        .unwrap();

    assert_eq!(updated_user.username, "updated");
    assert_eq!(updated_user.email, Some("new@email.com".to_string()));
    assert_eq!(updated_user.avatar_url, Some("new_avatar".to_string()));

    // Verify in DB
    let db_user = sqlx::query_as!(
        AuthenticatedUser,
        "SELECT id, username, email, avatar_url FROM users WHERE id = ?",
        updated_user.user_id
    )
    .fetch_one(&repo.pool)
    .await
    .unwrap();

    assert_eq!(db_user.username, "updated");
    assert_eq!(db_user.email, Some("new@email.com".to_string()));
}

#[sqlx::test]
async fn test_store_github_token() {
    let pool = SqlitePool::connect(":memory:").await.unwrap();
    sqlx::migrate!("migrations").run(&pool).await.unwrap();

    let repo = SqlAuthRepository::new(pool);

    let user = repo
        .create_user("github123", "testuser", None, None)
        .await
        .unwrap();

    let expires_at = Utc::now() + Duration::hours(1);

    repo.store_github_token(
        &user.user_id,
        "access_token",
        Some("refresh_token".to_string()),
        expires_at,
    )
    .await
    .unwrap();

    let stored_token = repo.get_github_token(&user.user_id).await.unwrap().unwrap();

    assert_eq!(stored_token, "access_token");

    let stored_refresh = repo
        .get_github_refresh_token(&user.user_id)
        .await
        .unwrap()
        .unwrap();

    assert_eq!(stored_refresh, "refresh_token");

    let settings = sqlx::query_as!(
        UserSettings,
        "SELECT * FROM user_settings WHERE user_id = ?",
        user.user_id
    )
    .fetch_one(&repo.pool)
    .await
    .unwrap();

    assert_eq!(settings.github_token, Some("access_token".to_string()));
    assert_eq!(
        settings.github_refresh_token,
        Some("refresh_token".to_string())
    );
    assert_eq!(settings.github_token_expires_at.unwrap(), expires_at);
}

#[sqlx::test]
async fn test_is_github_authenticated() {
    let pool = SqlitePool::connect(":memory:").await.unwrap();
    sqlx::migrate!("migrations").run(&pool).await.unwrap();

    let repo = SqlAuthRepository::new(pool);

    let user = repo
        .create_user("github123", "testuser", None, None)
        .await
        .unwrap();

    // No token - should be false
    let is_authenticated = repo.is_github_authenticated(&user.user_id).await.unwrap();
    assert!(!is_authenticated);

    // Store token with future expiration
    let expires_at = Utc::now() + Duration::hours(1);
    repo.store_github_token(&user.user_id, "token", None, expires_at)
        .await
        .unwrap();

    let is_authenticated = repo.is_github_authenticated(&user.user_id).await.unwrap();
    assert!(is_authenticated);

    // Store token with past expiration
    let expires_at_past = Utc::now() - Duration::hours(1);
    repo.store_github_token(&user.user_id, "expired_token", None, expires_at_past)
        .await
        .unwrap();

    let is_authenticated = repo.is_github_authenticated(&user.user_id).await.unwrap();
    assert!(!is_authenticated);
}

#[sqlx::test]
async fn test_get_all_users() {
    let pool = SqlitePool::connect(":memory:").await.unwrap();
    sqlx::migrate!("migrations").run(&pool).await.unwrap();

    let repo = SqlAuthRepository::new(pool);

    let user1 = repo
        .create_user("1", "user1", Some("user1@example.com".to_string()), None)
        .await
        .unwrap();
    let user2 = repo
        .create_user("2", "user2", None, Some("avatar2.png".to_string()))
        .await
        .unwrap();

    let users = repo.get_all_users().await.unwrap();

    assert_eq!(users.len(), 2);
    assert!(users
        .iter()
        .any(|u| u.user_id == user1.user_id && u.username == "user1"));
    assert!(users
        .iter()
        .any(|u| u.user_id == user2.user_id && u.username == "user2"));
}
