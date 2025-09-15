import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Patch,
  Delete,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoomService } from './room.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomQueryDto } from './dto/room-query.dto';
import type { UserWithoutPassword } from '../auth/types/user.types';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 1분에 10회
  @Post()
  async create(
    @Body() createRoomDto: CreateRoomDto,
    @Request() req: { user: UserWithoutPassword },
  ) {
    return this.roomService.create(createRoomDto, req.user.id);
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 1분에 30회
  @Get()
  async findAll(
    @Query() query: RoomQueryDto,
    @Request() _req: { user: UserWithoutPassword },
  ) {
    return this.roomService.findAll(query);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() _req: { user: UserWithoutPassword },
  ) {
    return this.roomService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @Request() req: { user: UserWithoutPassword },
  ) {
    return this.roomService.update(id, updateRoomDto, req.user.id);
  }

  @Patch(':id')
  async patch(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @Request() req: { user: UserWithoutPassword },
  ) {
    return this.roomService.update(id, updateRoomDto, req.user.id);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req: { user: UserWithoutPassword },
  ) {
    return this.roomService.remove(id, req.user.id);
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 1분에 60회
  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number,
    @Request() _req: { user: UserWithoutPassword },
  ) {
    return this.roomService.getMessages(id, { skip, take });
  }

  @Get(':id/recent')
  async getRecentMessages(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Request() _req: { user: UserWithoutPassword },
  ) {
    return this.roomService.getRecentMessages(id, limit);
  }

  @Get(':id/stats')
  async getRoomStats(
    @Param('id') id: string,
    @Request() _req: { user: UserWithoutPassword },
  ) {
    return this.roomService.getRoomStats(id);
  }
}
