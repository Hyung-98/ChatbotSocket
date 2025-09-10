import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, auth, signIn, signOut } = NextAuth({
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

          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/login`, {
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
          console.log('백엔드 로그인 성공:', { id: data.id, email: data.email, name: data.name });

          if (data.accessToken) {
            return {
              id: data.id,
              email: data.email,
              name: data.name,
              accessToken: data.accessToken,
            };
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
        token.id = user.id;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.accessToken = token.accessToken as string;
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
