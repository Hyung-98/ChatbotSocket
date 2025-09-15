import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  AdminService,
  DashboardStats,
  UserStats,
  RoomStats,
  MessageStats,
} from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard, SuperAdminGuard } from './admin.guard';
import { UserRole } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  async getDashboardStats(): Promise<DashboardStats> {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  async getUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ): Promise<{
    users: UserStats[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.adminService.getUsers(parseInt(page), parseInt(limit));
  }

  @Get('rooms')
  async getRooms(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ): Promise<{
    rooms: RoomStats[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.adminService.getRooms(parseInt(page), parseInt(limit));
  }

  @Get('messages')
  async getRecentMessages(
    @Query('limit') limit: string = '50',
  ): Promise<MessageStats[]> {
    return this.adminService.getRecentMessages(parseInt(limit));
  }

  @Get('conversations')
  async getConversationLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('roomId') roomId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
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

  @Get('conversations/:roomId/thread')
  async getConversationThread(
    @Param('roomId') roomId: string,
    @Query('limit') limit: string = '100',
  ) {
    return this.adminService.getConversationThread(roomId, parseInt(limit));
  }

  @Post('users')
  @UseGuards(SuperAdminGuard)
  async createUser(
    @Body()
    userData: {
      name: string;
      email: string;
      password: string;
      role?: UserRole;
      isActive?: boolean;
    },
  ): Promise<UserStats> {
    return this.adminService.createUser(userData);
  }

  @Put('users/:id/role')
  @UseGuards(SuperAdminGuard)
  async updateUserRole(
    @Param('id') userId: string,
    @Body('role') role: UserRole,
    @Request() req: AuthenticatedRequest,
  ): Promise<UserStats> {
    return this.adminService.updateUserRole(userId, role, req.user?.id);
  }

  @Put('users/:id/status')
  async toggleUserStatus(@Param('id') userId: string): Promise<UserStats> {
    return this.adminService.toggleUserStatus(userId);
  }

  @Patch('users/:id')
  @UseGuards(SuperAdminGuard)
  async updateUser(
    @Param('id') userId: string,
    @Body()
    updateData: {
      name?: string;
      email?: string;
      role?: UserRole;
      isActive?: boolean;
    },
  ): Promise<UserStats> {
    return this.adminService.updateUser(userId, updateData);
  }

  @Patch('rooms/:id')
  async updateRoom(
    @Param('id') roomId: string,
    @Body() updateData: { name?: string; description?: string },
  ): Promise<RoomStats> {
    return this.adminService.updateRoom(roomId, updateData);
  }

  @Delete('users/:id')
  @UseGuards(SuperAdminGuard)
  async deleteUser(@Param('id') userId: string): Promise<{ message: string }> {
    await this.adminService.deleteUser(userId);
    return { message: '사용자가 삭제되었습니다.' };
  }

  @Delete('rooms/:id')
  async deleteRoom(@Param('id') roomId: string): Promise<{ message: string }> {
    await this.adminService.deleteRoom(roomId);
    return { message: '룸이 삭제되었습니다.' };
  }

  @Get('system/health')
  async getSystemHealth() {
    const stats = await this.adminService.getDashboardStats();
    return stats.systemHealth;
  }

  @Get('logs/errors')
  async getErrorLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('level') level?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    return this.adminService.getErrorLogs({
      skip,
      take: parseInt(limit),
      level,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('logs/errors/stats')
  async getErrorStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getErrorStats({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('tokens/usage')
  async getTokenUsage(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getTokenUsage({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('tokens/projection')
  async getTokenUsageProjection() {
    return this.adminService.getTokenUsageProjection();
  }

  @Get('logs')
  getSystemLogs() {
    // 실제 구현에서는 로그 파일을 읽거나 로그 서비스에서 가져옴
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
}
