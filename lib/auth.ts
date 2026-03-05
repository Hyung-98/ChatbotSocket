import type { AuthOptions } from 'next-auth';
import type { Adapter, AdapterUser, AdapterSession, AdapterAccount } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHubProvider from 'next-auth/providers/github';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Custom Prisma Adapter (Prisma 7 호환, @next-auth/prisma-adapter 미사용)
// ---------------------------------------------------------------------------
function buildPrismaAdapter(): Adapter {
  return {
    async createUser({ name, email, emailVerified, image }: Omit<AdapterUser, 'id'>) {
      const user = await prisma.user.create({ data: { name, email, emailVerified, image } });
      return user as AdapterUser;
    },
    async getUser(id) {
      const user = await prisma.user.findUnique({ where: { id } });
      return (user as AdapterUser | null);
    },
    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({ where: { email } });
      return (user as AdapterUser | null);
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const account = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true },
      });
      return (account?.user ?? null) as AdapterUser | null;
    },
    async updateUser({ id, name, email, emailVerified, image }: Partial<AdapterUser> & { id: string }) {
      const user = await prisma.user.update({ where: { id }, data: { name, email, emailVerified, image } });
      return user as AdapterUser;
    },
    async deleteUser(id) {
      await prisma.user.delete({ where: { id } });
    },
    async linkAccount({ userId, type, provider, providerAccountId, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state }: AdapterAccount) {
      await prisma.account.create({ data: { userId, type, provider, providerAccountId, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state } });
    },
    async unlinkAccount({ provider, providerAccountId }: Pick<AdapterAccount, 'provider' | 'providerAccountId'>) {
      await prisma.account.delete({
        where: { provider_providerAccountId: { provider, providerAccountId } },
      });
    },
    async createSession(data) {
      const session = await prisma.session.create({ data });
      return session as AdapterSession;
    },
    async getSessionAndUser(sessionToken) {
      const result = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });
      if (!result) return null;
      const { user, ...session } = result;
      return { session: session as AdapterSession, user: user as AdapterUser };
    },
    async updateSession(data) {
      const session = await prisma.session.update({
        where: { sessionToken: data.sessionToken },
        data,
      });
      return session as AdapterSession;
    },
    async deleteSession(sessionToken) {
      await prisma.session.delete({ where: { sessionToken } });
    },
    async createVerificationToken(data) {
      return prisma.verificationToken.create({ data });
    },
    async useVerificationToken({ identifier, token }) {
      try {
        return await prisma.verificationToken.delete({
          where: { identifier_token: { identifier, token } },
        });
      } catch {
        return null;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// AuthOptions
// ---------------------------------------------------------------------------
export const authOptions: AuthOptions = {
  adapter: buildPrismaAdapter(),
  session: { strategy: 'jwt' }, // CredentialsProvider는 JWT 전략 필요
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
