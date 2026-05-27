import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';

export const useOnlineUsers = () => {
  const { socket } = useSocket();
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;
    // After auth, tell server we are online – you may send JWT here
    socket.emit('auth', { userId: localStorage.getItem('userId') });

    const handleUpdate = (list: string[]) => setOnlineUsers(list);
    socket.on('users:update', handleUpdate);

    return () => {
      socket.off('users:update', handleUpdate);
    };
  }, [socket]);

  return { onlineUsers };
};
