import { reactive } from 'vue';

export interface ResourceInfo {
  service_name: string;
  service_version: string;
  service_namespace: string;
  service_instance_id: string;
  attributes: Record<string, string>;
}

export interface LogDto {
  timestamp: string;
  severity: string;
  message: string;
  scope: string;
  trace_id?: string;
  span_id?: string;
  event_name?: string;
  resource: ResourceInfo;
  tags: Record<string, string>;
}

export const state = reactive({
  logs: [] as LogDto[],
  get totalLogs() {
    return this.logs.length;
  }
});

export function addLog(log: LogDto) {
  state.logs.push(log);
}
