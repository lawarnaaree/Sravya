use chrono::Utc;
use sqlx::{Row, SqlitePool};

use crate::{
    error::Result,
    lan::protocol::{ChangeEntry, PairedDevice},
};

pub async fn append_change(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: &str,
    operation: &str,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO change_log (entity_type, entity_id, operation, occurred_at) \
         VALUES (?1, ?2, ?3, ?4)",
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(operation)
    .bind(Utc::now().to_rfc3339())
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn query_changes_since(pool: &SqlitePool, since: &str) -> Result<Vec<ChangeEntry>> {
    let rows = sqlx::query(
        "SELECT seq, entity_type, entity_id, operation, occurred_at \
         FROM change_log WHERE occurred_at > ?1 ORDER BY seq",
    )
    .bind(since)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .iter()
        .map(|r| ChangeEntry {
            seq: r.get("seq"),
            entity_type: r.get("entity_type"),
            entity_id: r.get("entity_id"),
            operation: r.get("operation"),
            occurred_at: r.get("occurred_at"),
        })
        .collect())
}

// ── Paired devices ─────────────────────────────────────────────────────────

pub async fn list_paired_devices(pool: &SqlitePool) -> Result<Vec<PairedDevice>> {
    let rows = sqlx::query(
        "SELECT id, name, platform, paired_at, last_seen_at \
         FROM paired_devices WHERE revoked_at IS NULL ORDER BY paired_at",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .iter()
        .map(|r| PairedDevice {
            id: r.get("id"),
            name: r.get("name"),
            platform: r.get("platform"),
            paired_at: r.get("paired_at"),
            last_seen_at: r.get("last_seen_at"),
        })
        .collect())
}

pub async fn insert_paired_device(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    platform: &str,
    public_key_b64: &str,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO paired_devices (id, name, platform, public_key_b64, paired_at) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(id)
    .bind(name)
    .bind(platform)
    .bind(public_key_b64)
    .bind(Utc::now().to_rfc3339())
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn revoke_device(pool: &SqlitePool, device_id: &str) -> Result<()> {
    sqlx::query("UPDATE paired_devices SET revoked_at = ?1 WHERE id = ?2")
        .bind(Utc::now().to_rfc3339())
        .bind(device_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_device_pubkey(pool: &SqlitePool, device_id: &str) -> Result<Option<String>> {
    let row = sqlx::query(
        "SELECT public_key_b64 FROM paired_devices WHERE id = ?1 AND revoked_at IS NULL",
    )
    .bind(device_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|r| r.get::<String, _>("public_key_b64")))
}

pub async fn touch_device(pool: &SqlitePool, device_id: &str) -> Result<()> {
    sqlx::query("UPDATE paired_devices SET last_seen_at = ?1 WHERE id = ?2")
        .bind(Utc::now().to_rfc3339())
        .bind(device_id)
        .execute(pool)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn make_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn append_and_query_change_log() {
        let pool = make_pool().await;
        append_change(&pool, "track", "uuid-1", "upsert")
            .await
            .unwrap();
        append_change(&pool, "track", "uuid-2", "upsert")
            .await
            .unwrap();
        let changes = query_changes_since(&pool, "1970-01-01T00:00:00Z")
            .await
            .unwrap();
        assert_eq!(changes.len(), 2);
        assert_eq!(changes[0].entity_id, "uuid-1");
        assert_eq!(changes[1].entity_id, "uuid-2");
    }

    #[tokio::test]
    async fn delta_query_filters_old_entries() {
        let pool = make_pool().await;
        append_change(&pool, "track", "uuid-old", "upsert")
            .await
            .unwrap();
        // Query with a future timestamp — nothing newer should appear
        let changes = query_changes_since(&pool, "2099-01-01T00:00:00Z")
            .await
            .unwrap();
        assert!(changes.is_empty());
    }

    #[tokio::test]
    async fn paired_device_lifecycle() {
        let pool = make_pool().await;
        insert_paired_device(&pool, "dev-1", "iPhone", "ios", "pubkey-b64==")
            .await
            .unwrap();
        let devices = list_paired_devices(&pool).await.unwrap();
        assert_eq!(devices.len(), 1);
        assert_eq!(devices[0].name, "iPhone");

        revoke_device(&pool, "dev-1").await.unwrap();
        let devices_after = list_paired_devices(&pool).await.unwrap();
        assert!(devices_after.is_empty());
    }
}
