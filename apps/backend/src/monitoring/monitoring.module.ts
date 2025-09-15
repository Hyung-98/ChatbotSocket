import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { CustomLoggerService } from './logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [MonitoringController],
  providers: [MonitoringService, CustomLoggerService, PrismaService],
  exports: [MonitoringService, CustomLoggerService],
})
export class MonitoringModule {}
