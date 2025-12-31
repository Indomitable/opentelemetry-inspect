export interface Resource {
    service_name: string;
    service_version: string;
    service_namespace: string;
    service_instance_id: string;
    attributes: Record<string, string>;
}