import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../lib/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/rooms`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: '채팅방 목록을 가져올 수 없습니다.' }, { status: response.status });
    }

    const data = await response.json();
    // 백엔드에서 { rooms: [...], total, skip, take } 형태로 반환하므로 rooms 배열만 추출
    return NextResponse.json(data.rooms || []);
  } catch (error) {
    console.error('채팅방 목록 API 에러:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/rooms`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ error: '채팅방을 생성할 수 없습니다.' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('채팅방 생성 API 에러:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
