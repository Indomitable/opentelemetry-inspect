import {mapResource, Resource, ResourceDto} from "./resources.ts";

export interface LogDto {
    timestamp: string;
    time_unix_nano: string;
    severity: string;
    message: string;
    scope: string;
    trace_id?: string;
    span_id?: string;
    event_name?: string;
    resource: ResourceDto;
    tags: Record<string, string>;
}

export interface Log extends LogDto {
    resource: Resource;
    time_ns: bigint;
    logTimeStamp: Date;
}

export function mapLogDtoToLog(dto: LogDto): Log {
    return {
        ...dto,
        resource: mapResource(dto.resource),
        time_ns: BigInt(dto.time_unix_nano),
        logTimeStamp: new Date(dto.timestamp),
    };
}
