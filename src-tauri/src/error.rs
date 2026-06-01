use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[error("Database error: {0}")]
    Db(String),
    #[error("Migration error: {0}")]
    Migration(String),
    #[error("Audio error: {0}")]
    Audio(String),
    #[error("IO error: {0}")]
    Io(String),
    #[error("Tag error: {0}")]
    Tag(String),
    #[error("Import refused: {0}")]
    ImportRefused(String),
    #[error("Crypto error: {0}")]
    Crypto(String),
    #[error("Keychain error: {0}")]
    Keychain(String),
    #[error("HTTP error: {0}")]
    Http(String),
    #[error("{0}")]
    Other(String),
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::Db(e.to_string())
    }
}

impl From<sqlx::migrate::MigrateError> for AppError {
    fn from(e: sqlx::migrate::MigrateError) -> Self {
        AppError::Migration(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Http(e.to_string())
    }
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError::Other(e.to_string())
    }
}
