import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../lib/auth';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/admin/users/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ error: '사용자 정보를 업데이트할 수 없습니다.' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('사용자 업데이트 API 에러:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id } = await params;
    console.log('사용자 삭제 API 호출:', { userId: id });

    // 쿼리 파라미터에서 백엔드 URL 가져오기
    const { searchParams } = new URL(request.url);
    const backendUrl = searchParams.get('backendUrl') || process.env.BACKEND_URL || 'http://localhost:3001';
    console.log('사용자 삭제 API - Backend URL:', backendUrl);

    const response = await fetch(`${backendUrl}/admin/users/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('사용자 삭제 API 응답 상태:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('사용자 삭제 API 오류:', errorData);
      return NextResponse.json(
        {
          error: errorData.message || '사용자를 삭제할 수 없습니다.',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    console.log('사용자 삭제 API 성공:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('사용자 삭제 API 에러:', error);
    return NextResponse.json(
      {
        error: `서버 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      },
      { status: 500 },
    );
  }
}
