import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
export declare class EmbeddingService {
    private configService;
    private prismaService;
    private redisService;
    private readonly openai;
    private readonly anthropic;
    private readonly logger;
    private useAnthropic;
    constructor(configService: ConfigService, prismaService: PrismaService, redisService: RedisService);
    createEmbedding(text: string): Promise<number[]>;
    private hashText;
    private createHashBasedEmbedding;
    private getCachedEmbedding;
    private setCachedEmbedding;
    storeMessageEmbedding(messageId: string, content: string): Promise<void>;
    findSimilarMessages(content: string, roomId: string, limit?: number): Promise<Array<{
        id: string;
        content: string;
        role: string;
        createdAt: Date;
        userId: string | null;
        similarity: number;
    }>>;
    batchStoreEmbeddings(messages: Array<{
        id: string;
        content: string;
    }>, batchSize?: number): Promise<void>;
    processEmbeddingsInBackground(messages: Array<{
        id: string;
        content: string;
    }>): void;
    processMissingEmbeddings(roomId?: string, limit?: number): Promise<void>;
}
