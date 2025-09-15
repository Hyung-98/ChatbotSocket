import { Counter, Gauge, Histogram } from 'prom-client';
export declare const socketConnectionsGauge: Gauge<"status">;
export declare const messageCounter: Counter<"role" | "room_id">;
export declare const llmResponseTimeHistogram: Histogram<"model" | "provider">;
export declare const llmTokenUsageCounter: Counter<"type" | "model" | "provider">;
export declare const activeRoomsGauge: Gauge<string>;
export declare const userSessionsGauge: Gauge<"status">;
export declare const errorCounter: Counter<"type" | "severity" | "component">;
export declare const requestDurationHistogram: Histogram<"route" | "method" | "status_code">;
