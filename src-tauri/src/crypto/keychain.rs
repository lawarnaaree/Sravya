// keyring-rs wrapper for storing secrets in the OS keychain.
// Stub for Phase 4.

use crate::error::{AppError, Result};

const SERVICE: &str = "com.sravya.app";

pub fn store(key: &str, value: &str) -> Result<()> {
    keyring::Entry::new(SERVICE, key)
        .map_err(|e| AppError::Keychain(e.to_string()))?
        .set_password(value)
        .map_err(|e| AppError::Keychain(e.to_string()))
}

pub fn load(key: &str) -> Result<String> {
    keyring::Entry::new(SERVICE, key)
        .map_err(|e| AppError::Keychain(e.to_string()))?
        .get_password()
        .map_err(|e| AppError::Keychain(e.to_string()))
}

pub fn delete(key: &str) -> Result<()> {
    keyring::Entry::new(SERVICE, key)
        .map_err(|e| AppError::Keychain(e.to_string()))?
        .delete_credential()
        .map_err(|e| AppError::Keychain(e.to_string()))
}
