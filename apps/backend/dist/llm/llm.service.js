"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var LlmService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmService = void 0;
const common_1 = require("@nestjs/common");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const prisma_service_1 = require("../prisma/prisma.service");
let LlmService = LlmService_1 = class LlmService {
    prismaService;
    anthropic;
    logger = new common_1.Logger(LlmService_1.name);
    constructor(prismaService) {
        this.prismaService = prismaService;
        this.anthropic = new sdk_1.default({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }
    async generateChatResponse(messages, callbacks) {
        try {
            this.logger.log('Starting Anthropic chat completion');
            const anthropicMessages = this.convertToAnthropicFormat(messages);
            const systemMessage = this.extractSystemMessage(messages);
            const stream = await this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1000,
                temperature: 0.7,
                system: systemMessage,
                messages: anthropicMessages,
                stream: true,
            });
            let fullResponse = '';
            for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta' &&
                    chunk.delta.type === 'text_delta') {
                    const content = chunk.delta.text || '';
                    if (content) {
                        fullResponse += content;
                        callbacks.onToken(content);
                    }
                }
            }
            this.logger.log(`Anthropic response completed: ${fullResponse.length} characters`);
            callbacks.onComplete(fullResponse);
            return fullResponse;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Anthropic API error: ${errorMessage}`);
            callbacks.onError(error instanceof Error ? error : new Error(errorMessage));
            throw error;
        }
    }
    async prepareMessages(userMessage, roomId) {
        const recentMessages = await this.prismaService.message.findMany({
            where: { roomId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { user: true },
        });
        const sortedMessages = recentMessages.reverse();
        const systemPrompt = {
            role: 'system',
            content: "You are a helpful AI assistant. Provide clear, concise, and helpful responses. If you don't know something, say so honestly.",
        };
        const conversationMessages = sortedMessages.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
        }));
        const currentUserMessage = {
            role: 'user',
            content: userMessage,
        };
        const allMessages = [
            systemPrompt,
            ...conversationMessages,
            currentUserMessage,
        ];
        return this.truncateMessages(allMessages);
    }
    truncateMessages(messages) {
        if (messages.length > 9) {
            return [messages[0], ...messages.slice(-8)];
        }
        return messages;
    }
    async saveMessage(roomId, content, role, userId) {
        try {
            await this.ensureRoomExists(roomId);
            await this.prismaService.message.create({
                data: {
                    content,
                    role,
                    roomId,
                    userId,
                },
            });
            this.logger.log(`Message saved: ${role} message in room ${roomId}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to save message: ${errorMessage}`);
            throw error;
        }
    }
    async ensureRoomExists(roomId) {
        try {
            const existingRoom = await this.prismaService.room.findUnique({
                where: { id: roomId },
            });
            if (!existingRoom) {
                await this.prismaService.room.create({
                    data: {
                        id: roomId,
                        name: roomId,
                    },
                });
                this.logger.log(`Room created: ${roomId}`);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to ensure room exists: ${errorMessage}`);
            throw error;
        }
    }
    convertToAnthropicFormat(messages) {
        return messages
            .filter((msg) => msg.role !== 'system')
            .map((msg) => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content,
        }));
    }
    extractSystemMessage(messages) {
        const systemMessage = messages.find((msg) => msg.role === 'system');
        return (systemMessage?.content ||
            'You are a helpful AI assistant. Please provide clear and concise responses.');
    }
    async getConversationHistory(roomId) {
        const messages = await this.prismaService.message.findMany({
            where: { roomId },
            orderBy: { createdAt: 'asc' },
            include: { user: true },
        });
        return messages.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
        }));
    }
};
exports.LlmService = LlmService;
exports.LlmService = LlmService = LlmService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LlmService);
//# sourceMappingURL=llm.service.js.map