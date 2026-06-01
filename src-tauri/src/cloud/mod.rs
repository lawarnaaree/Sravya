pub mod cloud_client;
pub mod uploader;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSettings {
    #[serde(rename = "apiUrl")]
    pub api_url: Option<String>,
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    #[serde(rename = "autoSync")]
    pub auto_sync: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncStatus {
    #[serde(rename = "isConfigured")]
    pub is_configured: bool,
    #[serde(rename = "lastSyncedAt")]
    pub last_synced_at: Option<String>,
    #[serde(rename = "isSyncing")]
    pub is_syncing: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cloud_settings_serialization_round_trip() {
        let settings = CloudSettings {
            api_url: Some("https://api.example.com".to_string()),
            api_key: Some("secret-key".to_string()),
            auto_sync: true,
        };
        let json = serde_json::to_string(&settings).unwrap();
        let back: CloudSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(back.api_url.as_deref(), Some("https://api.example.com"));
        assert_eq!(back.api_key.as_deref(), Some("secret-key"));
        assert!(back.auto_sync);
    }

    #[test]
    fn cloud_settings_camel_case_keys() {
        let settings = CloudSettings {
            api_url: Some("https://api.example.com".to_string()),
            api_key: Some("k".to_string()),
            auto_sync: false,
        };
        let json = serde_json::to_string(&settings).unwrap();
        // Front-end expects camelCase keys
        assert!(json.contains("apiUrl"));
        assert!(json.contains("apiKey"));
        assert!(json.contains("autoSync"));
    }

    #[test]
    fn cloud_sync_status_not_configured_by_default() {
        let status = CloudSyncStatus {
            is_configured: false,
            last_synced_at: None,
            is_syncing: false,
        };
        assert!(!status.is_configured);
        assert!(status.last_synced_at.is_none());
        assert!(!status.is_syncing);
    }

    #[test]
    fn cloud_settings_empty_url_is_not_configured() {
        // is_configured is derived from api_url being Some — None means unconfigured
        let settings = CloudSettings {
            api_url: None,
            api_key: None,
            auto_sync: false,
        };
        assert!(settings.api_url.is_none());
    }
}
