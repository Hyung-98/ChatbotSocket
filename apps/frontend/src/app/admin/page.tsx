'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '../../components/ThemeToggle';
import { useTheme } from '../../hooks/useTheme';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import ConversationLogs from '../../components/admin/ConversationLogs';
import ConversationThread from '../../components/admin/ConversationThread';
import ErrorLogs from '../../components/admin/ErrorLogs';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement);

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalRooms: number;
  totalMessages: number;
  onlineUsers: number;
  systemHealth: {
    database: boolean;
    redis: boolean;
    uptime: number;
  };
}

interface UserStats {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  isActive: boolean;
  lastLogin: string | null;
  messageCount: number;
  createdAt: string;
}

interface RoomStats {
  id: string;
  name: string;
  description: string | null;
  messageCount: number;
  createdAt: string;
  lastActivity: string | null;
}

interface MessageStats {
  id: string;
  content: string;
  role: string;
  userName: string | null;
  roomName: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme, mounted } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<UserStats[]>([]);
  const [rooms, setRooms] = useState<RoomStats[]>([]);
  const [messages, setMessages] = useState<MessageStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserStats | null>(null);
  const [editingRoom, setEditingRoom] = useState<RoomStats | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER' as 'USER' | 'ADMIN' | 'SUPER_ADMIN',
    isActive: true,
  });
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    console.log('Admin page - Session status:', status);
    console.log('Admin page - Session data:', session);
    console.log('Admin page - User object:', session?.user);
    console.log('Admin page - User role:', session?.user?.role);
    console.log('Admin page - Full session keys:', Object.keys(session || {}));
    console.log('Admin page - User keys:', Object.keys(session?.user || {}));

    if (!session) {
      console.log('Admin page - No session, redirecting to signin');
      router.push('/auth/signin');
      return;
    }

    // 세션이 완전히 로드될 때까지 잠시 대기
    if (!session.user || !session.user.id) {
      console.log('Admin page - Session not fully loaded, waiting...');
      return;
    }

    // 관리자 권한 확인 - 역할이 없으면 서버에서 다시 확인
    if (!session.user.role) {
      console.log('Admin page - No role in session, checking with server...');
      checkUserRole();
      return;
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      console.log('Admin page - Insufficient permissions, redirecting to home');
      console.log('Current role:', session.user.role);
      router.push('/');
      return;
    }

    console.log('Admin page - Access granted, loading dashboard data');
    loadDashboardData();

    // 실시간 업데이트 (30초마다)
    const interval = setInterval(() => {
      loadDashboardData();
    }, 30000);

    return () => clearInterval(interval);
  }, [session, status, router]);

  const checkUserRole = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        console.log('Server user data:', userData);

        if (userData.role === 'ADMIN' || userData.role === 'SUPER_ADMIN') {
          console.log('Admin page - Server confirmed admin access');
          loadDashboardData();
        } else {
          console.log('Admin page - Server confirmed insufficient permissions');
          router.push('/');
        }
      } else {
        console.log('Admin page - Failed to check user role with server');
        router.push('/');
      }
    } catch (error) {
      console.error('Admin page - Error checking user role:', error);
      router.push('/');
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      console.log('Admin page - Session data:', session);
      console.log('Admin page - Access token:', session?.accessToken);

      if (!session?.accessToken) {
        console.error('No access token in session');
        setLoading(false);
        return;
      }

      // 모바일에서 작동하는 백엔드 URL 가져오기
      const getBackendUrl = () => {
        console.log('🔍 Backend URL detection debug:');
        console.log('- User Agent:', navigator.userAgent);
        console.log('- workingBackendUrl:', (window as any).workingBackendUrl);

        // 1. 모바일에서 감지된 백엔드 URL 우선 사용
        if ((window as any).workingBackendUrl) {
          console.log('✅ Using workingBackendUrl:', (window as any).workingBackendUrl);
          return (window as any).workingBackendUrl;
        }

        // 2. 모바일 감지 시 가능한 백엔드 URL 목록
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        console.log('- Is Mobile:', isMobile);

        if (isMobile) {
          const possibleUrls = [
            'http://192.168.1.97:3001',
            'http://192.168.1.126:3001',
            'http://192.168.1.100:3001',
            'http://10.0.0.1:3001',
            'http://localhost:3001',
          ];
          console.log('📱 Mobile detected, using first IP:', possibleUrls[0]);
          return possibleUrls[0]; // 첫 번째 IP 사용
        }

        // 3. 데스크톱에서는 localhost 사용
        console.log('💻 Desktop detected, using localhost');
        return 'http://localhost:3001';
      };

      const backendUrl = getBackendUrl();
      console.log('Admin page - Using backend URL:', backendUrl);

      const response = await fetch(`/api/admin/dashboard?backendUrl=${encodeURIComponent(backendUrl)}`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('대시보드 데이터 로드 실패:', error);
    }
    setLoading(false);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      // 모바일에서 작동하는 백엔드 URL 가져오기
      const getBackendUrl = () => {
        if ((window as any).workingBackendUrl) {
          return (window as any).workingBackendUrl;
        }
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          return 'http://192.168.1.97:3001';
        }
        return 'http://localhost:3001';
      };
      const backendUrl = getBackendUrl();

      const response = await fetch(`/api/admin/users?backendUrl=${encodeURIComponent(backendUrl)}`, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error('사용자 데이터 로드 실패:', error);
    }
    setLoading(false);
  };

  const loadRooms = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/rooms', {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error('룸 데이터 로드 실패:', error);
    }
    setLoading(false);
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/messages', {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('메시지 데이터 로드 실패:', error);
    }
    setLoading(false);
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}일 ${hours}시간 ${minutes}분`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  // 차트 데이터 생성 함수들
  const generateUserActivityChart = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }).reverse();

    // 실제 사용자 데이터가 있으면 사용, 없으면 더미 데이터 생성
    let userCounts;
    if (users.length > 0) {
      // 실제 사용자 생성일 기준으로 데이터 생성
      userCounts = last7Days.map((_, index) => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - (6 - index));
        return users.filter((user) => {
          const userDate = new Date(user.createdAt);
          return userDate.toDateString() === targetDate.toDateString();
        }).length;
      });
    } else {
      // 더미 데이터 생성
      userCounts = last7Days.map(() => Math.floor(Math.random() * 10) + 1);
    }

    return {
      labels: last7Days,
      datasets: [
        {
          label: '신규 사용자',
          data: userCounts,
          backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.5)',
          borderColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.9)' : 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  };

  const generateMessageDistributionChart = () => {
    let userMessages, assistantMessages;

    if (messages.length > 0) {
      userMessages = messages.filter((msg) => msg.role === 'user').length;
      assistantMessages = messages.filter((msg) => msg.role === 'assistant').length;
    } else {
      // 더미 데이터 생성
      userMessages = Math.floor(Math.random() * 50) + 20;
      assistantMessages = Math.floor(Math.random() * 50) + 20;
    }

    return {
      labels: ['사용자 메시지', 'AI 응답'],
      datasets: [
        {
          data: [userMessages, assistantMessages],
          backgroundColor:
            theme === 'dark'
              ? ['rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)']
              : ['rgba(59, 130, 246, 0.7)', 'rgba(16, 185, 129, 0.7)'],
          borderColor:
            theme === 'dark'
              ? ['rgba(59, 130, 246, 1)', 'rgba(16, 185, 129, 1)']
              : ['rgba(59, 130, 246, 0.9)', 'rgba(16, 185, 129, 0.9)'],
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    };
  };

  const generateRoomActivityChart = () => {
    let roomNames, messageCounts;

    if (rooms.length > 0) {
      roomNames = rooms
        .slice(0, 5)
        .map((room) => (room.name.length > 10 ? room.name.substring(0, 10) + '...' : room.name));
      messageCounts = rooms.slice(0, 5).map((room) => room.messageCount);
    } else {
      // 더미 데이터 생성
      roomNames = ['일반 채팅', '기술 문의', '고객 지원', '개발팀', '마케팅'];
      messageCounts = [25, 18, 32, 15, 28];
    }

    return {
      labels: roomNames,
      datasets: [
        {
          label: '메시지 수',
          data: messageCounts,
          backgroundColor: theme === 'dark' ? 'rgba(168, 85, 247, 0.6)' : 'rgba(168, 85, 247, 0.5)',
          borderColor: theme === 'dark' ? 'rgba(168, 85, 247, 0.9)' : 'rgba(168, 85, 247, 1)',
          borderWidth: 2,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  };

  // 시간대별 활동 패턴 차트
  const generateHourlyActivityChart = () => {
    const hours = Array.from({ length: 24 }, (_, i) => `${i}시`);
    const hourlyData = Array.from({ length: 24 }, () => Math.floor(Math.random() * 20) + 5);

    return {
      labels: hours,
      datasets: [
        {
          label: '활동량',
          data: hourlyData,
          borderColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.9)' : 'rgba(59, 130, 246, 1)',
          backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
      ],
    };
  };

  // 사용자 행동 분석 차트
  const generateUserBehaviorChart = () => {
    const behaviors = ['신규 가입', '첫 메시지', '룸 참여', 'AI 상호작용', '장기 사용자'];
    const counts = [25, 20, 18, 15, 12];

    return {
      labels: behaviors,
      datasets: [
        {
          label: '사용자 수',
          data: counts,
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
          ],
          borderColor: [
            'rgba(34, 197, 94, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(168, 85, 247, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(239, 68, 68, 1)',
          ],
          borderWidth: 1,
        },
      ],
    };
  };

  // 메시지 길이 분포 차트
  const generateMessageLengthChart = () => {
    const lengthRanges = ['1-50자', '51-100자', '101-200자', '201-500자', '500자+'];
    const counts = [35, 28, 20, 12, 5];

    return {
      labels: lengthRanges,
      datasets: [
        {
          label: '메시지 수',
          data: counts,
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
          ],
          borderColor: [
            'rgba(34, 197, 94, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(168, 85, 247, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(239, 68, 68, 1)',
          ],
          borderWidth: 1,
        },
      ],
    };
  };

  const getChartOptions = (title: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: theme === 'dark' ? '#e5e7eb' : '#374151',
          font: {
            size: 12,
            weight: 'bold' as const,
          },
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      title: {
        display: !!title,
        text: title,
        color: theme === 'dark' ? '#e5e7eb' : '#374151',
        font: {
          size: 14,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#e5e7eb' : '#374151',
        bodyColor: theme === 'dark' ? '#e5e7eb' : '#374151',
        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        titleFont: {
          size: 12,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 11,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: theme === 'dark' ? '#d1d5db' : '#6b7280',
          font: {
            size: 11,
            weight: 'bold' as const,
          },
        },
        grid: {
          color: theme === 'dark' ? '#374151' : '#f3f4f6',
          drawBorder: false,
        },
        border: {
          color: theme === 'dark' ? '#374151' : '#e5e7eb',
        },
      },
      y: {
        ticks: {
          color: theme === 'dark' ? '#d1d5db' : '#6b7280',
          font: {
            size: 11,
            weight: 'bold' as const,
          },
        },
        grid: {
          color: theme === 'dark' ? '#374151' : '#f3f4f6',
          drawBorder: false,
        },
        border: {
          color: theme === 'dark' ? '#374151' : '#e5e7eb',
        },
      },
    },
  });

  const getDoughnutChartOptions = (legendPosition: 'top' | 'bottom' = 'bottom') => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: legendPosition,
        labels: {
          color: theme === 'dark' ? '#e5e7eb' : '#374151',
          font: {
            size: 12,
            weight: 'bold' as const,
          },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#e5e7eb' : '#374151',
        bodyColor: theme === 'dark' ? '#e5e7eb' : '#374151',
        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        titleFont: {
          size: 12,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 11,
        },
        callbacks: {
          label: function (context: any) {
            const label = context.label || '';
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  });

  // 사용자 관리 함수들
  const handleCreateUser = async (userData: typeof newUser) => {
    try {
      // 모바일에서 작동하는 백엔드 URL 가져오기
      const getBackendUrl = () => {
        if ((window as any).workingBackendUrl) {
          return (window as any).workingBackendUrl;
        }
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          return 'http://192.168.1.97:3001';
        }
        return 'http://localhost:3001';
      };
      const backendUrl = getBackendUrl();

      const response = await fetch(`/api/admin/users?backendUrl=${encodeURIComponent(backendUrl)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        setShowCreateUserModal(false);
        setNewUser({ name: '', email: '', password: '', role: 'USER', isActive: true });
        loadDashboardData();
        alert('사용자가 성공적으로 생성되었습니다.');
      } else {
        const error = await response.json();
        alert(`사용자 생성 실패: ${error.message || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('사용자 생성 실패:', error);
      alert('사용자 생성 중 오류가 발생했습니다.');
    }
  };

  const handleEditUser = (user: UserStats) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleDeleteUser = async (userId: string) => {
    const userToDelete = users.find((user) => user.id === userId);
    if (!userToDelete) {
      alert('삭제할 사용자를 찾을 수 없습니다.');
      return;
    }

    const confirmMessage = `정말로 사용자 "${userToDelete.name} (${userToDelete.email})"을(를) 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없으며, 사용자의 모든 메시지와 데이터가 영구적으로 삭제됩니다.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      console.log('사용자 삭제 시작:', { userId, userName: userToDelete.name, userEmail: userToDelete.email });

      // 모바일에서 작동하는 백엔드 URL 가져오기
      const getBackendUrl = () => {
        if ((window as any).workingBackendUrl) {
          return (window as any).workingBackendUrl;
        }
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          return 'http://192.168.1.97:3001';
        }
        return 'http://localhost:3001';
      };
      const backendUrl = getBackendUrl();

      console.log('사용자 삭제 요청 URL:', `/api/admin/users/${userId}?backendUrl=${encodeURIComponent(backendUrl)}`);

      const response = await fetch(`/api/admin/users/${userId}?backendUrl=${encodeURIComponent(backendUrl)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('사용자 삭제 응답 상태:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('사용자 삭제 성공:', result);

        // 사용자 목록에서 제거
        setUsers(users.filter((user) => user.id !== userId));

        // 성공 메시지 표시
        alert(`사용자 "${userToDelete.name}"이(가) 성공적으로 삭제되었습니다.`);
      } else {
        const errorData = await response.json();
        console.error('사용자 삭제 실패:', errorData);
        alert(`사용자 삭제에 실패했습니다: ${errorData.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('사용자 삭제 중 오류:', error);
      alert(`사용자 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  const handleUpdateUser = async (updatedUser: Partial<UserStats>) => {
    if (!editingUser) return;

    setIsUpdatingUser(true);
    try {
      console.log('사용자 정보 업데이트 시작:', { userId: editingUser.id, updates: updatedUser });

      // 모바일에서 작동하는 백엔드 URL 가져오기
      const getBackendUrl = () => {
        if ((window as any).workingBackendUrl) {
          return (window as any).workingBackendUrl;
        }
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          return 'http://192.168.1.97:3001';
        }
        return 'http://localhost:3001';
      };
      const backendUrl = getBackendUrl();

      // 역할 변경이 포함된 경우 별도 API 호출
      if (updatedUser.role && updatedUser.role !== editingUser.role) {
        console.log('역할 변경 요청:', { userId: editingUser.id, newRole: updatedUser.role });

        const roleResponse = await fetch(`${backendUrl}/admin/users/${editingUser.id}/role`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.accessToken}`,
          },
          body: JSON.stringify({ role: updatedUser.role }),
        });

        if (!roleResponse.ok) {
          const errorData = await roleResponse.json();
          console.error('역할 변경 실패:', errorData);
          alert(`역할 변경에 실패했습니다: ${errorData.message || '알 수 없는 오류'}`);
          return;
        }

        console.log('역할 변경 성공');
      }

      // 나머지 정보 업데이트
      const response = await fetch(`/api/admin/users/${editingUser.id}?backendUrl=${encodeURIComponent(backendUrl)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify(updatedUser),
      });

      console.log('사용자 정보 업데이트 응답 상태:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('사용자 정보 업데이트 성공:', result);

        setUsers(users.map((user) => (user.id === editingUser.id ? { ...user, ...updatedUser } : user)));
        setShowUserModal(false);
        setEditingUser(null);

        // 성공 메시지 표시
        const changes = [];
        if (updatedUser.name && updatedUser.name !== editingUser.name)
          changes.push(`이름: ${editingUser.name} → ${updatedUser.name}`);
        if (updatedUser.email && updatedUser.email !== editingUser.email)
          changes.push(`이메일: ${editingUser.email} → ${updatedUser.email}`);
        if (updatedUser.role && updatedUser.role !== editingUser.role)
          changes.push(`역할: ${editingUser.role} → ${updatedUser.role}`);
        if (updatedUser.isActive !== undefined && updatedUser.isActive !== editingUser.isActive)
          changes.push(
            `상태: ${editingUser.isActive ? '활성' : '비활성'} → ${updatedUser.isActive ? '활성' : '비활성'}`,
          );

        alert(`사용자 정보가 성공적으로 업데이트되었습니다.\n\n변경사항:\n${changes.join('\n')}`);
      } else {
        const errorData = await response.json();
        console.error('사용자 정보 업데이트 실패:', errorData);
        alert(`사용자 정보 업데이트에 실패했습니다: ${errorData.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('사용자 업데이트 중 오류:', error);
      alert(
        `사용자 정보 업데이트 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      );
    } finally {
      setIsUpdatingUser(false);
    }
  };

  // 룸 관리 함수들
  const handleEditRoom = (room: RoomStats) => {
    setEditingRoom(room);
    setShowRoomModal(true);
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('정말로 이 채팅방을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (response.ok) {
        setRooms(rooms.filter((room) => room.id !== roomId));
        alert('채팅방이 삭제되었습니다.');
      } else {
        alert('채팅방 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('채팅방 삭제 실패:', error);
      alert('채팅방 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateRoom = async (updatedRoom: Partial<RoomStats>) => {
    if (!editingRoom) return;

    try {
      const response = await fetch(`/api/admin/rooms/${editingRoom.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify(updatedRoom),
      });

      if (response.ok) {
        setRooms(rooms.map((room) => (room.id === editingRoom.id ? { ...room, ...updatedRoom } : room)));
        setShowRoomModal(false);
        setEditingRoom(null);
        alert('채팅방 정보가 업데이트되었습니다.');
      } else {
        alert('채팅방 정보 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('채팅방 업데이트 실패:', error);
      alert('채팅방 정보 업데이트 중 오류가 발생했습니다.');
    }
  };

  if (status === 'loading' || loading || !mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* 헤더 */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">관리자 대시보드</h1>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {session?.user?.name} ({session?.user?.role})
                </span>
              </div>
              <div className="flex flex-row gap-2 w-full sm:w-auto">
                <button
                  onClick={() => router.push('/monitoring')}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-sm"
                >
                  모니터링
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-sm"
                >
                  채팅으로 돌아가기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 탭 네비게이션 */}
        <div className="mb-8">
          <nav className="flex space-x-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-2 shadow-sm">
            {[
              { id: 'dashboard', name: '대시보드' },
              { id: 'users', name: '사용자 관리' },
              { id: 'rooms', name: '룸 관리' },
              { id: 'messages', name: '메시지 관리' },
              { id: 'conversations', name: '대화 로그' },
              { id: 'errors', name: '에러 로그' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'users') loadUsers();
                  if (tab.id === 'rooms') loadRooms();
                  if (tab.id === 'messages') loadMessages();
                }}
                className={`py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white shadow-md dark:bg-blue-600'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* 대시보드 탭 */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            {/* 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center">
                  <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 rounded-xl shadow-sm">
                    <svg
                      className="w-6 h-6 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">총 사용자</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center">
                  <div className="p-3 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/40 dark:to-green-800/40 rounded-xl shadow-sm">
                    <svg
                      className="w-6 h-6 text-green-600 dark:text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">활성 사용자</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.activeUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center">
                  <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/40 dark:to-purple-800/40 rounded-xl shadow-sm">
                    <svg
                      className="w-6 h-6 text-purple-600 dark:text-purple-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">총 룸</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalRooms}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center">
                  <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/40 dark:to-orange-800/40 rounded-xl shadow-sm">
                    <svg
                      className="w-6 h-6 text-orange-600 dark:text-orange-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">총 메시지</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalMessages}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 시스템 상태 */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">시스템 상태</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center">
                  <div
                    className={`w-3 h-3 rounded-full mr-3 ${stats.systemHealth.database ? 'bg-green-500' : 'bg-red-500'}`}
                  ></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">데이터베이스</span>
                </div>
                <div className="flex items-center">
                  <div
                    className={`w-3 h-3 rounded-full mr-3 ${stats.systemHealth.redis ? 'bg-green-500' : 'bg-red-500'}`}
                  ></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">Redis</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-3 bg-blue-500"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    업타임: {formatUptime(stats.systemHealth.uptime)}
                  </span>
                </div>
              </div>
            </div>

            {/* 차트 섹션 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* 사용자 활동 차트 */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">최근 7일 사용자 활동</h3>
                <div className="h-64">
                  <Bar data={generateUserActivityChart()} options={getChartOptions('')} />
                </div>
              </div>

              {/* 메시지 분포 차트 */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">메시지 분포</h3>
                <div className="h-64">
                  <Doughnut data={generateMessageDistributionChart()} options={getDoughnutChartOptions('bottom')} />
                </div>
              </div>
            </div>

            {/* 추가 차트 섹션 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* 채팅방 활동 차트 */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">상위 채팅방 활동</h3>
                <div className="h-64">
                  <Bar data={generateRoomActivityChart()} options={getChartOptions('')} />
                </div>
              </div>

              {/* 시스템 상태 차트 */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">시스템 상태</h3>
                <div className="h-64">
                  <Doughnut
                    data={{
                      labels: ['데이터베이스', 'Redis', 'API 서버'],
                      datasets: [
                        {
                          data: [
                            stats.systemHealth.database ? 100 : 0,
                            stats.systemHealth.redis ? 100 : 0,
                            100, // API 서버는 항상 정상으로 가정
                          ],
                          backgroundColor: [
                            stats.systemHealth.database
                              ? theme === 'dark'
                                ? 'rgba(34, 197, 94, 0.8)'
                                : 'rgba(34, 197, 94, 0.7)'
                              : theme === 'dark'
                                ? 'rgba(239, 68, 68, 0.8)'
                                : 'rgba(239, 68, 68, 0.7)',
                            stats.systemHealth.redis
                              ? theme === 'dark'
                                ? 'rgba(34, 197, 94, 0.8)'
                                : 'rgba(34, 197, 94, 0.7)'
                              : theme === 'dark'
                                ? 'rgba(239, 68, 68, 0.8)'
                                : 'rgba(239, 68, 68, 0.7)',
                            theme === 'dark' ? 'rgba(34, 197, 94, 0.8)' : 'rgba(34, 197, 94, 0.7)',
                          ],
                          borderColor: [
                            stats.systemHealth.database
                              ? theme === 'dark'
                                ? 'rgba(34, 197, 94, 1)'
                                : 'rgba(34, 197, 94, 0.9)'
                              : theme === 'dark'
                                ? 'rgba(239, 68, 68, 1)'
                                : 'rgba(239, 68, 68, 0.9)',
                            stats.systemHealth.redis
                              ? theme === 'dark'
                                ? 'rgba(34, 197, 94, 1)'
                                : 'rgba(34, 197, 94, 0.9)'
                              : theme === 'dark'
                                ? 'rgba(239, 68, 68, 1)'
                                : 'rgba(239, 68, 68, 0.9)',
                            theme === 'dark' ? 'rgba(34, 197, 94, 1)' : 'rgba(34, 197, 94, 0.9)',
                          ],
                          borderWidth: 2,
                          hoverOffset: 4,
                        },
                      ],
                    }}
                    options={getDoughnutChartOptions('bottom')}
                  />
                </div>
              </div>
            </div>

            {/* 고급 통계 차트 섹션 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* 시간대별 활동 패턴 */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">시간대별 활동 패턴</h3>
                <div className="h-64">
                  <Bar data={generateHourlyActivityChart()} options={getChartOptions('')} />
                </div>
              </div>

              {/* 사용자 행동 분석 */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">사용자 행동 분석</h3>
                <div className="h-64">
                  <Bar data={generateUserBehaviorChart()} options={getChartOptions('')} />
                </div>
              </div>
            </div>

            {/* 메시지 분석 섹션 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* 메시지 길이 분포 */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">메시지 길이 분포</h3>
                <div className="h-64">
                  <Doughnut data={generateMessageLengthChart()} options={getDoughnutChartOptions('bottom')} />
                </div>
              </div>

              {/* 사용자 참여도 분석 */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">사용자 참여도 분석</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">활성 사용자</span>
                    <span className="text-lg font-semibold text-green-600">{stats.activeUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">온라인 사용자</span>
                    <span className="text-lg font-semibold text-blue-600">{stats.onlineUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">평균 메시지/사용자</span>
                    <span className="text-lg font-semibold text-purple-600">
                      {stats.totalUsers > 0 ? Math.round(stats.totalMessages / stats.totalUsers) : 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">평균 메시지/룸</span>
                    <span className="text-lg font-semibold text-orange-600">
                      {stats.totalRooms > 0 ? Math.round(stats.totalMessages / stats.totalRooms) : 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 사용자 관리 탭 */}
        {activeTab === 'users' && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">사용자 관리</h3>
                <button
                  onClick={() => setShowCreateUserModal(true)}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  새 사용자 생성
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      사용자
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      역할
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      메시지 수
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      가입일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-700/80 transition-colors duration-200"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'SUPER_ADMIN'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                              : user.role === 'ADMIN'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.isActive
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          }`}
                        >
                          {user.isActive ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {user.messageCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 px-3 py-1 rounded-md text-sm font-medium mr-2 transition-all duration-200"
                        >
                          편집
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 px-3 py-1 rounded-md text-sm font-medium transition-all duration-200"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 룸 관리 탭 */}
        {activeTab === 'rooms' && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">룸 관리</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      룸 이름
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      설명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      메시지 수
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      생성일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      마지막 활동
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {rooms.map((room) => (
                    <tr
                      key={room.id}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-700/80 transition-colors duration-200"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {room.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{room.description || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {room.messageCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(room.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {room.lastActivity ? formatDate(room.lastActivity) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEditRoom(room)}
                          className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 px-3 py-1 rounded-md text-sm font-medium mr-2 transition-all duration-200"
                        >
                          편집
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 px-3 py-1 rounded-md text-sm font-medium transition-all duration-200"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 메시지 관리 탭 */}
        {activeTab === 'messages' && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">최근 메시지</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      메시지
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      사용자
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      룸
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      역할
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      시간
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {messages.map((message) => (
                    <tr
                      key={message.id}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-700/80 transition-colors duration-200"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                        {message.content}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {message.userName || '시스템'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {message.roomName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            message.role === 'user'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                              : message.role === 'assistant'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {message.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(message.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 대화 로그 탭 */}
        {activeTab === 'conversations' && <ConversationLogs onSelectRoom={setSelectedRoomId} />}

        {/* 에러 로그 탭 */}
        {activeTab === 'errors' && <ErrorLogs />}
      </div>

      {/* 대화 스레드 모달 */}
      {selectedRoomId && <ConversationThread roomId={selectedRoomId} onClose={() => setSelectedRoomId(null)} />}

      {/* 사용자 편집 모달 */}
      {showUserModal && editingUser && (
        <div className="fixed inset-0 bg-gray-600/50 dark:bg-gray-900/75 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200/50 dark:border-gray-700/50 w-96 shadow-2xl rounded-xl bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">사용자 편집</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleUpdateUser({
                    name: formData.get('name') as string,
                    email: formData.get('email') as string,
                    role: formData.get('role') as 'USER' | 'ADMIN' | 'SUPER_ADMIN',
                    isActive: formData.get('isActive') === 'true',
                  });
                }}
              >
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">이름</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingUser.name}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">이메일</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingUser.email}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">역할</label>
                  <select
                    name="role"
                    defaultValue={editingUser.role}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
                  >
                    <option value="USER">사용자</option>
                    <option value="ADMIN">관리자</option>
                    <option value="SUPER_ADMIN">최고관리자</option>
                  </select>
                  {editingUser.id === session?.user?.id && (
                    <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start">
                        <svg
                          className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div className="text-sm text-yellow-800 dark:text-yellow-200">
                          <p className="font-medium">주의사항</p>
                          <p>자신의 권한은 변경할 수 없습니다. 다른 관리자에게 요청하세요.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">상태</label>
                  <select
                    name="isActive"
                    defaultValue={editingUser.isActive ? 'true' : 'false'}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
                  >
                    <option value="true">활성</option>
                    <option value="false">비활성</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserModal(false);
                      setEditingUser(null);
                    }}
                    disabled={isUpdatingUser}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingUser}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg ${
                      isUpdatingUser
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                    }`}
                  >
                    {isUpdatingUser ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        저장 중...
                      </div>
                    ) : (
                      '저장'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 룸 편집 모달 */}
      {showRoomModal && editingRoom && (
        <div className="fixed inset-0 bg-gray-600/50 dark:bg-gray-900/75 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200/50 dark:border-gray-700/50 w-96 shadow-2xl rounded-xl bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">채팅방 편집</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleUpdateRoom({
                    name: formData.get('name') as string,
                    description: formData.get('description') as string,
                  });
                }}
              >
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">채팅방 이름</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingRoom.name}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">설명</label>
                  <textarea
                    name="description"
                    defaultValue={editingRoom.description || ''}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRoomModal(false);
                      setEditingRoom(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    저장
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 사용자 생성 모달 */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-gray-600/50 dark:bg-gray-900/75 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200/50 dark:border-gray-700/50 w-96 shadow-2xl rounded-xl bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">새 사용자 생성</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateUser(newUser);
              }}
            >
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">이름</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">이메일</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">비밀번호</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                  minLength={6}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">역할</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'USER' | 'ADMIN' | 'SUPER_ADMIN' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="USER">사용자</option>
                  <option value="ADMIN">관리자</option>
                  <option value="SUPER_ADMIN">최고 관리자</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newUser.isActive}
                    onChange={(e) => setNewUser({ ...newUser, isActive: e.target.checked })}
                    className="mr-2 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-700"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">활성 상태</span>
                </label>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
