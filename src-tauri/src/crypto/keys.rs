use crate::error::AppError;
use ed25519_dalek::{SigningKey, VerifyingKey};
use rand::rngs::OsRng;

pub struct KeyPair {
    pub signing_key: SigningKey,
    pub verifying_key: VerifyingKey,
}

pub fn generate_keypair() -> KeyPair {
    let signing_key = SigningKey::generate(&mut OsRng);
    let verifying_key = signing_key.verifying_key();
    KeyPair { signing_key, verifying_key }
}

pub fn public_key_b64(pair: &KeyPair) -> String {
    base64::encode(pair.verifying_key.as_bytes())
}

#[cfg(not(target_os = "ios"))]
pub fn store_key(service: &str, name: &str, value: &str) -> Result<(), AppError> {
    let entry = keyring::Entry::new(service, name)
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    entry.set_password(value)
        .map_err(|e| AppError::Keychain(e.to_string()))
}

#[cfg(not(target_os = "ios"))]
pub fn load_key(service: &str, name: &str) -> Result<Option<String>, AppError> {
    let entry = keyring::Entry::new(service, name)
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Keychain(e.to_string())),
    }
}
