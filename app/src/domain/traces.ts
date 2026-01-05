import {Resource} from "./resources.ts";

export interface SpanDto {
    start_time: string;
    end_time: string;
    scope: string;
    name: string;
    trace_id: string;
    span_id: string;
    parent_span_id?: string;
    resource: Resource;
    kind: string;
    status: {
        message: string;
        code: string;
    };
    tags: Record<string, string>;
    events: Array<{
        name: string;
        timestamp: string;
        attributes: Record<string, string>;
    }>;
    links: Array<{
        trace_id: string;
        span_id: string;
        trace_state: string;
        attributes: Record<string, string>;
    }>;
}

export interface Span extends SpanDto {
    start_ns: bigint;
    end_ns: bigint;
    duration: bigint;
    children: Span[];
}

export function mapSpanDtoToSpan(dto: SpanDto): Span {
    const start_ns = stringToNs(dto.start_time);
    const end_ns = stringToNs(dto.end_time);
    return {
        ...dto,
        start_ns,
        end_ns,
        duration: end_ns - start_ns,
        children: []
    };
}

function stringToNs(isoStr: string): bigint {
    const parts = isoStr.split('.');
    const seconds = BigInt(Date.parse(parts[0]) / 1000);
    // Ensure the nanosecond part is exactly 9 digits
    const nanos = BigInt(parts[1].replace('Z', '').padEnd(9, '0'));
    return (seconds * 1000000000n) + nanos;
}

export function durationToString(durationNs: bigint): string {
    const ms = durationNs / 1000000n;
    const remainingNanos = durationNs % 1000000n;

    if (ms > 0n) {
        return `${ms}ms ${remainingNanos}ns`;
    } else {
        return `${remainingNanos}ns`;
    }
}
