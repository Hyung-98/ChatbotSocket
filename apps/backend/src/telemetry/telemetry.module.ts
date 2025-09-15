import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { TelemetryService } from './telemetry.service';
import { MetricsController } from './metrics.controller';
import { OpenTelemetryModule } from 'nestjs-otel';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
    }),
    OpenTelemetryModule.forRoot({
      metrics: {
        hostMetrics: true,
        apiMetrics: {
          enable: true,
        },
      },
    }),
  ],
  controllers: [MetricsController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
