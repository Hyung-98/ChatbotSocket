"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryModule = void 0;
const common_1 = require("@nestjs/common");
const nestjs_prometheus_1 = require("@willsoto/nestjs-prometheus");
const telemetry_service_1 = require("./telemetry.service");
const metrics_controller_1 = require("./metrics.controller");
const nestjs_otel_1 = require("nestjs-otel");
let TelemetryModule = class TelemetryModule {
};
exports.TelemetryModule = TelemetryModule;
exports.TelemetryModule = TelemetryModule = __decorate([
    (0, common_1.Module)({
        imports: [
            nestjs_prometheus_1.PrometheusModule.register({
                defaultMetrics: {
                    enabled: true,
                },
            }),
            nestjs_otel_1.OpenTelemetryModule.forRoot({
                metrics: {
                    hostMetrics: true,
                    apiMetrics: {
                        enable: true,
                    },
                },
            }),
        ],
        controllers: [metrics_controller_1.MetricsController],
        providers: [telemetry_service_1.TelemetryService],
        exports: [telemetry_service_1.TelemetryService],
    })
], TelemetryModule);
//# sourceMappingURL=telemetry.module.js.map