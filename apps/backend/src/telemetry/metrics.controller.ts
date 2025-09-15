import { Controller, Get } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { TelemetryService } from './telemetry.service';

@Controller('metrics')
export class MetricsController extends PrometheusController {
  constructor(private readonly telemetryService: TelemetryService) {
    super();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('stats')
  getStats() {
    return {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
