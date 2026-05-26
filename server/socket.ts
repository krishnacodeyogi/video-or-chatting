import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { log } from "./vite";

// Map to store active userId -> socketId
const userSocketMap = new Map<string, string>();

// Reverse map to store socketId -> userId (for quick lookup on disconnect)
const socketUserMap = new Map<string, string>();

export function setupSocketIO(server: HttpServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    log(`Socket connected: ${socket.id}`, "socket.io");

    // Register user when they join
    socket.on("join", (userId: string) => {
      if (!userId) return;
      
      userSocketMap.set(userId, socket.id);
      socketUserMap.set(socket.id, userId);
      
      log(`User registered: ${userId} -> Socket: ${socket.id}`, "socket.io");
      
      // Broadcast online status
      io.emit("user-online", userId);
    });

    // Relay call request to callee
    socket.on("call-user", (data: { to: string; offer: any; from: string; callerName: string }) => {
      const calleeSocketId = userSocketMap.get(data.to);
      if (calleeSocketId) {
        log(`Relaying call from ${data.from} to ${data.to}`, "socket.io");
        io.to(calleeSocketId).emit("incoming-call", {
          from: data.from,
          offer: data.offer,
          callerName: data.callerName,
        });
      } else {
        log(`Callee ${data.to} not online/found for call`, "socket.io");
        socket.emit("call-failed", { reason: "User is offline" });
      }
    });

    // Relay answer back to caller
    socket.on("answer-call", (data: { to: string; answer: any }) => {
      const callerSocketId = userSocketMap.get(data.to);
      if (callerSocketId) {
        log(`Relaying answer to ${data.to}`, "socket.io");
        io.to(callerSocketId).emit("call-answered", {
          answer: data.answer,
        });
      }
    });

    // Relay ICE Candidates
    socket.on("ice-candidate", (data: { to: string; candidate: any }) => {
      const peerSocketId = userSocketMap.get(data.to);
      if (peerSocketId) {
        io.to(peerSocketId).emit("ice-candidate", {
          candidate: data.candidate,
        });
      }
    });

    // Relay rejection
    socket.on("reject-call", (data: { to: string }) => {
      const callerSocketId = userSocketMap.get(data.to);
      if (callerSocketId) {
        log(`Call rejected by ${socketUserMap.get(socket.id)} to ${data.to}`, "socket.io");
        io.to(callerSocketId).emit("call-rejected");
      }
    });

    // Relay end call
    socket.on("end-call", (data: { to: string }) => {
      const peerSocketId = userSocketMap.get(data.to);
      if (peerSocketId) {
        log(`Call ended between ${socketUserMap.get(socket.id)} and ${data.to}`, "socket.io");
        io.to(peerSocketId).emit("call-ended");
      }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      const userId = socketUserMap.get(socket.id);
      if (userId) {
        userSocketMap.delete(userId);
        socketUserMap.delete(socket.id);
        log(`User disconnected: ${userId} (Socket: ${socket.id})`, "socket.io");
        
        // Broadcast offline status
        io.emit("user-offline", userId);
      }
    });
  });

  return io;
}
