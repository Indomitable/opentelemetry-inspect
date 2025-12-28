import { reactive } from 'vue';

export interface ResourceInfo {
  service_name: string;
  service_version: string;
  service_namespace: string;
}

export interface LogDto {
  timestamp: string;
  log_level: string;
  log_message: string;
  scope: string;
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
