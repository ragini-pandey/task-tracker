import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "@/lib/auth";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";

interface OnlineUser {
  userId: string;
  socketId: string;
  name?: string;
}

// projectId -> Set of online users
const projectPresence = new Map<string, Map<string, OnlineUser>>();

export function getIO(): SocketIOServer | null {
  return (global as Record<string, unknown>).__io as SocketIOServer | null;
}

export function initSocket(httpServer: HTTPServer): SocketIOServer {
  const existing = getIO();
  if (existing) return existing;

  const io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error("Authentication required"));

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      socket.data.userId = decoded.userId;
      socket.data.email = decoded.email;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.data.userId}`);

    socket.on("join-project", (projectId: string, userName?: string) => {
      socket.join(`project:${projectId}`);

      if (!projectPresence.has(projectId)) {
        projectPresence.set(projectId, new Map());
      }

      const presenceMap = projectPresence.get(projectId)!;
      presenceMap.set(socket.data.userId, {
        userId: socket.data.userId,
        socketId: socket.id,
        name: userName,
      });

      // Broadcast updated presence
      io.to(`project:${projectId}`).emit("presence-update", {
        projectId,
        users: Array.from(presenceMap.values()),
      });
    });

    socket.on("leave-project", (projectId: string) => {
      socket.leave(`project:${projectId}`);

      const presenceMap = projectPresence.get(projectId);
      if (presenceMap) {
        presenceMap.delete(socket.data.userId);
        io.to(`project:${projectId}`).emit("presence-update", {
          projectId,
          users: Array.from(presenceMap.values()),
        });
      }
    });

    socket.on("disconnect", () => {
      // Clean up presence from all projects
      for (const [projectId, presenceMap] of projectPresence.entries()) {
        if (presenceMap.has(socket.data.userId)) {
          presenceMap.delete(socket.data.userId);
          io.to(`project:${projectId}`).emit("presence-update", {
            projectId,
            users: Array.from(presenceMap.values()),
          });
        }
      }
    });
  });

  (global as Record<string, unknown>).__io = io;
  return io;
}

// Emit helpers for API routes to call
export function emitTaskCreated(projectId: string, task: unknown) {
  const io = getIO();
  if (io) io.to(`project:${projectId}`).emit("task-created", { projectId, task });
}

export function emitTaskUpdated(projectId: string, task: unknown) {
  const io = getIO();
  if (io) io.to(`project:${projectId}`).emit("task-updated", { projectId, task });
}

export function emitTaskDeleted(projectId: string, taskId: string) {
  const io = getIO();
  if (io) io.to(`project:${projectId}`).emit("task-deleted", { projectId, taskId });
}
