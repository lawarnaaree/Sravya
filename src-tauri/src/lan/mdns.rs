use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use std::time::Duration;

use crate::lan::protocol::DiscoveredServer;

pub fn advertise(port: u16, server_name: &str) -> anyhow::Result<ServiceDaemon> {
    let mdns = ServiceDaemon::new()?;
    let service = ServiceInfo::new(
        "_sravya._tcp.local.",
        server_name,
        "", // host — empty = auto-detect local hostname
        "", // ip   — empty = auto-detect
        port,
        None,
    )?;
    mdns.register(service)?;
    Ok(mdns)
}

/// Browse the local network for Sravya desktop instances.
/// Blocks the calling thread for `timeout_secs` seconds then returns results.
pub async fn browse_for_servers(timeout_secs: u64) -> Vec<DiscoveredServer> {
    tokio::task::spawn_blocking(move || {
        let mdns = match ServiceDaemon::new() {
            Ok(d) => d,
            Err(e) => {
                tracing::warn!("mDNS daemon init failed: {e}");
                return vec![];
            }
        };
        let receiver = match mdns.browse("_sravya._tcp.local.") {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("mDNS browse failed: {e}");
                return vec![];
            }
        };

        let mut results = Vec::new();
        let deadline = std::time::Instant::now() + Duration::from_secs(timeout_secs);

        while std::time::Instant::now() < deadline {
            match receiver.recv_timeout(Duration::from_millis(100)) {
                Ok(ServiceEvent::ServiceResolved(info)) => {
                    let port = info.get_port();
                    // Prefer the first IPv4 address for the URL.
                    let ip = info
                        .get_addresses_v4()
                        .iter()
                        .next()
                        .map(|a| a.to_string())
                        .unwrap_or_else(|| info.get_hostname().trim_end_matches('.').to_string());
                    results.push(DiscoveredServer {
                        name: info.get_fullname().to_string(),
                        host: ip.clone(),
                        port,
                        address: format!("http://{}:{}", ip, port),
                    });
                }
                Ok(_) => {}
                Err(_) => {}
            }
        }

        let _ = mdns.shutdown();
        results
    })
    .await
    .unwrap_or_default()
}
