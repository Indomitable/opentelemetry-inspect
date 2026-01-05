export namespace TraceDetailsViewModels {
    export interface SpanOrLogModel {
        trace_id: string;
        parent_span_id?: string;
        name: string;
        type: 'span' | 'log';
        span_id?: string;
        duration: bigint;
        start_ns: bigint;
        end_ns: bigint;
        severity?: string;
    }

    export interface SpanModel extends SpanOrLogModel {
        type: 'span';
        span_id: string;
    }

    export interface LogModel extends SpanOrLogModel {
        type: 'log';
        timestamp: string;
        time_ns: bigint;
        severity: string;
    }
}

