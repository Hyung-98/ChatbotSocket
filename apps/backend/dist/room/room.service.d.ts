import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomQueryDto } from './dto/room-query.dto';
export declare class RoomService {
    private prisma;
    constructor(prisma: PrismaService);
    create(createRoomDto: CreateRoomDto, _userId: string): Promise<{
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
    findAll(query: RoomQueryDto): Promise<{
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
    findOne(id: string): Promise<{
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
    update(id: string, updateRoomDto: UpdateRoomDto, _userId: string): Promise<{
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
    remove(id: string, _userId: string): Promise<{
        message: string;
    }>;
    getMessages(roomId: string, query: {
        skip?: number;
        take?: number;
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
    getRecentMessages(roomId: string, limit?: number): Promise<{
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
    getRoomStats(roomId: string): Promise<{
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
