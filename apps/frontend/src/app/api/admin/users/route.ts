import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 쿼리 파라미터에서 백엔드 URL 가져오기
    const { searchParams } = new URL(request.url);
    const backendUrl = searchParams.get('backendUrl') || process.env.BACKEND_URL || 'http://localhost:3001';
    console.log('Admin users API - Backend URL:', backendUrl);

    const response = await fetch(`${backendUrl}/admin/users`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || '사용자 목록을 가져오는데 실패했습니다.' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('사용자 목록 API 에러:', error);
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

    // 필수 필드 검증
    if (!body.name || !body.email || !body.password) {
      return NextResponse.json({ error: '이름, 이메일, 비밀번호는 필수입니다.' }, { status: 400 });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({ error: '올바른 이메일 형식이 아닙니다.' }, { status: 400 });
    }

    // 비밀번호 길이 검증
    if (body.password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' }, { status: 400 });
    }

    const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: error.message || '사용자 생성에 실패했습니다.' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('사용자 생성 API 에러:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // URL에서 userId 추출
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];

    if (!userId) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
    }

    // 쿼리 파라미터에서 백엔드 URL 가져오기
    const { searchParams } = new URL(request.url);
    const backendUrl = searchParams.get('backendUrl') || process.env.BACKEND_URL || 'http://localhost:3001';
    console.log('Admin users DELETE API - Backend URL:', backendUrl);

    const response = await fetch(`${backendUrl}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: error.message || '사용자 삭제에 실패했습니다.' }, { status: response.status });
    }

    return NextResponse.json({ message: '사용자가 삭제되었습니다.' });
  } catch (error) {
    console.error('사용자 삭제 API 에러:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // URL에서 userId 추출
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];

    if (!userId) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
    }

    const body = await request.json();

    // 쿼리 파라미터에서 백엔드 URL 가져오기
    const { searchParams } = new URL(request.url);
    const backendUrl = searchParams.get('backendUrl') || process.env.BACKEND_URL || 'http://localhost:3001';
    console.log('Admin users PATCH API - Backend URL:', backendUrl);

    const response = await fetch(`${backendUrl}/admin/users/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || '사용자 업데이트에 실패했습니다.' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('사용자 업데이트 API 에러:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
