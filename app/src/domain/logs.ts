import {Resource} from "./resources.ts";

export interface LogDto {
    timestamp: string;
    severity: string;
    message: string;
    scope: string;
    trace_id?: string;
    span_id?: string;
    event_name?: string;
    resource: Resource;
    tags: Record<string, string>;
}

export interface Log extends LogDto {
    logTimeStamp: Date;
}

export function mapLogDtoToLog(dto: LogDto): Log {
    return {
        ...dto,
        logTimeStamp: new Date(dto.timestamp),
    };
}
