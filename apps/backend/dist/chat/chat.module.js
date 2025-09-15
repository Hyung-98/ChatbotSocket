"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatModule = void 0;
const common_1 = require("@nestjs/common");
const chat_gateway_1 = require("./chat.gateway");
const user_connection_service_1 = require("./user-connection.service");
const auth_module_1 = require("../auth/auth.module");
const redis_module_1 = require("../redis/redis.module");
const llm_module_1 = require("../llm/llm.module");
const embedding_module_1 = require("../embedding/embedding.module");
const telemetry_module_1 = require("../telemetry/telemetry.module");
const prisma_service_1 = require("../prisma/prisma.service");
const throttle_guard_1 = require("../common/guards/throttle.guard");
let ChatModule = class ChatModule {
};
exports.ChatModule = ChatModule;
exports.ChatModule = ChatModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            redis_module_1.RedisModule,
            llm_module_1.LlmModule,
            embedding_module_1.EmbeddingModule,
            telemetry_module_1.TelemetryModule,
        ],
        providers: [
            chat_gateway_1.ChatGateway,
            user_connection_service_1.UserConnectionService,
            prisma_service_1.PrismaService,
            throttle_guard_1.MessageThrottlerGuard,
            throttle_guard_1.TypingThrottlerGuard,
        ],
        exports: [chat_gateway_1.ChatGateway, user_connection_service_1.UserConnectionService],
    })
], ChatModule);
//# sourceMappingURL=chat.module.js.map