use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Db(#[from] sqlx::Error),

    #[error("migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),

    #[error("audio error: {0}")]
    Audio(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("tag read error: {0}")]
    Tag(String),

    #[error("import refused: {0}")]
    ImportRefused(String),

    #[error("crypto error: {0}")]
    Crypto(String),

    #[error("keychain error: {0}")]
    Keychain(String),

    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("{0}")]
    Other(#[from] anyhow::Error),
}

// Tauri requires commands to return serializable errors.
impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
