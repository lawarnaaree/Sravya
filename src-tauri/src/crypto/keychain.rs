// keyring-rs wrapper for storing secrets in the OS keychain.
// Stub for Phase 4.

use crate::error::{AppError, Result};

const SERVICE: &str = "com.sravya.app";

#[cfg(not(target_os = "ios"))]
pub fn store(key: &str, value: &str) -> Result<()> {
    keyring::Entry::new(SERVICE, key)
        .map_err(|e| AppError::Keychain(e.to_string()))?
        .set_password(value)
        .map_err(|e| AppError::Keychain(e.to_string()))
}

#[cfg(not(target_os = "ios"))]
pub fn load(key: &str) -> Result<String> {
    keyring::Entry::new(SERVICE, key)
        .map_err(|e| AppError::Keychain(e.to_string()))?
        .get_password()
        .map_err(|e| AppError::Keychain(e.to_string()))
}

#[cfg(not(target_os = "ios"))]
pub fn delete(key: &str) -> Result<()> {
    keyring::Entry::new(SERVICE, key)
        .map_err(|e| AppError::Keychain(e.to_string()))?
        .delete_credential()
        .map_err(|e| AppError::Keychain(e.to_string()))
}

#[cfg(target_os = "ios")]
pub fn store(key: &str, value: &str) -> Result<()> {
    use security_framework::passwords::set_generic_password;
    set_generic_password(SERVICE, key, value.as_bytes())
        .map_err(|e| AppError::Keychain(e.to_string()))
}

#[cfg(target_os = "ios")]
pub fn load(key: &str) -> Result<String> {
    use security_framework::passwords::get_generic_password;
    let pw = get_generic_password(SERVICE, key).map_err(|e| AppError::Keychain(e.to_string()))?;
    String::from_utf8(pw.to_vec()).map_err(|e| AppError::Keychain(e.to_string()))
}

#[cfg(target_os = "ios")]
pub fn delete(key: &str) -> Result<()> {
    use security_framework::passwords::delete_generic_password;
    delete_generic_password(SERVICE, key).map_err(|e| AppError::Keychain(e.to_string()))
}
