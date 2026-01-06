import {LogDto} from "../domain/logs.ts";
import {SpanDto} from "../domain/traces.ts";
import {MetricDto} from "../domain/metrics.ts";

export interface MessageHandlers {
    onLogReceived: (log: LogDto) => void;
    onSpanReceived: (span: SpanDto) => void;
    onMetricReceived: (metric: MetricDto) => void;
}

export class WebSocketService {
    private socket: WebSocket | null = null;
    private handlers : MessageHandlers | null = null;
    private pingIntervalId: number | null = null;
    private reconnectTries: number = 0;
    private lastPongTimestamp: number = Date.now();

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname || 'localhost';
        this.socket = new WebSocket(`${protocol}//${host}:4318/ws`);
        this.socket.binaryType = "blob";

        this.socket.addEventListener('message', this.onMessage);
        this.socket.addEventListener('open', this.onOpen);
        this.socket.addEventListener('error', this.onError);
        this.socket.addEventListener('close', this.onClose);
    }

    disconnect() {
        this.stopHeartbeat();
        if (this.handlers) {
            this.handlers = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket.removeEventListener('message', this.onMessage);
            this.socket.removeEventListener('open', this.onOpen);
            this.socket.removeEventListener('error', this.onError);
            this.socket.removeEventListener('close', this.onClose);
            this.socket = null;
        }
    }

    registerHandlers(handlers: MessageHandlers) {
        this.handlers = handlers;
    }

    private onMessage = async (event: MessageEvent) => {
        if (await WebSocketService.isPong(event)) {
            this.lastPongTimestamp = Date.now();
            console.log('Received pong from server');
            return;
        }
        if (typeof event.data !== 'string') {
            return;
        }
        const data = JSON.parse(event.data);
        if (WebSocketService.isConnectedEvent(data)) {
            console.log('Connected with client id:', data.client_id);
            return;
        }

        if (WebSocketService.isLogsEvent(data)) {
            if (this.handlers) {
                this.handlers.onLogReceived(data.payload);
            }
        }

        if (WebSocketService.isTracesEvent(data)) {
            if (this.handlers) {
                this.handlers.onSpanReceived(data.payload);
            }
        }

        if (WebSocketService.isMetricsEvent(data)) {
            if (this.handlers) {
                this.handlers.onMetricReceived(data.payload);
            }
        }
    };

    private onOpen = () => {
        this.reconnectTries = 0; // reset reconnect tries on successful connection
        this.lastPongTimestamp = Date.now();
        this.subscribeToTopic('logs');
        this.subscribeToTopic('traces');
        this.subscribeToTopic('metrics');
        this.startHeartbeat();
    };

    private onClose = () => {
        this.reconnect();
    };

    private onError = () => {
        this.reconnect();
    }

    private subscribeToTopic(topic: string) {
        const command = JSON.stringify({
            command: {
                "Subscribe": topic
            }
        });
        this.socket?.send(command);
    }

    private reconnect() {
        if (this.reconnectTries > 5) {
            return; // give up after 5 tries
        }
        const handlers = this.handlers ? { ...this.handlers } : null;
        this.disconnect();
        // Attempt to reconnect after a delay
        setTimeout(() => {
            this.reconnectTries += 1;
            this.connect();
            if (handlers) {
                this.registerHandlers(handlers);
            }
        }, 1000 * this.reconnectTries);
    }

    private startHeartbeat() {
        this.pingIntervalId = window.setInterval(() => {
            if (Date.now() - this.lastPongTimestamp > 60000) {
                console.warn('No pong received in the last 60 seconds, reconnecting...');
                this.reconnect();
                return;
            }

            this.ping();
        }, 30000); // send ping every 30 seconds
    }

    private stopHeartbeat() {
        if (this.pingIntervalId) {
            clearInterval(this.pingIntervalId);
            this.pingIntervalId = null;
        }
    }

    private ping() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const pingBuffer = new ArrayBuffer(1);
            const pingView = new Uint8Array(pingBuffer);
            pingView[0] = 0x9; // ping opcode
            this.socket.send(pingBuffer);
        }
    }

    private static async isPong(event: MessageEvent): Promise<boolean> {
        if (event.data instanceof Blob) {
            const binaryData = event.data as Blob;
            if (binaryData.size !== 1) {
                return false;
            }
            const b = await binaryData.stream().getReader().read();
            return !!(b.value && b.value.length === 1 && b.value[0] === 0xA); // pong opcode
        }
        return false;
    }

    private static isConnectedEvent(data: any): data is { client_id: string } {
        return 'client_id' in data;
    }

    private static isLogsEvent(data: any): data is Message<LogDto> {
        return 'topic' in data && data.topic === 'logs' && 'payload' in data;
    }

    private static isTracesEvent(data: any): data is Message<SpanDto> {
        return 'topic' in data && data.topic === 'traces' && 'payload' in data;
    }

    private static isMetricsEvent(data: any): data is Message<MetricDto> {
        return 'topic' in data && data.topic === 'metrics' && 'payload' in data;
    }
}

interface Message<TPayload> {
    topic: string;
    payload: TPayload;
}