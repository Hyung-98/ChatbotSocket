import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { UserConnectionService } from './user-connection.service';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { LlmModule } from '../llm/llm.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { PrismaService } from '../prisma/prisma.service';
import {
  MessageThrottlerGuard,
  TypingThrottlerGuard,
} from '../common/guards/throttle.guard';

@Module({
  imports: [
    AuthModule,
    RedisModule,
    LlmModule,
    EmbeddingModule,
    TelemetryModule,
  ],
  providers: [
    ChatGateway,
    UserConnectionService,
    PrismaService,
    MessageThrottlerGuard,
    TypingThrottlerGuard,
  ],
  exports: [ChatGateway, UserConnectionService],
})
export class ChatModule {}
