# Completeness Checklist

> **CRITICAL NOTE:** This document is the single source of truth for project completion. It must be kept concise and up-to-date. Developers **must** reference this checklist before starting a task and update it immediately upon completion by checking the box (`- [x]`). There are no stories here—only actionable items.

---

## 1. Core Backend & Security (Foundation Hardening)

-   [ ] **Enforce Authentication on All WebSocket Events**
    -   **Decision:** Modify the `get_authenticated_user_id` helper in `socket_handlers.rs` to return a `Result`. Every sensitive event handler must call this function first and emit an error to the client if it fails. This closes a critical multi-user security gap.

-   [ ] **Implement Strict Server Configuration Validation**
    -   **Decision:** The server must fail fast on startup if critical environment variables (`ACT_AUTH_JWT_SECRET`, `ACT_AUTH_GITHUB_CLIENT_ID`, etc.) are missing or invalid. Enable the `config.validate()` check in `act-server/src/main.rs`.

-   [ ] **Implement CSRF Protection for All State-Changing API Endpoints**
    -   **Decision:** Use a standard, middleware-based double-submit cookie pattern (`axum-csrf` or similar). This is a standard security measure for web applications. The `csrf_tokens` database table will be removed as it is made redundant by this approach.

-   [ ] **Ensure User ID Consistency Across All Data Layers**
    -   **Decision:** The `user_id` field is the cornerstone of multi-user isolation. It must be added to all relevant server-layer models (`Workspace`, `Session` in `act-server/src/models.rs`) and their corresponding `_from_domain` conversion functions to prevent data leakage and deserialization errors.

---

## 2. Feature Integration & User Experience

### Authentication & User Preferences

-   [ ] **Implement Persistent User Theme Preferences**
    -   **Decision:** Consolidate theme storage into the `user_settings` table (removing the redundant `user_theme_preferences` table). Create `GET` and `POST` API endpoints in a new `themes.rs` route file to allow the frontend to save and retrieve the user's chosen theme.

### Terminal & Layouts

-   [ ] **Integrate Persistent Layouts**
    -   [ ] **Auto-load:** When a user switches workspaces, the app must automatically fetch and apply the default layout for that workspace.
    -   [ ] **Apply Layout:** The `layoutStore` needs an `applyLayout` action that directs the `terminalStore` to clear existing panes and reconstruct the UI according to the loaded layout's configuration.

-   [ ] **Implement Persistent Terminal Command History**
    -   **Decision:** Create a new WebSocket event (`terminal:command`). The frontend will emit this event with the command string upon execution. The backend will have a corresponding handler that calls a new `SessionService` method to persist the command to the `shell_history` field in the database.

### Background Processes

-   [ ] **Connect Background Tasks UI to Backend**
    -   [ ] **Verification:** Ensure the `<BackgroundTasks />` component is correctly rendered in the `Dashboard.vue` layout for non-mobile views.
    -   [ ] **Implement "View Output":** Wire the "View Output" button to an action in `processStore` that calls the `GET /api/v1/processes/:id/output` endpoint and displays the result in a modal.

-   [ ] **Implement Background Process Monitoring & Auto-Restart**
    -   **Decision:** In the `ProcessService::create_process` method, after a process is successfully started, a `tokio::spawn` task must be launched. This task will periodically check if the process is still running and trigger the auto-restart logic if it has crashed and is configured to do so.

### UI/UX Polish

-   [ ] **Standardize Frontend Error Handling**
    -   **Decision:** All `try...catch` blocks in frontend stores (`stores/*.ts`) that perform API calls must use the `uiStore.addResourceAlert` action in the `catch` block. This ensures users receive immediate and consistent visual feedback for all errors.

-   [ ] **Refine Mobile User Experience**
    -   [ ] **Slide-Out Sidebar:** Implement CSS transitions on the `Sidebar.vue` component, triggered by the `uiStore.sidebarOpen` state, to make it slide in from the left on mobile.
    -   [ ] **Full-Screen Modals:** Add media queries to all modal components to make them full-screen on mobile devices, improving usability.

---

## 3. Administration & Tooling

-   [ ] **Connect `act-cli` to the Real Database**
    -   **Decision:** Refactor `act-cli/src/main.rs` to stop using a mock repository. It should load the `.env` configuration, establish a real `Database` connection, and instantiate the `SqlWorkspaceRepository` to become a functional administrative tool.

---

## 4. Testing & Documentation

-   [ ] **Add Backend Integration Tests for Multi-User Isolation**
    -   **Decision:** The highest priority test is to verify multi-user security. Create a new test file in `act-server/tests/` that simulates two different users creating and listing resources, asserting that User A cannot see or access User B's data.

-   [ ] **Update All Project & Crate-Level Documentation**
    -   [ ] Update `rust/backend/README.md` to reflect the hexagonal architecture and new project structure.
    -   [ ] Update `rust/backend/crates/act-domain/README.md` to document the `LayoutService` and `ProcessService`.
    -   [ ] Update `rust/backend/crates/act-persistence/README.md` to document the new repository implementations.
