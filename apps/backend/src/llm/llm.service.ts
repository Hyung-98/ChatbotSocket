import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
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

@Injectable()
export class LlmService {
  private readonly anthropic: Anthropic;
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private prismaService: PrismaService,
    private embeddingService: EmbeddingService,
  ) {
    // API 키 검증
    if (!process.env.ANTHROPIC_API_KEY) {
      this.logger.error(
        'ANTHROPIC_API_KEY is not set in environment variables',
      );
      throw new Error(
        'AI service is not properly configured. Please check API key settings.',
      );
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateChatResponse(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
  ): Promise<string> {
    try {
      this.logger.log('Starting Anthropic chat completion');

      // API 키 재검증
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error(
          'AI service is not properly configured. Please check API key settings.',
        );
      }

      // Anthropic API 형식으로 메시지 변환
      const anthropicMessages = this.convertToAnthropicFormat(messages);
      const systemMessage = this.extractSystemMessage(messages);

      // 타임아웃 설정 (30초)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('AI service request timed out. Please try again.'));
        }, 30000);
      });

      const apiPromise = this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022', // 최신 Claude 모델 사용
        max_tokens: 1000,
        temperature: 0.7,
        system: systemMessage,
        messages: anthropicMessages,
        stream: true,
      });

      const stream = await Promise.race([apiPromise, timeoutPromise]);

      let fullResponse = '';

      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          const content = chunk.delta.text || '';
          if (content) {
            fullResponse += content;
            callbacks.onToken(content);
          }
        }
      }

      this.logger.log(
        `Anthropic response completed: ${fullResponse.length} characters`,
      );
      callbacks.onComplete(fullResponse);
      return fullResponse;
    } catch (error) {
      let errorMessage = 'AI 응답 생성 중 오류가 발생했습니다.';

      if (error instanceof Error) {
        // Anthropic API 오류 메시지 파싱 시도
        try {
          const errorData = JSON.parse(error.message);
          if (errorData.type === 'error' && errorData.error) {
            const apiError = errorData.error;
            if (apiError.type === 'authentication_error') {
              errorMessage =
                'AI 서비스 인증에 실패했습니다. API 키를 확인해주세요.';
            } else if (apiError.type === 'rate_limit_error') {
              errorMessage =
                'AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.';
            } else if (apiError.type === 'api_error') {
              errorMessage = `AI 서비스 오류: ${apiError.message || '알 수 없는 오류'}`;
            } else {
              errorMessage = `AI 서비스 오류: ${apiError.message || error.message}`;
            }
          } else {
            errorMessage = `AI 응답 생성 중 오류가 발생했습니다: ${error.message}`;
          }
        } catch (parseError) {
          // JSON 파싱 실패 시 기존 로직 사용
          if (
            error.message.includes('API key') ||
            error.message.includes('authentication')
          ) {
            errorMessage =
              'AI 서비스가 올바르게 설정되지 않았습니다. 관리자에게 문의하세요.';
          } else if (error.message.includes('timed out')) {
            errorMessage = 'AI 응답이 시간 초과되었습니다. 다시 시도해주세요.';
          } else if (error.message.includes('rate limit')) {
            errorMessage =
              'AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.';
          } else if (
            error.message.includes('network') ||
            error.message.includes('connection')
          ) {
            errorMessage =
              '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.';
          } else {
            errorMessage = `AI 응답 생성 중 오류가 발생했습니다: ${error.message}`;
          }
        }
      }

      this.logger.error(`Anthropic API error: ${errorMessage}`, error);
      callbacks.onError(new Error(errorMessage));
      throw new Error(errorMessage);
    }
  }

  async prepareMessages(
    userMessage: string,
    roomId: string,
  ): Promise<ChatMessage[]> {
    try {
      // 1. 유사한 메시지 검색 (RAG)
      const similarMessages = await this.embeddingService.findSimilarMessages(
        userMessage,
        roomId,
        5, // 최대 5개의 유사한 메시지
      );

      // 2. 최근 대화 기록 조회 (최근 10개 메시지)
      const recentMessages = await this.prismaService.message.findMany({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: true },
      });

      // 메시지를 역순으로 정렬 (오래된 것부터)
      const sortedRecentMessages = recentMessages.reverse();

      // 3. 시스템 프롬프트
      const systemPrompt: ChatMessage = {
        role: 'system',
        content: this.buildSystemPrompt(similarMessages),
      };

      // 4. 유사한 메시지를 컨텍스트로 변환
      const contextMessages: ChatMessage[] = similarMessages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: `[Relevant context] ${msg.content}`,
      }));

      // 5. 최근 대화 기록을 OpenAI 형식으로 변환
      const conversationMessages: ChatMessage[] = sortedRecentMessages.map(
        (msg) => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        }),
      );

      // 6. 현재 사용자 메시지
      const currentUserMessage: ChatMessage = {
        role: 'user',
        content: userMessage,
      };

      // 7. 모든 메시지 결합 (시스템 프롬프트 + 컨텍스트 + 최근 대화 + 현재 메시지)
      const allMessages = [
        systemPrompt,
        ...contextMessages,
        ...conversationMessages,
        currentUserMessage,
      ];

      // 8. 토큰 제한을 고려하여 메시지 수 제한
      return this.truncateMessages(allMessages);
    } catch (error) {
      this.logger.error(
        `Failed to prepare messages with RAG: ${error.message}`,
      );

      // RAG 실패 시 기본 동작으로 폴백
      return this.prepareMessagesFallback(userMessage, roomId);
    }
  }

  private buildSystemPrompt(similarMessages: any[]): string {
    let systemPrompt =
      "You are a helpful AI assistant. Provide clear, concise, and helpful responses. If you don't know something, say so honestly.";

    if (similarMessages.length > 0) {
      systemPrompt +=
        '\n\nBased on the conversation history, you have access to relevant context from previous discussions. Use this context to provide more informed and relevant responses.';
    }

    return systemPrompt;
  }

  private async prepareMessagesFallback(
    userMessage: string,
    roomId: string,
  ): Promise<ChatMessage[]> {
    // RAG 실패 시 기본 동작 (기존 로직)
    const recentMessages = await this.prismaService.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: true },
    });

    const sortedMessages = recentMessages.reverse();

    const systemPrompt: ChatMessage = {
      role: 'system',
      content:
        "You are a helpful AI assistant. Provide clear, concise, and helpful responses. If you don't know something, say so honestly.",
    };

    const conversationMessages: ChatMessage[] = sortedMessages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    const currentUserMessage: ChatMessage = {
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

  private truncateMessages(messages: ChatMessage[]): ChatMessage[] {
    // 간단한 구현: 최근 8개 대화 메시지만 유지 (시스템 프롬프트 + 최근 8개)
    if (messages.length > 9) {
      return [messages[0], ...messages.slice(-8)];
    }
    return messages;
  }

  async saveMessage(
    roomId: string,
    content: string,
    role: 'user' | 'assistant',
    userId?: string,
  ): Promise<string> {
    try {
      // 방이 존재하는지 확인하고, 없으면 생성
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to save message: ${errorMessage}`);
      throw error;
    }
  }

  private async ensureRoomExists(roomId: string): Promise<void> {
    try {
      const existingRoom = await this.prismaService.room.findUnique({
        where: { id: roomId },
      });

      if (!existingRoom) {
        // 방이 존재하지 않으면 생성
        await this.prismaService.room.create({
          data: {
            id: roomId,
            name: roomId, // roomId를 이름으로 사용
          },
        });
        this.logger.log(`Room created: ${roomId}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to ensure room exists: ${errorMessage}`);
      throw error;
    }
  }

  private convertToAnthropicFormat(
    messages: ChatMessage[],
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    return messages
      .filter((msg) => msg.role !== 'system') // system 메시지는 별도 처리
      .map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));
  }

  private extractSystemMessage(messages: ChatMessage[]): string {
    const systemMessage = messages.find((msg) => msg.role === 'system');
    return (
      systemMessage?.content ||
      'You are a helpful AI assistant. Please provide clear and concise responses.'
    );
  }

  async getConversationHistory(roomId: string): Promise<ChatMessage[]> {
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
}
