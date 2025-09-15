export declare class TelemetryService {
    private socketConnectionsGauge;
    private messageCounter;
    private llmResponseTimeHistogram;
    private llmTokenUsageCounter;
    private activeRoomsGauge;
    private userSessionsGauge;
    private errorCounter;
    private requestDurationHistogram;
    constructor();
    recordSocketConnection(delta: number): void;
    recordMessage(role: string, roomId?: string): void;
    recordLlmResponseTime(durationMs: number, provider?: string, model?: string): void;
    recordTokenUsage(type: 'prompt' | 'completion', count: number, provider?: string, model?: string): void;
    recordActiveRooms(count: number): void;
    recordUserSessions(count: number, status?: 'active' | 'inactive'): void;
    recordError(type: string, severity: 'low' | 'medium' | 'high' | 'critical', component: string): void;
    recordRequestDuration(method: string, route: string, statusCode: string, durationSeconds: number): void;
}
