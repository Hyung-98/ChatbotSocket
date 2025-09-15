import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('인증 실패: 이메일 또는 비밀번호가 없음');
          return null;
        }

        try {
          console.log('백엔드 로그인 API 호출:', { email: credentials.email });

          // 백엔드 URL 설정 (서버 사이드에서 안전하게)
          const getBackendUrl = () => {
            // 환경 변수에서 직접 가져오기
            return process.env.BACKEND_URL || 'http://localhost:3001';
          };

          const response = await fetch(`${getBackendUrl()}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          console.log('백엔드 응답 상태:', response.status);

          if (!response.ok) {
            const errorData = await response.text();
            console.error('백엔드 로그인 실패:', response.status, errorData);
            return null;
          }

          const data = await response.json();
          console.log('백엔드 로그인 성공:', { id: data.id, email: data.email, name: data.name, role: data.role });

          if (data.accessToken) {
            const userData = {
              id: data.id,
              email: data.email,
              name: data.name,
              role: data.role,
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
            };
            console.log('NextAuth에 전달할 사용자 데이터:', userData);
            return userData;
          }
        } catch (error) {
          console.error('백엔드 로그인 오류:', error);
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        console.log('JWT 콜백 - 사용자 데이터:', user);
        token.id = user.id;
        token.role = user.role;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        console.log('JWT 콜백 - 토큰 데이터:', token);
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        console.log('세션 콜백 - 토큰 데이터:', token);
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.accessToken = token.accessToken as string;
        session.refreshToken = token.refreshToken as string;
        console.log('세션 콜백 - 최종 세션 데이터:', session);
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handlers, auth, signIn, signOut };
