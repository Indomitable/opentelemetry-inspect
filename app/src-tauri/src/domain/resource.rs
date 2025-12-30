use std::collections::HashMap;
use serde::Serialize;
use crate::opentelemetry::proto::resource::v1::Resource;

#[derive(Serialize, Clone, Debug)]
pub struct ResourceInfo {
    pub service_name: String,
    pub service_version: String,
    pub service_namespace: String,
    pub service_instance_id: String,
    pub attributes: HashMap<String, String>,
}

impl Default for ResourceInfo {
    fn default() -> Self {
        ResourceInfo {
            service_name: "unknown_service".to_string(),
            service_version: "unknown".to_string(),
            service_namespace: "unknown".to_string(),
            service_instance_id: "unknown".to_string(),
            attributes: HashMap::new(),
        }
    }
}

impl From<&Resource> for ResourceInfo {
    fn from(value: &Resource) -> Self {
        let mut resource_info = ResourceInfo::default();
        
        for attr in &value.attributes {
            match attr.key.as_str() {
                "service.name" => resource_info.service_name = crate::domain::any_value_to_string(attr.value.clone().unwrap_or_default()),
                "service.version" => resource_info.service_version = crate::domain::any_value_to_string(attr.value.clone().unwrap_or_default()),
                "service.namespace" => resource_info.service_namespace = crate::domain::any_value_to_string(attr.value.clone().unwrap_or_default()),
                "service.instance.id" => resource_info.service_instance_id = crate::domain::any_value_to_string(attr.value.clone().unwrap_or_default()),
                _ => {
                    resource_info.attributes.insert(attr.key.clone(), crate::domain::any_value_to_string(attr.value.clone().unwrap_or_default()));
                }
            }
        }
        resource_info
    }
}