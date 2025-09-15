import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json({ error: '리프레시 토큰이 필요합니다.' }, { status: 400 });
    }

    // 백엔드에서 토큰 갱신 요청
    const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: error.message || '토큰 갱신에 실패했습니다.' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('토큰 갱신 API 에러:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
