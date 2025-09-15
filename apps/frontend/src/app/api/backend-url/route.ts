import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // User-Agent에서 모바일 감지
    const userAgent = request.headers.get('user-agent') || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    // 환경 변수에서 백엔드 URL 가져오기
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const mobileBackendUrl = process.env.MOBILE_BACKEND_URL || 'http://192.168.1.97:3001';

    // 모바일이면 모바일 URL, 아니면 기본 URL 반환
    const selectedUrl = isMobile ? mobileBackendUrl : backendUrl;

    return NextResponse.json({
      backendUrl: selectedUrl,
      isMobile,
      userAgent: userAgent.substring(0, 100), // 디버깅용
    });
  } catch (error) {
    console.error('Backend URL API error:', error);
    return NextResponse.json({ error: 'Failed to get backend URL' }, { status: 500 });
  }
}
