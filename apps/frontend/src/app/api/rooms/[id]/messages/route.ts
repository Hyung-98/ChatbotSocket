import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';

    const response = await fetch(
      `${process.env.BACKEND_URL || 'http://localhost:3001'}/rooms/${id}/messages?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json({ error: '메시지를 가져올 수 없습니다.' }, { status: response.status });
    }

    const data = await response.json();
    // 백엔드에서 { messages: [...], total, skip, take, room } 형태로 반환하므로 messages 배열만 추출
    const messages = data.messages || [];

    // 백엔드 메시지 형태를 프론트엔드 형태로 변환
    const transformedMessages = messages.map((msg: any) => ({
      id: msg.id,
      userId: msg.userId,
      userName: msg.user?.name || msg.user?.email || 'Unknown',
      text: msg.content,
      roomId: msg.roomId,
      timestamp: msg.createdAt,
    }));

    return NextResponse.json(transformedMessages);
  } catch (error) {
    console.error('메시지 API 에러:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
