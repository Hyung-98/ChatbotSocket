import {
  Controller,
  Get,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  MonitoringService,
  SystemMetrics,
  PerformanceMetrics,
} from './monitoring.service';
import { CustomLoggerService } from './logger.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, AdminGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class MonitoringController {
  constructor(
    private monitoringService: MonitoringService,
    private loggerService: CustomLoggerService,
  ) {}

  @Get('metrics')
  async getSystemMetrics(): Promise<SystemMetrics> {
    return this.monitoringService.getSystemMetrics();
  }

  @Get('performance')
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return this.monitoringService.getPerformanceMetrics();
  }

  @Get('health')
  async getHealthStatus() {
    return this.monitoringService.getHealthStatus();
  }

  @Get('alerts')
  async getAlerts() {
    return this.monitoringService.getAlerts();
  }

  @Get('logs')
  async getLogs() {
    return this.loggerService.getRecentLogs(100);
  }

  @Get('logs/errors')
  async getErrorLogs() {
    return this.loggerService.getErrorLogs(50);
  }

  @Get('logs/metrics')
  async getLogMetrics() {
    return this.loggerService.getSystemMetrics();
  }
}
