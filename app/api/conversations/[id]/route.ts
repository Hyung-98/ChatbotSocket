import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: { id: string } };

export async function GET(_request: Request, context: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id, userId: session.user.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    return NextResponse.json(conversation);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('GET /api/conversations/[id] error:', msg);
    if (msg.includes('RecordNotFound') || msg.includes('P2025') || msg.includes('No')) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const body = await request.json();
    const data: { title?: string; systemPrompt?: string } = {};
    if (typeof body.title === 'string') data.title = body.title;
    if (typeof body.systemPrompt === 'string') data.systemPrompt = body.systemPrompt;

    const conversation = await prisma.conversation.update({
      where: { id, userId: session.user.id },
      data,
    });
    return NextResponse.json(conversation);
  } catch (error) {
    console.error('PATCH /api/conversations/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    await prisma.conversation.delete({ where: { id, userId: session.user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/conversations/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}
