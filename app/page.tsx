import { prisma } from '@/lib/prisma';
import { ChatInterface } from '@/components/ChatInterface';

// This page queries the database on every request — disable static prerendering
// so next build doesn't try to connect to a DB that doesn't exist at build time.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let conversation = await prisma.conversation.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { title: '새 대화' },
      include: { messages: true },
    });
  }

  // Date → string 직렬화 (Server→Client 경계)
  const serialized = JSON.parse(JSON.stringify(conversation));

  return <ChatInterface initialConversation={serialized} />;
}
