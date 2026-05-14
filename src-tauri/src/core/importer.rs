use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum LicenseStatus {
    Permitted,
    Refused { reason: String },
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRequest {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum ImportResult {
    Queued { job_id: String },
    Refused { reason: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadJob {
    pub id: String,
    pub url: String,
    pub title: Option<String>,
    pub progress: f32,
    pub state: DownloadState,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum DownloadState {
    Queued,
    Downloading,
    Processing,
    Done,
    Failed { error: String },
}

pub trait Source: Send + Sync {
    fn name(&self) -> &'static str;
    fn matches(&self, url: &Url) -> bool;
    fn license_check(&self, url: &Url) -> LicenseStatus;
}
