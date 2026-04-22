"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
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
}: {
  children: React.ReactNode;
  url: string;
  roomId: string;
  user: { id: string; name: string; isTeacher: boolean; visitorId?: number };
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
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
    });

    return () => {
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [url, roomId]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
