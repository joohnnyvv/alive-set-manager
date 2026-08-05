import { ServerEvent, ClientAction } from '../types.js';
import { logWsTx, logWsRx } from '../utils/logger.js';

export class WsClient {
  private ws?: WebSocket;
  private reconnectInterval = 3000;
  private isConnecting = false;

  constructor(
    private onMessage: (event: ServerEvent) => void,
    private onStatusChange: (status: 'connected' | 'disconnected' | 'connecting') => void
  ) {}

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    this.onStatusChange('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let host = window.location.host;
    if (window.location.port === '5173') {
      host = `${window.location.hostname}:8080`;
    }
    const wsUrl = `${protocol}//${host}/ws`;

    logWsTx(`Connecting to ${wsUrl}...`);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      logWsRx('Connected to server!');
      this.isConnecting = false;
      this.onStatusChange('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as ServerEvent;
        if (parsed.type !== 'playback.tick') {
          logWsRx(`Received event: ${parsed.type}`, parsed);
        }
        this.onMessage(parsed);
      } catch (err) {
        console.error('[WsClient] Error parsing message:', err);
      }
    };

    this.ws.onclose = () => {
      logWsRx('Connection closed. Retrying in 3s...');
      this.isConnecting = false;
      this.onStatusChange('disconnected');
      setTimeout(() => this.connect(), this.reconnectInterval);
    };

    this.ws.onerror = (err) => {
      console.error('[WsClient] Error:', err);
      if (this.ws) {
        this.ws.close();
      }
    };
  }

  public send(action: ClientAction): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logWsTx(`Sending action: ${action.type}`, action);
      this.ws.send(JSON.stringify(action));
    } else {
      console.warn('[WsClient] Cannot send, socket not open:', action);
    }
  }
}
