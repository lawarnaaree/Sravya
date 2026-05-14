// Ed25519 signing + X25519 key-exchange identity.
// Generated on first launch, stored in OS keychain via keyring-rs.
// Stub for Phase 4.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    pub public_key_b64: String,
    pub fingerprint: String,
}
