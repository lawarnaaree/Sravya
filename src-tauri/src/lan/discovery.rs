use crate::error::AppError;
use mdns_sd::{ServiceDaemon, ServiceInfo};
use std::collections::HashMap;

const SERVICE_TYPE: &str = "_sravya._tcp.local.";

pub struct MdnsAdvertiser {
    daemon: ServiceDaemon,
    fullname: String,
}

impl MdnsAdvertiser {
    pub fn advertise(port: u16, device_id: &str) -> Result<Self, AppError> {
        let daemon = ServiceDaemon::new()
            .map_err(|e| AppError::Other(e.to_string()))?;

        let hostname = format!("{}.local.", device_id);
        let mut props = HashMap::new();
        props.insert("id".into(), device_id.to_string());
        props.insert("v".into(), "1".to_string());

        let service = ServiceInfo::new(
            SERVICE_TYPE,
            device_id,
            &hostname,
            "",
            port,
            props,
        )
        .map_err(|e| AppError::Other(e.to_string()))?;

        let fullname = service.get_fullname().to_string();
        daemon.register(service)
            .map_err(|e| AppError::Other(e.to_string()))?;

        Ok(Self { daemon, fullname })
    }

    pub fn stop(&self) -> Result<(), AppError> {
        self.daemon.unregister(&self.fullname)
            .map_err(|e| AppError::Other(e.to_string()))?;
        Ok(())
    }
}
