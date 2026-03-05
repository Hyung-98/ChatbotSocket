import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ChatInterface } from '@/components/ChatInterface';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;

  let conversation = await prisma.conversation.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { title: '새 대화', userId },
      include: { messages: true },
    });
  }

  const serialized = JSON.parse(JSON.stringify(conversation));

  return <ChatInterface initialConversation={serialized} />;
}
