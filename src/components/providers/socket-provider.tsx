"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

interface RoomUser {
  socket_id: string;
  username: string;
  role?: string;
  [key: string]: unknown;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({
  children,
  url,
  roomId,
  user,
  enabled = true,
}: {
  children: React.ReactNode;
  url: string;
  roomId: string;
  user: { id: string; name: string; isTeacher: boolean; visitorId?: number };
  enabled?: boolean;
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const userRef = useRef(user);
  const previousUsersRef = useRef<RoomUser[]>([]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!enabled) return;

    const socketInstance = io(url, {
      path: "/socket.io/", // Ensures it hits the LiteSpeed proxy rule
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });

    socketInstance.on("connect", () => {
      console.log("Connected successfully:", socketInstance.id);
    });

    socketInstance.on("connect_error", (err) => {
      console.error("Connection failed:", err.message);
    });

    socketInstance.on("connect", () => {
      console.log("Connected to socket server");
      setIsConnected(true);
      // Move setSocket inside a callback to avoid synchronous setState warning
      setSocket(socketInstance);
      const lastSync = typeof window !== "undefined" ? localStorage.getItem(`board_sync_${roomId}`) : null;
      const lastSyncTimestamp = lastSync ? parseInt(lastSync) : 0;

      socketInstance.emit("join", {
        roomId,
        payload: {
          user: userRef.current,
          lastSyncTimestamp
        },
      });
    });

    socketInstance.on("error", (data: { message: string }) => {
      toast.error(data.message || "An error occurred with the socket connection.");
    });

    socketInstance.on("disconnect", () => {
      console.log("Disconnected from socket server");
      setIsConnected(false);
      previousUsersRef.current = [];
    });

    socketInstance.on("room_users", ({ payload }: { payload: { count: number; users: RoomUser[] } }) => {
      if (payload && payload.users) {
        previousUsersRef.current = payload.users;
      }
    });

    socketInstance.on("user_join", ({ payload }: { payload: { user: { id: string; name: string } } }) => {
      if (userRef.current.isTeacher && payload.user.name && payload.user.id !== userRef.current.id) {
        toast.info(`Student ${payload.user.name} joined the class`, { duration: 3000 });
      }
    });

    socketInstance.on("user_leave", ({ payload }: { payload: { userId: string, name: string } }) => {
      if (userRef.current.isTeacher && payload.name) {
        toast.info(`Student ${payload.name} left the class`, { duration: 3000 });
      }
    });

    return () => {
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [url, roomId, enabled]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
