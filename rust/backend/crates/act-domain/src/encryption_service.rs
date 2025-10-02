use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use rand::RngCore;
use thiserror::Error;
use tracing::{debug, error};

#[derive(Debug, Error)]
pub enum EncryptionError {
    #[error("Failed to encrypt data: {0}")]
    EncryptionFailed(String),

    #[error("Failed to decrypt data: {0}")]
    DecryptionFailed(String),

    #[error("Invalid key format: {0}")]
    InvalidKey(String),

    #[error("Invalid encrypted data format")]
    InvalidFormat,

    #[error("Base64 encoding/decoding error: {0}")]
    Base64Error(#[from] base64::DecodeError),
}

/// Service for encrypting and decrypting sensitive tokens using AES-256-GCM
///
/// Uses user_id as Additional Authenticated Data (AAD) to ensure tokens
/// can only be decrypted for the correct user, providing defense in depth.
#[derive(Clone)]
pub struct EncryptionService {
    cipher: Aes256Gcm,
}

impl EncryptionService {
    /// Create a new encryption service with the provided key
    ///
    /// # Arguments
    /// * `key_hex` - 64-character hex string representing 32-byte AES-256 key
    ///
    /// # Example
    /// ```
    /// // Generate key with: openssl rand -hex 32
    /// let key = "a1b2c3d4e5f6..."; // 64 hex chars
    /// let service = EncryptionService::new(key)?;
    /// ```
    pub fn new(key_hex: &str) -> Result<Self, EncryptionError> {
        debug!("Initializing encryption service");

        if key_hex.len() != 64 {
            return Err(EncryptionError::InvalidKey(format!(
                "Key must be 64 hex characters, got {}",
                key_hex.len()
            )));
        }

        let key_bytes = hex::decode(key_hex)
            .map_err(|e| EncryptionError::InvalidKey(format!("Invalid hex: {}", e)))?;

        if key_bytes.len() != 32 {
            return Err(EncryptionError::InvalidKey(
                "Key must be exactly 32 bytes".to_string(),
            ));
        }

        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);

        debug!("Encryption service initialized successfully");
        Ok(Self { cipher })
    }

    /// Encrypt a token with user_id as additional authenticated data
    ///
    /// # Arguments
    /// * `token` - The plaintext token to encrypt
    /// * `user_id` - User ID used as AAD for authentication
    ///
    /// # Returns
    /// Base64-encoded string containing: nonce(12) + ciphertext + tag(16)
    pub fn encrypt_token(&self, token: &str, user_id: &str) -> Result<String, EncryptionError> {
        debug!("Encrypting token for user: {}", user_id);

        // Generate random nonce
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        // Encrypt with user_id as AAD
        let ciphertext = self
            .cipher
            .encrypt(
                &nonce,
                aes_gcm::aead::Payload {
                    msg: token.as_bytes(),
                    aad: user_id.as_bytes(),
                },
            )
            .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

        // Combine nonce + ciphertext for storage
        let mut encrypted_data = Vec::with_capacity(nonce.len() + ciphertext.len());
        encrypted_data.extend_from_slice(&nonce);
        encrypted_data.extend_from_slice(&ciphertext);

        // Encode as base64 for database storage
        let encoded = general_purpose::STANDARD.encode(&encrypted_data);

        debug!("Token encrypted successfully for user: {}", user_id);
        Ok(encoded)
    }

