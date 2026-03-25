export interface WSMessage {
  type: 'agent_status' | 'task_update' | 'mission_progress' | 'notification';
  payload: any;
  companyId?: string;
  timestamp: string;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Array<(payload: any) => void>> = new Map();
  private eventQueue: WSMessage[] = []; // Queue messages when not connected

  constructor(companyId: string, token: string) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}/ws?companyId=${companyId}&token=${token}`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Close any existing connection
        if (this.ws) {
          this.ws.close();
        }

        console.log(`Attempting to connect to WebSocket: ${this.url}`);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          
          // Send queued messages
          while (this.eventQueue.length > 0) {
            const message = this.eventQueue.shift();
            if (message && this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify(message));
            }
          }
          
          this.reconnectAttempts = 0;
          resolve(); // Resolve promise when successfully connected
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            // Emit the received event to all listeners
            this.emit(message.type, message.payload);
          } catch (e) {
            console.error('WebSocket message parsing error:', e);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          if (event.code !== 1000) { // Normal closure
            console.log('Attempting to reconnect...');
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error); // Reject promise on error
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
        this.attemptReconnect();
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000); // Exponential backoff capped at 10s
    
    console.log(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    setTimeout(() => {
      this.connect().catch(err => {
        console.error('Reconnection failed:', err);
      });
    }, delay);
  }

  on(event: string, callback: (payload: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (payload: any) => void) {
    if (this.listeners.has(event)) {
      const listeners = this.listeners.get(event)!;
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, payload: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => {
        try {
          callback(payload);
        } catch (e) {
          console.error(`Error in WebSocket listener for event ${event}:`, e);
        }
      });
    }
  }

  send(message: WSMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, queuing message:', message);
      // Queue the message to send when connection is established
      this.eventQueue.push(message);
    }
  }

  disconnect() {
    console.log('Disconnecting WebSocket');
    if (this.ws) {
      this.ws.close(1000, 'User disconnected'); // 1000 = normal closure
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getConnectionStatus(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }
}