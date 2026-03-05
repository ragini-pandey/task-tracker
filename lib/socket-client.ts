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
    reconnectionAttempts: 10,
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
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const s = getSocket(token);
    setSocket(s);

    const onConnect = () => setSocket(s);
    const onReconnect = () => setSocket(s);

    s.on("connect", onConnect);
    s.io.on("reconnect", onReconnect);

    return () => {
      s.off("connect", onConnect);
      s.io.off("reconnect", onReconnect);
    };
  }, [token]);

  return socket;
}

export function useProjectPresence(
  token: string | null,
  projectId: string | null,
  userName?: string
) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const socket = useSocket(token);

  useEffect(() => {
    if (!socket || !projectId) return;

    const joinProject = () => {
      socket.emit("join-project", projectId, userName);
    };

    if (socket.connected) {
      joinProject();
    } else {
      socket.on("connect", joinProject);
    }

    const handler = (data: { projectId: string; users: PresenceUser[] }) => {
      if (data.projectId === projectId) {
        setOnlineUsers(data.users);
      }
    };

    socket.on("presence-update", handler);

    return () => {
      socket.off("connect", joinProject);
      socket.off("presence-update", handler);
      if (socket.connected) {
        socket.emit("leave-project", projectId);
      }
    };
  }, [socket, projectId, userName]);

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
  const socket = useSocket(token);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
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
  }, [socket, projectId]);
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
