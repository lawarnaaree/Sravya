use base64::{engine::general_purpose::STANDARD as B64, Engine};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

pub fn sign_request(method: &str, path: &str, timestamp: u64, key: &[u8]) -> String {
    let msg = format!("{}:{}:{}", method, path, timestamp);
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(msg.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

pub fn verify_request(
    method: &str,
    path: &str,
    timestamp: u64,
    signature: &str,
    key: &[u8],
    window_secs: u64,
) -> bool {
    let now = chrono::Utc::now().timestamp() as u64;
    if now.saturating_sub(timestamp) > window_secs && timestamp.saturating_sub(now) > window_secs {
        return false;
    }
    let msg = format!("{}:{}:{}", method, path, timestamp);
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(msg.as_bytes());
    let sig_bytes = match hex::decode(signature) {
        Ok(b) => b,
        Err(_) => return false,
    };
    mac.verify_slice(&sig_bytes).is_ok()
}

/// Derive the per-device HMAC key from its Ed25519 public key (base64-encoded).
pub fn device_key(public_key_b64: &str) -> Vec<u8> {
    let pk_bytes = B64.decode(public_key_b64).unwrap_or_default();
    Sha256::digest(&pk_bytes).to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_signature() {
        let key = b"test-key-bytes-32-characters-ok!";
        let ts = 1_748_000_000u64;
        let sig = sign_request("GET", "/sync/changes", ts, key);
        assert!(verify_request("GET", "/sync/changes", ts, &sig, key, 30));
    }

    #[test]
    fn wrong_signature_rejected() {
        let key = b"test-key-bytes-32-characters-ok!";
        let ts = 1_748_000_000u64;
        assert!(!verify_request(
            "GET",
            "/sync/changes",
            ts,
            "deadbeef",
            key,
            30
        ));
    }

    #[test]
    fn expired_timestamp_rejected() {
        let key = b"test-key-bytes-32-characters-ok!";
        let ts = 1u64; // ancient timestamp
        let sig = sign_request("GET", "/sync/changes", ts, key);
        // window of 30 seconds — ts=1 is way outside
        assert!(!verify_request("GET", "/sync/changes", ts, &sig, key, 30));
    }
}
