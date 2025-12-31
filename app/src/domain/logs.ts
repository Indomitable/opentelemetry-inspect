import {Resource} from "./resources.ts";

export interface Log {
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
