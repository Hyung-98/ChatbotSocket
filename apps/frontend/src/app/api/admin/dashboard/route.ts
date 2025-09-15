import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    console.log('Admin dashboard API - Authorization header:', authHeader);

    if (!authHeader) {
      console.log('Admin dashboard API - No authorization header');
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 쿼리 파라미터에서 백엔드 URL 가져오기
    const { searchParams } = new URL(request.url);
    const backendUrl = searchParams.get('backendUrl') || process.env.BACKEND_URL || 'http://localhost:3001';
    console.log('Admin dashboard API - Backend URL:', backendUrl);

    const response = await fetch(`${backendUrl}/admin/dashboard`, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    console.log('Admin dashboard API - Backend response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Admin dashboard API - Backend error:', errorText);
      return NextResponse.json({ error: '대시보드 데이터를 가져올 수 없습니다.' }, { status: response.status });
    }

    const data = await response.json();
    console.log('Admin dashboard API - Backend data:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('대시보드 API 에러:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
