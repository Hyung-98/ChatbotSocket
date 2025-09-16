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
var EmbeddingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
const openai_1 = __importDefault(require("openai"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
let EmbeddingService = EmbeddingService_1 = class EmbeddingService {
    configService;
    prismaService;
    redisService;
    openai;
    anthropic;
    logger = new common_1.Logger(EmbeddingService_1.name);
    useAnthropic = false;
    constructor(configService, prismaService, redisService) {
        this.configService = configService;
        this.prismaService = prismaService;
        this.redisService = redisService;
        const openaiKey = this.configService.get('OPENAI_API_KEY');
        const anthropicKey = this.configService.get('ANTHROPIC_API_KEY');
        this.useAnthropic = !openaiKey || openaiKey.includes('sk-proj-');
        if (this.useAnthropic &&
            anthropicKey &&
            !anthropicKey.includes('sk-ant-')) {
            this.anthropic = new sdk_1.default({
                apiKey: anthropicKey,
            });
            this.logger.log('Using Anthropic for embeddings');
        }
        else if (openaiKey && !openaiKey.includes('sk-proj-')) {
            this.openai = new openai_1.default({
                apiKey: openaiKey,
            });
            this.logger.log('Using OpenAI for embeddings');
        }
        else {
            this.logger.warn('No valid API key found for embeddings');
        }
    }
    async createEmbedding(text) {
        try {
            const cacheKey = `embedding:${this.hashText(text)}`;
            const cachedEmbedding = await this.getCachedEmbedding(cacheKey);
            if (cachedEmbedding) {
                this.logger.debug(`Using cached embedding for text: ${text.substring(0, 100)}...`);
                return cachedEmbedding;
            }
            let embedding;
            if (this.useAnthropic && this.anthropic) {
                this.logger.debug(`Creating hash-based embedding for text: ${text.substring(0, 100)}...`);
                embedding = this.createHashBasedEmbedding(text);
            }
            else if (this.openai) {
                this.logger.debug(`Creating OpenAI embedding for text: ${text.substring(0, 100)}...`);
                const response = await this.openai.embeddings.create({
                    model: 'text-embedding-ada-002',
                    input: text,
                });
                embedding = response.data[0].embedding;
            }
            else {
                this.logger.warn('No API keys available, using hash-based embedding');
                embedding = this.createHashBasedEmbedding(text);
            }
            this.logger.debug(`Generated embedding with ${embedding.length} dimensions`);
            await this.setCachedEmbedding(cacheKey, embedding, 24 * 60 * 60);
            return embedding;
        }
        catch (error) {
            const errorObj = error;
            this.logger.error(`Failed to create embedding: ${errorObj.message}`, errorObj.stack);
            throw new Error(`Embedding generation failed: ${errorObj.message}`);
        }
    }
    hashText(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    createHashBasedEmbedding(text) {
        const embedding = Array.from({ length: 1536 }, () => 0);
        const words = text.toLowerCase().split(/\s+/);
        words.forEach((word, wordIndex) => {
            let hash = 0;
            for (let i = 0; i < word.length; i++) {
                hash = (hash << 5) - hash + word.charCodeAt(i);
                hash = hash & hash;
            }
            const normalizedHash = Math.abs(hash) / 2147483647;
            const startIndex = (Math.abs(hash) % (1536 - 10)) + 5;
            for (let i = 0; i < 10; i++) {
                const index = (startIndex + i) % 1536;
                embedding[index] += normalizedHash * (wordIndex + 1) * 0.1;
            }
        });
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] = embedding[i] / magnitude;
            }
        }
        return embedding;
    }
    async getCachedEmbedding(cacheKey) {
        try {
            const redis = this.redisService.getClient();
            if (!redis)
                return null;
            const cached = await redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
            return null;
        }
        catch (error) {
            this.logger.warn(`Failed to get cached embedding: ${error.message}`);
            return null;
        }
    }
    async setCachedEmbedding(cacheKey, embedding, ttlSeconds) {
        try {
            const redis = this.redisService.getClient();
            if (!redis)
                return;
            await redis.setEx(cacheKey, ttlSeconds, JSON.stringify(embedding));
        }
        catch (error) {
            this.logger.warn(`Failed to cache embedding: ${error.message}`);
        }
    }
    async storeMessageEmbedding(messageId, content) {
        try {
            this.logger.debug(`Storing embedding for message ${messageId}`);
            const embedding = await this.createEmbedding(content);
            await this.prismaService.$executeRaw `
        UPDATE messages
        SET embedding = ${embedding}::vector
        WHERE id = ${messageId}
      `;
            this.logger.debug(`Successfully stored embedding for message ${messageId}`);
        }
        catch (error) {
            const errorObj = error;
            this.logger.error(`Failed to store message embedding: ${errorObj.message}`, errorObj.stack);
        }
    }
    async findSimilarMessages(content, roomId, limit = 5) {
        try {
            this.logger.debug(`Finding similar messages for room ${roomId}`);
            const embedding = await this.createEmbedding(content);
            const similarMessages = await this.prismaService.$queryRaw `
        SELECT 
          id, 
          content, 
          role, 
          "createdAt", 
          "userId",
          1 - (embedding <=> ${embedding}::vector) as similarity
        FROM messages
        WHERE "roomId" = ${roomId}
          AND embedding IS NOT NULL
          AND role != 'system'
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;
            this.logger.debug(`Found ${similarMessages.length} similar messages`);
            return similarMessages;
        }
        catch (error) {
            const errorObj = error;
            this.logger.error(`Failed to find similar messages: ${errorObj.message}`, errorObj.stack);
            return [];
        }
    }
    async batchStoreEmbeddings(messages, batchSize = 5) {
        try {
            this.logger.debug(`Batch storing embeddings for ${messages.length} messages (batch size: ${batchSize})`);
            for (let i = 0; i < messages.length; i += batchSize) {
                const batch = messages.slice(i, i + batchSize);
                const batchPromises = batch.map(async (message) => {
                    try {
                        await this.storeMessageEmbedding(message.id, message.content);
                    }
                    catch (error) {
                        this.logger.warn(`Failed to store embedding for message ${message.id}: ${error.message}`);
                    }
                });
                await Promise.allSettled(batchPromises);
                if (i + batchSize < messages.length) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
            }
            this.logger.debug(`Completed batch embedding storage`);
        }
        catch (error) {
            const errorObj = error;
            this.logger.error(`Failed to batch store embeddings: ${errorObj.message}`, errorObj.stack);
        }
    }
    processEmbeddingsInBackground(messages) {
        setImmediate(() => {
            this.batchStoreEmbeddings(messages).catch((error) => {
                this.logger.error(`Background embedding processing failed: ${error.message}`);
            });
        });
    }
    async processMissingEmbeddings(roomId, limit = 100) {
        try {
            this.logger.debug(`Processing missing embeddings for room ${roomId || 'all'}`);
            const messagesWithoutEmbeddings = roomId
                ? await this.prismaService.$queryRaw `
            SELECT id, content
            FROM messages
            WHERE "roomId" = ${roomId}
              AND embedding IS NULL
              AND content IS NOT NULL
              AND content != ''
            ORDER BY "createdAt" DESC
            LIMIT ${limit}
          `
                : await this.prismaService.$queryRaw `
            SELECT id, content
            FROM messages
            WHERE embedding IS NULL
              AND content IS NOT NULL
              AND content != ''
            ORDER BY "createdAt" DESC
            LIMIT ${limit}
          `;
            if (messagesWithoutEmbeddings.length === 0) {
                this.logger.debug('No messages without embeddings found');
                return;
            }
            this.logger.debug(`Found ${messagesWithoutEmbeddings.length} messages without embeddings`);
            await this.batchStoreEmbeddings(messagesWithoutEmbeddings);
        }
        catch (error) {
            const errorObj = error;
            this.logger.error(`Failed to process missing embeddings: ${errorObj.message}`, errorObj.stack);
        }
    }
};
exports.EmbeddingService = EmbeddingService;
exports.EmbeddingService = EmbeddingService = EmbeddingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], EmbeddingService);
//# sourceMappingURL=embedding.service.js.map