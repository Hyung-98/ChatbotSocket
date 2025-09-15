import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomQueryDto } from './dto/room-query.dto';
import type { UserWithoutPassword } from '../auth/types/user.types';
export declare class RoomController {
    private readonly roomService;
    constructor(roomService: RoomService);
    create(createRoomDto: CreateRoomDto, req: {
        user: UserWithoutPassword;
    }): Promise<{
        messageCount: number;
        _count: {
            messages: number;
        };
        name: string;
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(query: RoomQueryDto, _req: {
        user: UserWithoutPassword;
    }): Promise<{
        rooms: {
            messageCount: number;
            _count: {
                messages: number;
            };
            name: string;
            id: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        total: number;
        skip: number;
        take: number;
    }>;
    findOne(id: string, _req: {
        user: UserWithoutPassword;
    }): Promise<{
        messageCount: number;
        _count: {
            messages: number;
        };
        name: string;
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, updateRoomDto: UpdateRoomDto, req: {
        user: UserWithoutPassword;
    }): Promise<{
        messageCount: number;
        _count: {
            messages: number;
        };
        name: string;
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    patch(id: string, updateRoomDto: UpdateRoomDto, req: {
        user: UserWithoutPassword;
    }): Promise<{
        messageCount: number;
        _count: {
            messages: number;
        };
        name: string;
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string, req: {
        user: UserWithoutPassword;
    }): Promise<{
        message: string;
    }>;
    getMessages(id: string, skip: number, take: number, _req: {
        user: UserWithoutPassword;
    }): Promise<{
        messages: ({
            user: {
                name: string;
                id: string;
                email: string;
            } | null;
        } & {
            role: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            content: string;
            roomId: string;
            userId: string | null;
        })[];
        total: number;
        skip: number;
        take: number;
        room: {
            id: string;
            name: string;
            description: string | null;
        };
    }>;
    getRecentMessages(id: string, limit: number, _req: {
        user: UserWithoutPassword;
    }): Promise<{
        messages: ({
            user: {
                name: string;
                id: string;
                email: string;
            } | null;
        } & {
            role: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            content: string;
            roomId: string;
            userId: string | null;
        })[];
        room: {
            id: string;
            name: string;
            description: string | null;
        };
    }>;
    getRoomStats(id: string, _req: {
        user: UserWithoutPassword;
    }): Promise<{
        room: {
            id: string;
            name: string;
            description: string | null;
        };
        stats: {
            messageCount: number;
            userCount: number;
            lastMessage: {
                content: string;
                userName: string;
                timestamp: Date;
            } | null;
        };
    }>;
}
