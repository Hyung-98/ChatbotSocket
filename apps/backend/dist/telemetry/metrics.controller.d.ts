import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { TelemetryService } from './telemetry.service';
export declare class MetricsController extends PrometheusController {
    private readonly telemetryService;
    constructor(telemetryService: TelemetryService);
    getHealth(): {
        status: string;
        timestamp: string;
        uptime: number;
    };
    getStats(): {
        memory: NodeJS.MemoryUsage;
        cpu: NodeJS.CpuUsage;
        uptime: number;
        timestamp: string;
    };
}
