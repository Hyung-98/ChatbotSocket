"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const admin_service_1 = require("./admin.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const admin_guard_1 = require("./admin.guard");
const client_1 = require("@prisma/client");
let AdminController = class AdminController {
    adminService;
    constructor(adminService) {
        this.adminService = adminService;
    }
    async getDashboardStats() {
        return this.adminService.getDashboardStats();
    }
    async getUsers(page = '1', limit = '20') {
        return this.adminService.getUsers(parseInt(page), parseInt(limit));
    }
    async getRooms(page = '1', limit = '20') {
        return this.adminService.getRooms(parseInt(page), parseInt(limit));
    }
    async getRecentMessages(limit = '50') {
        return this.adminService.getRecentMessages(parseInt(limit));
    }
    async getConversationLogs(page = '1', limit = '20', roomId, userId, startDate, endDate, search) {
        const skip = (parseInt(page) - 1) * parseInt(limit);
        return this.adminService.getConversationLogs({
            skip,
            take: parseInt(limit),
            roomId,
            userId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            search,
        });
    }
    async getConversationThread(roomId, limit = '100') {
        return this.adminService.getConversationThread(roomId, parseInt(limit));
    }
    async createUser(userData) {
        return this.adminService.createUser(userData);
    }
    async updateUserRole(userId, role, req) {
        try {
            const result = await this.adminService.updateUserRole(userId, role, req.user?.id);
            return result;
        }
        catch (error) {
            throw error;
        }
    }
    async toggleUserStatus(userId) {
        return this.adminService.toggleUserStatus(userId);
    }
    async updateUser(userId, updateData) {
        return this.adminService.updateUser(userId, updateData);
    }
    async updateRoom(roomId, updateData) {
        return this.adminService.updateRoom(roomId, updateData);
    }
    async deleteUser(userId) {
        try {
            await this.adminService.deleteUser(userId);
            return { message: '사용자가 삭제되었습니다.' };
        }
        catch (error) {
            throw error;
        }
    }
    async deleteRoom(roomId) {
        await this.adminService.deleteRoom(roomId);
        return { message: '룸이 삭제되었습니다.' };
    }
    async getSystemHealth() {
        const stats = await this.adminService.getDashboardStats();
        return stats.systemHealth;
    }
    async getErrorLogs(page = '1', limit = '50', level, startDate, endDate) {
        const skip = (parseInt(page) - 1) * parseInt(limit);
        return this.adminService.getErrorLogs({
            skip,
            take: parseInt(limit),
            level,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
    }
    async getErrorStats(startDate, endDate) {
        return this.adminService.getErrorStats({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
    }
    async getTokenUsage(startDate, endDate) {
        return this.adminService.getTokenUsage({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
    }
    async getTokenUsageProjection() {
        return this.adminService.getTokenUsageProjection();
    }
    getSystemLogs() {
        return {
            logs: [
                {
                    timestamp: new Date().toISOString(),
                    level: 'INFO',
                    message: '시스템이 정상적으로 실행 중입니다.',
                },
                {
                    timestamp: new Date(Date.now() - 60000).toISOString(),
                    level: 'INFO',
                    message: '새로운 사용자가 등록되었습니다.',
                },
                {
                    timestamp: new Date(Date.now() - 120000).toISOString(),
                    level: 'WARN',
                    message: 'Rate limit이 적용되었습니다.',
                },
            ],
        };
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('dashboard'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getDashboardStats", null);
__decorate([
    (0, common_1.Get)('users'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getUsers", null);
__decorate([
    (0, common_1.Get)('rooms'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getRooms", null);
__decorate([
    (0, common_1.Get)('messages'),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getRecentMessages", null);
__decorate([
    (0, common_1.Get)('conversations'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('roomId')),
    __param(3, (0, common_1.Query)('userId')),
    __param(4, (0, common_1.Query)('startDate')),
    __param(5, (0, common_1.Query)('endDate')),
    __param(6, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getConversationLogs", null);
__decorate([
    (0, common_1.Get)('conversations/:roomId/thread'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getConversationThread", null);
__decorate([
    (0, common_1.Post)('users'),
    (0, common_1.UseGuards)(admin_guard_1.SuperAdminGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createUser", null);
__decorate([
    (0, common_1.Put)('users/:id/role'),
    (0, common_1.UseGuards)(admin_guard_1.SuperAdminGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('role')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateUserRole", null);
__decorate([
    (0, common_1.Put)('users/:id/status'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "toggleUserStatus", null);
__decorate([
    (0, common_1.Patch)('users/:id'),
    (0, common_1.UseGuards)(admin_guard_1.SuperAdminGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateUser", null);
__decorate([
    (0, common_1.Patch)('rooms/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateRoom", null);
__decorate([
    (0, common_1.Delete)('users/:id'),
    (0, common_1.UseGuards)(admin_guard_1.SuperAdminGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "deleteUser", null);
__decorate([
    (0, common_1.Delete)('rooms/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "deleteRoom", null);
__decorate([
    (0, common_1.Get)('system/health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getSystemHealth", null);
__decorate([
    (0, common_1.Get)('logs/errors'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('level')),
    __param(3, (0, common_1.Query)('startDate')),
    __param(4, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getErrorLogs", null);
__decorate([
    (0, common_1.Get)('logs/errors/stats'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getErrorStats", null);
__decorate([
    (0, common_1.Get)('tokens/usage'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getTokenUsage", null);
__decorate([
    (0, common_1.Get)('tokens/projection'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getTokenUsageProjection", null);
__decorate([
    (0, common_1.Get)('logs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getSystemLogs", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map