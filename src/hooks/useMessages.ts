import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import type { Message } from '../types';

export const useMessages = (chatId: string) => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!socket) return;
    // optional: fetch history via REST once
    // socket.emit('joinChat', chatId);

    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    };
    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [socket, chatId]);

  const sendMessage = (content: string, toUserId?: string) => {
    if (!socket) return;
    socket.emit('message:send', { chatId, content, toUserId });
  };

  return { messages, sendMessage };
};
