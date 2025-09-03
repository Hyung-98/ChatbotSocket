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
export interface SocketEvents {
    join: {
        roomId: string;
    };
    leave: {
        roomId: string;
    };
    send: {
        roomId: string;
        text: string;
    };
    message: {
        userId: string;
        text: string;
        timestamp: Date;
    };
    stream: {
        token: string;
    };
}
export declare const generateId: () => string;
export declare const formatTimestamp: (date: Date) => string;
