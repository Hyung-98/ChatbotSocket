import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, text: string) => void;
  sendTyping: (roomId: string, isTyping: boolean) => void;
}

export const useSocket = (): UseSocketReturn => {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!session?.accessToken) {
      console.warn("No access token available");
      return;
    }

    if (socketRef.current?.connected) {
      console.log("Socket already connected");
      return;
    }

    try {
      const socket = io(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/chat`,
        {
          auth: {
            token: session.accessToken,
          },
          transports: ["websocket", "polling"],
          autoConnect: true,
        }
      );

      socket.on("connect", () => {
        console.log("Socket connected");
        setIsConnected(true);
      });

      socket.on("disconnect", () => {
        console.log("Socket disconnected");
        setIsConnected(false);
      });

      socket.on("connected", (data) => {
        console.log("Authenticated and connected:", data);
      });

      socket.on("error", (error) => {
        console.error("Socket error:", error);
      });

      socket.on("message", (message) => {
        console.log("Received message:", message);
      });

      socket.on("userJoined", (data) => {
        console.log("User joined:", data);
      });

      socket.on("userLeft", (data) => {
        console.log("User left:", data);
      });

      socket.on("userTyping", (data) => {
        console.log("User typing:", data);
      });

      socketRef.current = socket;
    } catch (error) {
      console.error("Failed to create socket connection:", error);
    }
  }, [session?.accessToken]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("join", { roomId });
    }
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("leave", { roomId });
    }
  }, []);

  const sendMessage = useCallback((roomId: string, text: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("send", { roomId, text });
    }
  }, []);

  const sendTyping = useCallback((roomId: string, isTyping: boolean) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("typing", { roomId, isTyping });
    }
  }, []);

  // 세션이 변경되거나 토큰이 있을 때 자동 연결
  useEffect(() => {
    if (session?.accessToken) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [session?.accessToken, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
  };
};
