import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
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

@Injectable()
export class LlmService {
  private readonly anthropic: Anthropic;
  private readonly logger = new Logger(LlmService.name);

  constructor(private prismaService: PrismaService) {
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

      // Anthropic API 형식으로 메시지 변환
      const anthropicMessages = this.convertToAnthropicFormat(messages);
      const systemMessage = this.extractSystemMessage(messages);

      const stream = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022', // 최신 Claude 모델 사용
        max_tokens: 1000,
        temperature: 0.7,
        system: systemMessage,
        messages: anthropicMessages,
        stream: true,
      });

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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Anthropic API error: ${errorMessage}`);
      callbacks.onError(
        error instanceof Error ? error : new Error(errorMessage),
      );
      throw error;
    }
  }

  async prepareMessages(
    userMessage: string,
    roomId: string,
  ): Promise<ChatMessage[]> {
    // 최근 대화 기록 조회 (최근 10개 메시지)
    const recentMessages = await this.prismaService.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: true },
    });

    // 메시지를 역순으로 정렬 (오래된 것부터)
    const sortedMessages = recentMessages.reverse();

    // 시스템 프롬프트
    const systemPrompt: ChatMessage = {
      role: 'system',
      content:
        "You are a helpful AI assistant. Provide clear, concise, and helpful responses. If you don't know something, say so honestly.",
    };

    // 대화 기록을 OpenAI 형식으로 변환
    const conversationMessages: ChatMessage[] = sortedMessages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // 현재 사용자 메시지 추가
    const currentUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
    };

    // 모든 메시지 결합
    const allMessages = [
      systemPrompt,
      ...conversationMessages,
      currentUserMessage,
    ];

    // 토큰 제한을 고려하여 메시지 수 제한
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
  ): Promise<void> {
    try {
      // 방이 존재하는지 확인하고, 없으면 생성
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
