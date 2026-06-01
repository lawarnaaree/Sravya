pub mod cloud_client;
pub mod uploader;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudSettings {
    pub api_url: String,
    pub api_key: String,
    pub auto_sync: bool,
}

impl Default for CloudSettings {
    fn default() -> Self {
        Self {
            api_url: "https://sravya.api.lawarnaaree.com.np".into(),
            api_key: String::new(),
            auto_sync: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudSyncStatus {
    pub is_configured: bool,
    pub is_syncing: bool,
    pub last_synced_at: Option<String>,
    pub last_pull_at: Option<String>,
}

impl CloudSyncStatus {
    pub fn from_settings(settings: &CloudSettings, last_synced_at: Option<String>, last_pull_at: Option<String>, is_syncing: bool) -> Self {
        Self {
            is_configured: !settings.api_url.is_empty() && !settings.api_key.is_empty(),
            is_syncing,
            last_synced_at,
            last_pull_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cloud_settings_camel_case_json() {
        let s = CloudSettings {
            api_url: "https://sravya.api.lawarnaaree.com.np".into(),
            api_key: "secret".into(),
            auto_sync: true,
        };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("\"apiUrl\""));
        assert!(json.contains("\"apiKey\""));
        assert!(json.contains("\"autoSync\""));
    }

    #[test]
    fn cloud_settings_round_trip() {
        let s = CloudSettings::default();
        let json = serde_json::to_string(&s).unwrap();
        let s2: CloudSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(s.api_url, s2.api_url);
        assert_eq!(s.auto_sync, s2.auto_sync);
    }

    #[test]
    fn auto_sync_default_false() {
        let s = CloudSettings::default();
        assert!(!s.auto_sync);
    }

    #[test]
    fn is_configured_requires_both_fields() {
        let s = CloudSettings::default();
        let status = CloudSyncStatus::from_settings(&s, None, None, false);
        assert!(!status.is_configured);

        let s2 = CloudSettings { api_url: "https://example.com".into(), api_key: "key".into(), auto_sync: false };
        let status2 = CloudSyncStatus::from_settings(&s2, None, None, false);
        assert!(status2.is_configured);
    }
}
