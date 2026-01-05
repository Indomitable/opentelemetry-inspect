import {Resource} from "./resources.ts";

export interface LogDto {
    timestamp: string;
    time_unix_nano: string;
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
    time_ns: bigint;
    logTimeStamp: Date;
}

export function mapLogDtoToLog(dto: LogDto): Log {
    return {
        ...dto,
        time_ns: BigInt(dto.time_unix_nano),
        logTimeStamp: new Date(dto.timestamp),
    };
}
