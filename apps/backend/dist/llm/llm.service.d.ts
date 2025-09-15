import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
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
    private embeddingService;
    private readonly anthropic;
    private readonly logger;
    constructor(prismaService: PrismaService, embeddingService: EmbeddingService);
    generateChatResponse(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<string>;
    prepareMessages(userMessage: string, roomId: string): Promise<ChatMessage[]>;
    private buildSystemPrompt;
    private prepareMessagesFallback;
    private truncateMessages;
    saveMessage(roomId: string, content: string, role: 'user' | 'assistant', userId?: string): Promise<string>;
    private ensureRoomExists;
    private convertToAnthropicFormat;
    private extractSystemMessage;
    getConversationHistory(roomId: string): Promise<ChatMessage[]>;
}
