"use client";

import { io, Socket } from "socket.io-client";
import { useEffect, useRef, useState, useCallback } from "react";

let globalSocket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (globalSocket && !globalSocket.disconnected) return globalSocket;

  globalSocket = io(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000", {
    path: "/api/socketio",
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  return globalSocket;
}

export function disconnectSocket() {
  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
  }
}

export interface PresenceUser {
  userId: string;
  socketId: string;
  name?: string;
}

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    socketRef.current = getSocket(token);
    return () => {
      // Don't disconnect on unmount — socket is shared
    };
  }, [token]);

  return socketRef;
}

export function useProjectPresence(
  token: string | null,
  projectId: string | null,
  userName?: string
) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const socketRef = useSocket(token);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !projectId) return;

    socket.emit("join-project", projectId, userName);

    const handler = (data: { projectId: string; users: PresenceUser[] }) => {
      if (data.projectId === projectId) {
        setOnlineUsers(data.users);
      }
    };

    socket.on("presence-update", handler);

    return () => {
      socket.off("presence-update", handler);
      socket.emit("leave-project", projectId);
    };
  }, [socketRef, projectId, userName]);

  return onlineUsers;
}

export function useTaskEvents(
  token: string | null,
  projectId: string | null,
  callbacks: {
    onTaskCreated?: (task: Record<string, unknown>) => void;
    onTaskUpdated?: (task: Record<string, unknown>) => void;
    onTaskDeleted?: (taskId: string) => void;
  }
) {
  const socketRef = useSocket(token);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !projectId) return;

    const onCreated = (data: { projectId: string; task: Record<string, unknown> }) => {
      if (data.projectId === projectId) callbacksRef.current.onTaskCreated?.(data.task);
    };
    const onUpdated = (data: { projectId: string; task: Record<string, unknown> }) => {
      if (data.projectId === projectId) callbacksRef.current.onTaskUpdated?.(data.task);
    };
    const onDeleted = (data: { projectId: string; taskId: string }) => {
      if (data.projectId === projectId) callbacksRef.current.onTaskDeleted?.(data.taskId);
    };

    socket.on("task-created", onCreated);
    socket.on("task-updated", onUpdated);
    socket.on("task-deleted", onDeleted);

    return () => {
      socket.off("task-created", onCreated);
      socket.off("task-updated", onUpdated);
      socket.off("task-deleted", onDeleted);
    };
  }, [socketRef, projectId]);
}

export function useApi() {
  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "API error");
    return data;
  }, []);

  return { apiFetch };
}
