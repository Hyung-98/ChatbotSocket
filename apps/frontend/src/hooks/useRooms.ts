import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface Room {
  id: string;
  name: string;
  description: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateRoomData {
  name: string;
  description?: string;
}

interface UpdateRoomData {
  name?: string;
  description?: string;
}

interface UseRoomsReturn {
  rooms: Room[];
  loading: boolean;
  error: string | null;
  createRoom: (data: CreateRoomData) => Promise<Room | null>;
  updateRoom: (id: string, data: UpdateRoomData) => Promise<Room | null>;
  deleteRoom: (id: string) => Promise<boolean>;
  refreshRooms: () => Promise<void>;
}

export const useRooms = (): UseRoomsReturn => {
  const { data: session } = useSession();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      if (!session?.accessToken) {
        throw new Error('No access token available');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return response.json();
    },
    [session?.accessToken],
  );

  const createRoom = useCallback(
    async (data: CreateRoomData): Promise<Room | null> => {
      try {
        setLoading(true);
        setError(null);
        const room = await apiCall('/rooms', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        setRooms((prev) => [room, ...prev]);
        return room;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create room');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiCall],
  );

  const updateRoom = useCallback(
    async (id: string, data: UpdateRoomData): Promise<Room | null> => {
      try {
        setLoading(true);
        setError(null);
        const room = await apiCall(`/rooms/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        setRooms((prev) => prev.map((r) => (r.id === id ? room : r)));
        return room;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update room');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiCall],
  );

  const deleteRoom = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);
        await apiCall(`/rooms/${id}`, {
          method: 'DELETE',
        });
        setRooms((prev) => prev.filter((r) => r.id !== id));
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete room');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [apiCall],
  );

  const refreshRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiCall('/rooms');
      setRooms(data.rooms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh rooms');
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  return {
    rooms,
    loading,
    error,
    createRoom,
    updateRoom,
    deleteRoom,
    refreshRooms,
  };
};
