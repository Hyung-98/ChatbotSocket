// 공통 타입 정의
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface Room {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  roomId: string;
  userId?: string;
  role: "user" | "bot";
  content: string;
  createdAt: Date;
}

// 소켓 이벤트 타입
export interface SocketEvents {
  join: { roomId: string };
  leave: { roomId: string };
  send: { roomId: string; text: string };
  message: { userId: string; text: string; timestamp: Date };
  stream: { token: string };
}

// 공통 유틸리티 함수
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const formatTimestamp = (date: Date): string => {
  return date.toISOString();
};