    /// Decrypt a token, validating it belongs to the specified user
    ///
    /// # Arguments
    /// * `encrypted_base64` - Base64-encoded encrypted token from database
    /// * `user_id` - User ID for AAD validation
    ///
    /// # Returns
    /// Original plaintext token
    pub fn decrypt_token(
        &self,
        encrypted_base64: &str,
        user_id: &str,
    ) -> Result<String, EncryptionError> {
        debug!("Decrypting token for user: {}", user_id);

        // Decode from base64
        let encrypted_data = general_purpose::STANDARD.decode(encrypted_base64)?;

        // Validate minimum length (12 byte nonce + 16 byte tag)
        if encrypted_data.len() < 28 {
            return Err(EncryptionError::InvalidFormat);
        }

        // Split nonce and ciphertext
        let (nonce_bytes, ciphertext) = encrypted_data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        // Decrypt with user_id validation
        let plaintext = self
            .cipher
            .decrypt(
                nonce,
                aes_gcm::aead::Payload {
                    msg: ciphertext,
                    aad: user_id.as_bytes(),
                },
            )
            .map_err(|e| {
                error!("Decryption failed for user {}: {}", user_id, e);
                EncryptionError::DecryptionFailed(e.to_string())
            })?;

        let token = String::from_utf8(plaintext)
            .map_err(|e| EncryptionError::DecryptionFailed(format!("Invalid UTF-8: {}", e)))?;

        debug!("Token decrypted successfully for user: {}", user_id);
        Ok(token)
    }

    /// Utility method to generate a new encryption key for initial setup
    ///
    /// # Returns
    /// 64-character hex string suitable for environment variables
    pub fn generate_key() -> String {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        hex::encode(key)
    }
}

/// Trait for dependency injection and testing
#[async_trait::async_trait]
pub trait TokenEncryption: Send + Sync {
    async fn encrypt_token(&self, token: &str, user_id: &str) -> Result<String, EncryptionError>;
    async fn decrypt_token(
        &self,
        encrypted_base64: &str,
        user_id: &str,
    ) -> Result<String, EncryptionError>;
}

#[async_trait::async_trait]
impl TokenEncryption for EncryptionService {
    async fn encrypt_token(&self, token: &str, user_id: &str) -> Result<String, EncryptionError> {
        self.encrypt_token(token, user_id)
    }

    async fn decrypt_token(
        &self,
        encrypted_base64: &str,
        user_id: &str,
    ) -> Result<String, EncryptionError> {
        self.decrypt_token(encrypted_base64, user_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_key() -> String {
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_string()
    }

    #[test]
    fn test_key_generation() {
        let key = EncryptionService::generate_key();
        assert_eq!(key.len(), 64);
        assert!(hex::decode(&key).is_ok());
    }

    #[test]
    fn test_encryption_decryption() -> Result<(), EncryptionError> {
        let service = EncryptionService::new(&test_key())?;
        let token = "test_token_12345";
        let user_id = "user_123";

        let encrypted = service.encrypt_token(token, user_id)?;
        let decrypted = service.decrypt_token(&encrypted, user_id)?;

        assert_eq!(token, decrypted);
        Ok(())
    }

    #[test]
    fn test_user_id_validation() -> Result<(), EncryptionError> {
        let service = EncryptionService::new(&test_key())?;
        let token = "test_token_12345";
        let user_id = "user_123";
        let wrong_user = "user_456";

        let encrypted = service.encrypt_token(token, user_id)?;

        // Should fail with wrong user_id
        let result = service.decrypt_token(&encrypted, wrong_user);
        assert!(result.is_err());

        // Should succeed with correct user_id
        let decrypted = service.decrypt_token(&encrypted, user_id)?;
        assert_eq!(token, decrypted);

        Ok(())
    }

    #[test]
    fn test_invalid_key() {
        // Too short
        assert!(EncryptionService::new("abc").is_err());

        // Invalid hex
        assert!(EncryptionService::new(
            "gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg"
        )
        .is_err());
    }

    #[test]
    fn test_invalid_encrypted_data() -> Result<(), EncryptionError> {
        let service = EncryptionService::new(&test_key())?;

        // Invalid base64
        assert!(service
            .decrypt_token("invalid base64!", "user_123")
            .is_err());

        // Too short data
        let short_data = general_purpose::STANDARD.encode(&[1, 2, 3]);
        assert!(service.decrypt_token(&short_data, "user_123").is_err());

        Ok(())
    }
}
