"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSocket } from "../../hooks/useSocket";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  userId: string;
  userName: string;
  text: string;
  roomId: string;
  timestamp: string;
}

interface UserEvent {
  userId: string;
  userName: string;
  roomId: string;
  timestamp: string;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { socket, isConnected, joinRoom, leaveRoom, sendMessage } = useSocket();

  const [roomId, setRoomId] = useState("general");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInRoom, setIsInRoom] = useState(false);

  // 인증 상태 확인
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/signin");
      return;
    }
  }, [session, status, router]);

  // 소켓 연결 상태에 따른 룸 자동 조인
  useEffect(() => {
    if (isConnected && !isInRoom) {
      joinRoom(roomId);
      setIsInRoom(true);
    }
  }, [isConnected, isInRoom, joinRoom, roomId]);

  // 메시지 수신 처리
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (message: Message) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleUserJoined = (data: UserEvent) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          userId: "system",
          userName: "System",
          text: `${data.userName}님이 입장했습니다.`,
          roomId: data.roomId,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const handleUserLeft = (data: UserEvent) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          userId: "system",
          userName: "System",
          text: `${data.userName}님이 퇴장했습니다.`,
          roomId: data.roomId,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    socket.on("message", handleMessage);
    socket.on("userJoined", handleUserJoined);
    socket.on("userLeft", handleUserLeft);

    return () => {
      socket.off("message", handleMessage);
      socket.off("userJoined", handleUserJoined);
      socket.off("userLeft", handleUserLeft);
    };
  }, [socket]);

  const handleJoinRoom = () => {
    if (isInRoom) {
      leaveRoom(roomId);
      setIsInRoom(false);
    }

    setTimeout(() => {
      joinRoom(roomId);
      setIsInRoom(true);
      setMessages([]);
    }, 100);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !isInRoom) return;

    sendMessage(roomId, message);
    setMessage("");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">로딩 중...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">실시간 채팅</h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              사용자: <span className="font-semibold">{session.user.name}</span>
            </div>
            <div className="text-sm text-gray-600">
              상태:
              <span
                className={`ml-2 px-2 py-1 rounded-full text-xs ${
                  isConnected
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {isConnected ? "연결됨" : "연결 안됨"}
              </span>
            </div>
          </div>
        </div>

        {/* 룸 설정 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="룸 ID"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleJoinRoom}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {isInRoom ? "룸 나가기" : "룸 입장"}
            </button>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            현재 룸: <span className="font-semibold">{roomId}</span>
            {isInRoom && <span className="ml-2 text-green-600">✓ 입장됨</span>}
          </div>
        </div>

        {/* 채팅 영역 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="h-96 overflow-y-auto border border-gray-200 rounded-md p-4 mb-4 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-20">
                메시지가 없습니다. 룸에 입장하고 메시지를 보내보세요!
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`mb-3 ${
                    msg.userId === session.user.id ? "text-right" : "text-left"
                  }`}
                >
                  <div
                    className={`inline-block max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.userId === "system"
                        ? "bg-gray-200 text-gray-700 text-center"
                        : msg.userId === session.user.id
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-800 border border-gray-200"
                    }`}
                  >
                    {msg.userId !== "system" && (
                      <div className="text-xs mb-1 opacity-75">
                        {msg.userName}
                      </div>
                    )}
                    <div>{msg.text}</div>
                    <div className="text-xs mt-1 opacity-75">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 메시지 입력 */}
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              disabled={!isInRoom}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!isInRoom || !message.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              전송
            </button>
          </form>
        </div>

        {/* 연결 정보 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-3">연결 정보</h3>
          <div className="space-y-2 text-sm">
            <div>소켓 ID: {socket?.id || "연결 안됨"}</div>
            <div>연결 상태: {isConnected ? "연결됨" : "연결 안됨"}</div>
            <div>룸 상태: {isInRoom ? "룸에 입장됨" : "룸에 입장 안됨"}</div>
            <div>
              서버: {process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
