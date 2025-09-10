import { PrismaService } from '../prisma/prisma.service';
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface StreamCallbacks {
    onToken: (token: string) => void;
    onComplete: (fullResponse: string) => void;
    onError: (error: Error) => void;
}
export declare class LlmService {
    private prismaService;
    private readonly anthropic;
    private readonly logger;
    constructor(prismaService: PrismaService);
    generateChatResponse(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<string>;
    prepareMessages(userMessage: string, roomId: string): Promise<ChatMessage[]>;
    private truncateMessages;
    saveMessage(roomId: string, content: string, role: 'user' | 'assistant', userId?: string): Promise<void>;
    private ensureRoomExists;
    private convertToAnthropicFormat;
    private extractSystemMessage;
    getConversationHistory(roomId: string): Promise<ChatMessage[]>;
}
