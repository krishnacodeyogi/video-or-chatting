import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*'},
  transports: ['websocket'],
});

interface UserSocketMap {
  [userId: string]: Set<string>;
}
const userSocketMap: UserSocketMap = {};

io.on('connection', (socket: Socket) => {
  console.log('🔌 New client', socket.id);

  socket.on('auth', ({ userId }: { userId: string }) => {
    if (!userSocketMap[userId]) userSocketMap[userId] = new Set();
    userSocketMap[userId].add(socket.id);
    (socket as any).data.userId = userId;
    broadcastOnlineUsers();
  });

  socket.on('message:send', ({ chatId, content, toUserId }: { chatId: string; content: string; toUserId?: string }) => {
    const from = (socket as any).data.userId;
    const payload = { chatId, content, from, createdAt: Date.now() };
    if (toUserId && userSocketMap[toUserId]) {
      userSocketMap[toUserId].forEach(sid => io.to(sid).emit('message:new', payload));
    } else {
      io.emit('message:new', payload);
    }
  });

  // WebRTC signaling
  socket.on('webrtc:offer', ({ to, offer }) => forwardSignal('webrtc:offer', to, { from: socket.id, offer }));
  socket.on('webrtc:answer', ({ to, answer }) => forwardSignal('webrtc:answer', to, { from: socket.id, answer }));
  socket.on('webrtc:ice-candidate', ({ to, candidate }) => forwardSignal('webrtc:ice-candidate', to, { from: socket.id, candidate }));

  socket.on('disconnect', () => {
    const uid = (socket as any).data.userId as string | undefined;
    if (uid && userSocketMap[uid]) {
      userSocketMap[uid].delete(socket.id);
      if (userSocketMap[uid].size === 0) delete userSocketMap[uid];
      broadcastOnlineUsers();
    }
    console.log('❌ Client left', socket.id);
  });
});

function forwardSignal(event: string, toUserId: string, payload: any) {
  const targets = userSocketMap[toUserId];
  if (!targets) return;
  targets.forEach(sid => io.to(sid).emit(event, payload));
}

function broadcastOnlineUsers() {
  const online = Object.keys(userSocketMap);
  io.emit('users:update', online);
}

app.get('/api/health', (_, res) => res.send({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));
