import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard, SuperAdminGuard } from './admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RedisModule } from '../redis/redis.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorLoggerService } from '../common/services/error-logger.service';
import { TokenTrackingService } from '../common/services/token-tracking.service';

@Module({
  imports: [RedisModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    PrismaService,
    AdminGuard,
    SuperAdminGuard,
    JwtAuthGuard,
    ErrorLoggerService,
    TokenTrackingService,
  ],
  exports: [AdminService, AdminGuard, SuperAdminGuard],
})
export class AdminModule {}
