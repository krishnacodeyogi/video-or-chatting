import React, { createContext, useContext, useEffect, useRef, PropsWithChildren } from 'react';
import { io, Socket } from 'socket.io-client';

// Socket server URL – you can also place it in a .env file as VITE_SOCKET_URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

type SocketContextType = {
  socket: Socket | null;
};

const SocketContext = createContext<SocketContextType>({ socket: null });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: PropsWithChildren) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Create a singleton WebSocket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    socketRef.current.on('connect', () => {
      console.log('🟢 Socket connected', socketRef.current?.id);
    });
    socketRef.current.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected', reason);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </SocketContext.Provider>
  );
};
