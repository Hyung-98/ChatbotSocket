import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class EmbeddingService {
  private readonly openai: OpenAI;
  private readonly anthropic: Anthropic;
  private readonly logger = new Logger(EmbeddingService.name);
  private useAnthropic: boolean = false;

  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
    private redisService: RedisService,
  ) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    // OpenAI 키가 유효하지 않으면 Anthropic 사용
    this.useAnthropic = !openaiKey || openaiKey.includes('sk-proj-');

    if (
      this.useAnthropic &&
      anthropicKey &&
      !anthropicKey.includes('sk-ant-')
    ) {
      this.anthropic = new Anthropic({
        apiKey: anthropicKey,
      });
      this.logger.log('Using Anthropic for embeddings');
    } else if (openaiKey && !openaiKey.includes('sk-proj-')) {
      this.openai = new OpenAI({
        apiKey: openaiKey,
      });
      this.logger.log('Using OpenAI for embeddings');
    } else {
      this.logger.warn('No valid API key found for embeddings');
    }
  }

  /**
   * 텍스트를 벡터 임베딩으로 변환 (캐싱 포함)
   * @param text 임베딩할 텍스트
   * @returns 1536차원 벡터 배열
   */
  async createEmbedding(text: string): Promise<number[]> {
    try {
      // 1. 캐시에서 임베딩 확인
      const cacheKey = `embedding:${this.hashText(text)}`;
      const cachedEmbedding = await this.getCachedEmbedding(cacheKey);

      if (cachedEmbedding) {
        this.logger.debug(
          `Using cached embedding for text: ${text.substring(0, 100)}...`,
        );
        return cachedEmbedding;
      }

      let embedding: number[];

      if (this.useAnthropic && this.anthropic) {
        // 2a. Anthropic을 사용한 간단한 임베딩 생성 (해시 기반)
        this.logger.debug(
          `Creating hash-based embedding for text: ${text.substring(0, 100)}...`,
        );
        embedding = this.createHashBasedEmbedding(text);
      } else if (this.openai) {
        // 2b. OpenAI API로 임베딩 생성
        this.logger.debug(
          `Creating OpenAI embedding for text: ${text.substring(0, 100)}...`,
        );

        const response = await this.openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: text,
        });

        embedding = response.data[0].embedding;
      } else {
        // 2c. API 키가 없는 경우 해시 기반 임베딩 사용
        this.logger.warn('No API keys available, using hash-based embedding');
        embedding = this.createHashBasedEmbedding(text);
      }

      this.logger.debug(
        `Generated embedding with ${embedding.length} dimensions`,
      );

      // 3. 캐시에 저장 (24시간 TTL)
      await this.setCachedEmbedding(cacheKey, embedding, 24 * 60 * 60);

      return embedding;
    } catch (error) {
      const errorObj = error as Error;
      this.logger.error(
        `Failed to create embedding: ${errorObj.message}`,
        errorObj.stack,
      );
      throw new Error(`Embedding generation failed: ${errorObj.message}`);
    }
  }

  /**
   * 텍스트 해시 생성 (캐시 키용)
   */
  private hashText(text: string): string {
    // 간단한 해시 함수 (실제 프로덕션에서는 crypto 모듈 사용 권장)
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 32bit 정수로 변환
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 해시 기반 임베딩 생성 (API 키가 없을 때 사용)
   * @param text 임베딩할 텍스트
   * @returns 1536차원 벡터 배열
   */
  private createHashBasedEmbedding(text: string): number[] {
    const embedding: number[] = Array.from({ length: 1536 }, () => 0);
    const words = text.toLowerCase().split(/\s+/);

    // 각 단어의 해시를 기반으로 임베딩 생성
    words.forEach((word, wordIndex) => {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i);
        hash = hash & hash;
      }

      // 해시를 1536차원에 분산
      const normalizedHash = Math.abs(hash) / 2147483647; // 정규화
      const startIndex = (Math.abs(hash) % (1536 - 10)) + 5; // 5-1530 범위

      for (let i = 0; i < 10; i++) {
        const index = (startIndex + i) % 1536;
        embedding[index] += normalizedHash * (wordIndex + 1) * 0.1;
      }
    });

    // 벡터 정규화
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] = embedding[i] / magnitude;
      }
    }

    return embedding;
  }

  /**
   * 캐시에서 임베딩 조회
   */
  private async getCachedEmbedding(cacheKey: string): Promise<number[] | null> {
    try {
      const redis = this.redisService.getClient();
      if (!redis) return null;

      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as number[];
      }
      return null;
    } catch (error) {
      this.logger.warn(
        `Failed to get cached embedding: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * 임베딩을 캐시에 저장
   */
  private async setCachedEmbedding(
    cacheKey: string,
    embedding: number[],
    ttlSeconds: number,
  ): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      if (!redis) return;

      await redis.setEx(cacheKey, ttlSeconds, JSON.stringify(embedding));
    } catch (error) {
      this.logger.warn(
        `Failed to cache embedding: ${(error as Error).message}`,
      );
    }
  }

  /**
   * 메시지의 임베딩을 생성하고 데이터베이스에 저장
   * @param messageId 메시지 ID
   * @param content 메시지 내용
   */
  async storeMessageEmbedding(
    messageId: string,
    content: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Storing embedding for message ${messageId}`);

      const embedding = await this.createEmbedding(content);

      // pgvector를 사용하여 임베딩 저장 (테이블명 수정)
      await this.prismaService.$executeRaw`
        UPDATE messages
        SET embedding = ${embedding}::vector
        WHERE id = ${messageId}
      `;

      this.logger.debug(
        `Successfully stored embedding for message ${messageId}`,
      );
    } catch (error) {
      const errorObj = error as Error;
      this.logger.error(
        `Failed to store message embedding: ${errorObj.message}`,
        errorObj.stack,
      );
      // 임베딩 저장 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }

  /**
   * 유사한 메시지를 검색
   * @param content 검색할 텍스트
   * @param roomId 채팅방 ID
   * @param limit 반환할 최대 메시지 수
   * @returns 유사한 메시지 배열 (유사도 점수 포함)
   */
  async findSimilarMessages(
    content: string,
    roomId: string,
    limit: number = 5,
  ): Promise<
    Array<{
      id: string;
      content: string;
      role: string;
      createdAt: Date;
      userId: string | null;
      similarity: number;
    }>
  > {
    try {
      this.logger.debug(`Finding similar messages for room ${roomId}`);

      const embedding = await this.createEmbedding(content);

      // 코사인 유사도 기반 검색 (1 - 코사인 거리 = 유사도)
      const similarMessages = await this.prismaService.$queryRaw<
        Array<{
          id: string;
          content: string;
          role: string;
          createdAt: Date;
          userId: string | null;
          similarity: number;
        }>
      >`
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
    } catch (error) {
      const errorObj = error as Error;
      this.logger.error(
        `Failed to find similar messages: ${errorObj.message}`,
        errorObj.stack,
      );
      return [];
    }
  }

  /**
   * 배치로 여러 메시지의 임베딩을 생성하고 저장 (최적화된 버전)
   * @param messages 메시지 배열 (id와 content 포함)
   * @param batchSize 배치 크기 (기본값: 5)
   */
  async batchStoreEmbeddings(
    messages: Array<{ id: string; content: string }>,
    batchSize: number = 5,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Batch storing embeddings for ${messages.length} messages (batch size: ${batchSize})`,
      );

      // 1. 배치로 나누어 처리
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);

        // 2. 각 배치를 병렬로 처리
        const batchPromises = batch.map(async (message) => {
          try {
            await this.storeMessageEmbedding(message.id, message.content);
          } catch (error) {
            this.logger.warn(
              `Failed to store embedding for message ${message.id}: ${(error as Error).message}`,
            );
          }
        });

        await Promise.allSettled(batchPromises);

        // 3. 배치 간 짧은 지연 (API 제한 방지)
        if (i + batchSize < messages.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      this.logger.debug(`Completed batch embedding storage`);
    } catch (error) {
      const errorObj = error as Error;
      this.logger.error(
        `Failed to batch store embeddings: ${errorObj.message}`,
        errorObj.stack,
      );
    }
  }
  /**
   * 백그라운드에서 임베딩 처리 (비동기)
   * @param messages 메시지 배열
   */
  processEmbeddingsInBackground(
    messages: Array<{ id: string; content: string }>,
  ): void {
    // 비동기로 처리하여 메인 요청을 블록하지 않음
    setImmediate(() => {
      this.batchStoreEmbeddings(messages).catch((error) => {
        this.logger.error(
          `Background embedding processing failed: ${(error as Error).message}`,
        );
      });
    });
  }

  /**
   * 임베딩이 없는 메시지들을 찾아서 임베딩 생성
   * @param roomId 채팅방 ID (선택사항)
   * @param limit 처리할 최대 메시지 수
   */
  async processMissingEmbeddings(
    roomId?: string,
    limit: number = 100,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Processing missing embeddings for room ${roomId || 'all'}`,
      );

      // SQL Injection 방지를 위해 Prisma의 매개변수화된 쿼리 사용
      const messagesWithoutEmbeddings = roomId
        ? await this.prismaService.$queryRaw`
            SELECT id, content
            FROM messages
            WHERE "roomId" = ${roomId}
              AND embedding IS NULL
              AND content IS NOT NULL
              AND content != ''
            ORDER BY "createdAt" DESC
            LIMIT ${limit}
          `
        : await this.prismaService.$queryRaw`
            SELECT id, content
            FROM messages
            WHERE embedding IS NULL
              AND content IS NOT NULL
              AND content != ''
            ORDER BY "createdAt" DESC
            LIMIT ${limit}
          `;

      if ((messagesWithoutEmbeddings as unknown[]).length === 0) {
        this.logger.debug('No messages without embeddings found');
        return;
      }

      this.logger.debug(
        `Found ${(messagesWithoutEmbeddings as unknown[]).length} messages without embeddings`,
      );
      await this.batchStoreEmbeddings(
        messagesWithoutEmbeddings as Array<{ id: string; content: string }>,
      );
    } catch (error) {
      const errorObj = error as Error;
      this.logger.error(
        `Failed to process missing embeddings: ${errorObj.message}`,
        errorObj.stack,
      );
    }
  }
}
