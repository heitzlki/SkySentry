'use client';

import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: 'detection' | 'camera_status' | 'system_update';
  data: any;
  timestamp: string;
}

export function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  const connect = () => {
    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
        console.log('WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        console.log('WebSocket disconnected:', event.code, event.reason);

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          console.log(`Attempting to reconnect... (${reconnectAttempts.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else {
          setConnectionError('Max reconnection attempts reached. Please refresh the page.');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Connection error. Please check your network connection.');
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setConnectionError('Failed to create connection. Please try again.');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  };

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Cannot send message.');
    }
  };

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [url]);

  return {
    isConnected,
    lastMessage,
    connectionError,
    sendMessage,
    connect,
    disconnect
  };
}