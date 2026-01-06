import {mapResource, Resource, ResourceDto} from "./resources.ts";

export interface SpanDto {
    start_time: string;
    end_time: string;
    start_time_unix_nano: string;
    end_time_unix_nano: string;
    scope: string;
    name: string;
    trace_id: string;
    span_id: string;
    parent_span_id?: string;
    resource: ResourceDto;
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
    resource: Resource;
}

export function mapSpanDtoToSpan(dto: SpanDto): Span {
    const start_ns = BigInt(dto.start_time_unix_nano);
    const end_ns = BigInt(dto.end_time_unix_nano);
    return {
        ...dto,
        start_ns,
        end_ns,
        duration: end_ns - start_ns,
        children: [],
        resource: mapResource(dto.resource),
    };
}

export function durationToString(durationNs: bigint): string {
    if (durationNs === 0n) {
        return '';
    }
    const nanosInMs = 1_000_000n;
    const ms = durationNs / nanosInMs;
    const remainingNanos = durationNs % nanosInMs;

    const nanoFormat: BigIntToLocaleStringOptions = {
        unit: 'nanosecond',
        style: 'unit',
        unitDisplay: 'short',
        useGrouping: true
    };
    const milliFormat = { ...nanoFormat, unit: 'millisecond' };

    if (ms > 0n) {
        return `${ms.toLocaleString(void 0, milliFormat)} ${remainingNanos.toLocaleString(void 0, nanoFormat)}`;
    } else {
        return remainingNanos.toLocaleString(void 0, nanoFormat);
    }
}
