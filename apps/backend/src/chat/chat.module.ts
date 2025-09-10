import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [AuthModule, RedisModule, LlmModule],
  providers: [ChatGateway, PrismaService],
  exports: [ChatGateway],
})
export class ChatModule {}
