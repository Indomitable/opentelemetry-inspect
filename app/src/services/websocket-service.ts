import {Log} from "../domain/logs.ts";

export class WebSocketService {
    private socket: WebSocket | null = null;
    private logsHandler : ((log: Log) => void) | null = null;
    private pingIntervalId: number | null = null;
    private reconnectTries: number = 0;
    private lastPongTimestamp: number = Date.now();

    connect() {
        this.socket = new WebSocket("ws://localhost:4318/ws");
        this.socket.binaryType = "blob";

        this.socket.addEventListener('message', async (event) => {
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
                try {
                    if (this.logsHandler) {
                        this.logsHandler(data.payload);
                    }
                } catch (e) {
                    console.error('Failed to parse log payload', e);
                }
            }
        });

        this.socket.addEventListener('open', () => {
            this.reconnectTries = 0; // reset reconnect tries on successful connection
            this.lastPongTimestamp = Date.now();
            const command = JSON.stringify({
                command: {
                    "Subscribe": "logs"
                }
            });
            this.socket?.send(command);
            this.startHeartbeat();
        });

        this.socket.addEventListener('error', () => {
            this.reconnect();
        });
    }

    disconnect() {
        this.stopHeartbeat();
        if (this.logsHandler) {
            this.logsHandler = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    registerOnLogReceived(handler: (log: Log) => void) {
        this.logsHandler = handler;
    }

    private reconnect() {
        if (this.reconnectTries > 5) {
            return; // give up after 5 tries
        }
        const logsHandler = this.logsHandler; // copy reference
        this.disconnect();
        // Attempt to reconnect after a delay
        setTimeout(() => {
            this.reconnectTries += 1;
            this.connect();
            if (logsHandler) {
                this.registerOnLogReceived(logsHandler);
            }
        }, 1000 * this.reconnectTries);
    }

    private startHeartbeat() {
        this.pingIntervalId = setInterval(() => {
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

    private static isLogsEvent(data: any): data is Message<Log> {
        return 'topic' in data && data.topic === 'logs' && 'payload' in data;
    }
}

interface Message<TPayload> {
    topic: string;
    payload: TPayload;
}