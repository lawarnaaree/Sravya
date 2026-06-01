use crate::error::AppError;
use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

const WINDOW_SECS: u64 = 30;

pub fn sign(timestamp: u64, method: &str, path: &str, key: &[u8]) -> String {
    let msg = format!("{}:{}:{}", timestamp, method, path);
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC can take any key length");
    mac.update(msg.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

pub fn verify(timestamp: u64, method: &str, path: &str, key: &[u8], signature: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().timestamp() as u64;
    let ts_diff = now.max(timestamp) - now.min(timestamp);

    if ts_diff > WINDOW_SECS {
        return Err(AppError::Crypto("Timestamp expired".into()));
    }

    let expected = sign(timestamp, method, path, key);
    if expected != signature {
        return Err(AppError::Crypto("Invalid signature".into()));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_verify_round_trip() {
        let key = b"test-secret-key";
        let ts = chrono::Utc::now().timestamp() as u64;
        let sig = sign(ts, "GET", "/sync/changes", key);
        assert!(verify(ts, "GET", "/sync/changes", key, &sig).is_ok());
    }

    #[test]
    fn expired_timestamp_rejected() {
        let key = b"test-secret-key";
        let ts = chrono::Utc::now().timestamp() as u64 - WINDOW_SECS - 1;
        let sig = sign(ts, "GET", "/sync/changes", key);
        let result = verify(ts, "GET", "/sync/changes", key, &sig);
        assert!(result.is_err());
    }

    #[test]
    fn wrong_key_rejected() {
        let key = b"correct-key";
        let wrong_key = b"wrong-key";
        let ts = chrono::Utc::now().timestamp() as u64;
        let sig = sign(ts, "GET", "/sync/changes", key);
        let result = verify(ts, "GET", "/sync/changes", wrong_key, &sig);
        assert!(result.is_err());
    }
}
