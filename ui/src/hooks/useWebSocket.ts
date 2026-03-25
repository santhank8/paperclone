import { useEffect, useRef } from 'react';
import { useCompany } from '../context/CompanyContext';
import { WebSocketClient } from '../lib/websocket';

export function useWebSocket(eventHandlers?: { [key: string]: (payload: any) => void }) {
  const { selectedCompany } = useCompany();
  const wsClientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    if (!selectedCompany) return;

    // Create WebSocket client with company ID and a simple token
    // TODO: Replace with real authentication token from auth system
    const token = `company-${selectedCompany.id}`;
    const wsClient = new WebSocketClient(selectedCompany.id, token);
    
    wsClientRef.current = wsClient;
    
    // Connect to WebSocket
    wsClient.connect()
      .catch(error => {
        console.error('WebSocket connection failed:', error);
      });

    // Subscribe to events from the eventHandlers prop
    if (eventHandlers) {
      Object.entries(eventHandlers).forEach(([eventType, handler]) => {
        wsClient.on(eventType, handler);
      });
    }

    // Add default loggers for debugging
    wsClient.on('agent_status', (payload) => {
      console.log('Agent status update:', payload);
    });

    wsClient.on('task_update', (payload) => {
      console.log('Task update:', payload);
    });

    wsClient.on('mission_progress', (payload) => {
      console.log('Mission progress update:', payload);
    });

    wsClient.on('notification', (payload) => {
      console.log('Notification:', payload);
    });

    // Clean up on unmount
    return () => {
      if (wsClientRef.current) {
        Object.keys(eventHandlers || {}).forEach(eventType => {
          const handler = eventHandlers![eventType];
          wsClientRef.current!.off(eventType, handler);
        });
        wsClientRef.current.disconnect();
        wsClientRef.current = null;
      }
    };
  }, [selectedCompany?.id, eventHandlers]);

  return wsClientRef.current;
}