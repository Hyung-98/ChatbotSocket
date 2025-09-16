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
const embedding_service_1 = require("../embedding/embedding.service");
let LlmService = LlmService_1 = class LlmService {
    prismaService;
    embeddingService;
    anthropic;
    logger = new common_1.Logger(LlmService_1.name);
    constructor(prismaService, embeddingService) {
        this.prismaService = prismaService;
        this.embeddingService = embeddingService;
        if (!process.env.ANTHROPIC_API_KEY) {
            this.logger.error('ANTHROPIC_API_KEY is not set in environment variables');
            throw new Error('AI service is not properly configured. Please check API key settings.');
        }
        this.anthropic = new sdk_1.default({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }
    async generateChatResponse(messages, callbacks) {
        try {
            this.logger.log('Starting Anthropic chat completion');
            if (!process.env.ANTHROPIC_API_KEY) {
                throw new Error('AI service is not properly configured. Please check API key settings.');
            }
            const anthropicMessages = this.convertToAnthropicFormat(messages);
            const systemMessage = this.extractSystemMessage(messages);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('AI service request timed out. Please try again.'));
                }, 30000);
            });
            const apiPromise = this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1000,
                temperature: 0.7,
                system: systemMessage,
                messages: anthropicMessages,
                stream: true,
            });
            const stream = await Promise.race([apiPromise, timeoutPromise]);
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
            let errorMessage = 'AI 응답 생성 중 오류가 발생했습니다.';
            if (error instanceof Error) {
                try {
                    const errorData = JSON.parse(error.message);
                    if (errorData.type === 'error' && errorData.error) {
                        const apiError = errorData.error;
                        if (apiError.type === 'authentication_error') {
                            errorMessage =
                                'AI 서비스 인증에 실패했습니다. API 키를 확인해주세요.';
                        }
                        else if (apiError.type === 'rate_limit_error') {
                            errorMessage =
                                'AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.';
                        }
                        else if (apiError.type === 'api_error') {
                            errorMessage = `AI 서비스 오류: ${apiError.message || '알 수 없는 오류'}`;
                        }
                        else {
                            errorMessage = `AI 서비스 오류: ${apiError.message || error.message}`;
                        }
                    }
                    else {
                        errorMessage = `AI 응답 생성 중 오류가 발생했습니다: ${error.message}`;
                    }
                }
                catch {
                    if (error.message.includes('API key') ||
                        error.message.includes('authentication')) {
                        errorMessage =
                            'AI 서비스가 올바르게 설정되지 않았습니다. 관리자에게 문의하세요.';
                    }
                    else if (error.message.includes('timed out')) {
                        errorMessage = 'AI 응답이 시간 초과되었습니다. 다시 시도해주세요.';
                    }
                    else if (error.message.includes('rate limit')) {
                        errorMessage =
                            'AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.';
                    }
                    else if (error.message.includes('network') ||
                        error.message.includes('connection')) {
                        errorMessage =
                            '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.';
                    }
                    else {
                        errorMessage = `AI 응답 생성 중 오류가 발생했습니다: ${error.message}`;
                    }
                }
            }
            this.logger.error(`Anthropic API error: ${errorMessage}`, error);
            callbacks.onError(new Error(errorMessage));
            throw new Error(errorMessage);
        }
    }
    async prepareMessages(userMessage, roomId) {
        try {
            const similarMessages = await this.embeddingService.findSimilarMessages(userMessage, roomId, 5);
            const recentMessages = await this.prismaService.message.findMany({
                where: { roomId },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: { user: true },
            });
            const sortedRecentMessages = recentMessages.reverse();
            const systemPrompt = {
                role: 'system',
                content: this.buildSystemPrompt(similarMessages),
            };
            const contextMessages = similarMessages.map((msg) => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: `[Relevant context] ${msg.content}`,
            }));
            const conversationMessages = sortedRecentMessages.map((msg) => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content,
            }));
            const currentUserMessage = {
                role: 'user',
                content: userMessage,
            };
            const allMessages = [
                systemPrompt,
                ...contextMessages,
                ...conversationMessages,
                currentUserMessage,
            ];
            return this.truncateMessages(allMessages);
        }
        catch (error) {
            this.logger.error(`Failed to prepare messages with RAG: ${error.message}`);
            return this.prepareMessagesFallback(userMessage, roomId);
        }
    }
    buildSystemPrompt(similarMessages) {
        let systemPrompt = "You are a helpful AI assistant. Provide clear, concise, and helpful responses. If you don't know something, say so honestly.";
        if (similarMessages.length > 0) {
            systemPrompt +=
                '\n\nBased on the conversation history, you have access to relevant context from previous discussions. Use this context to provide more informed and relevant responses.';
        }
        return systemPrompt;
    }
    async prepareMessagesFallback(userMessage, roomId) {
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
            const message = await this.prismaService.message.create({
                data: {
                    content,
                    role,
                    roomId,
                    userId,
                },
            });
            this.logger.log(`Message saved: ${role} message in room ${roomId}`);
            return message.id;
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
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        embedding_service_1.EmbeddingService])
], LlmService);
//# sourceMappingURL=llm.service.js.map