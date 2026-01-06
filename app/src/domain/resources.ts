export interface ResourceDto {
    service_name: string;
    service_version: string;
    service_namespace: string;
    service_instance_id: string;
    attributes: Record<string, string>;
}

export interface Resource extends ResourceDto {
    key: string;
}

export function mapResource(resource: ResourceDto): Resource {
    const key = `${resource.service_namespace}|${resource.service_name}|${resource.service_version}|${resource.service_instance_id}`;
    return {...resource, key};
}
