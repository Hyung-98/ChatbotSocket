const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/chatbot_socket?schema=public',
    },
  },
});

async function createTestData() {
  try {
    console.log('🏗️ Creating test data...\n');

    // 1. 테스트 사용자 생성
    const user = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedpassword123',
      },
    });
    console.log(`✅ User created: ${user.name} (${user.email})`);

    // 2. 테스트 채팅방 생성
    const room = await prisma.room.upsert({
      where: { id: 'test-room-1' },
      update: {},
      create: {
        id: 'test-room-1',
        name: 'Test Room',
        description: 'A test room for embedding functionality',
      },
    });
    console.log(`✅ Room created: ${room.name}`);

    // 3. 테스트 메시지들 생성
    const testMessages = [
      { content: 'Hello, how are you today?', role: 'user' },
      { content: 'I am doing well, thank you for asking!', role: 'assistant' },
      { content: 'What is the weather like?', role: 'user' },
      {
        content:
          'I cannot check the current weather, but I can help you find weather information.',
        role: 'assistant',
      },
      { content: 'Can you help me with programming?', role: 'user' },
      {
        content:
          'Of course! I can help you with various programming languages and concepts.',
        role: 'assistant',
      },
      { content: 'What programming languages do you know?', role: 'user' },
      {
        content:
          'I can help with Python, JavaScript, TypeScript, Java, C++, and many other languages.',
        role: 'assistant',
      },
      { content: 'How do I create a REST API?', role: 'user' },
      {
        content:
          'To create a REST API, you can use frameworks like Express.js for Node.js, Flask for Python, or Spring Boot for Java.',
        role: 'assistant',
      },
    ];

    for (const msg of testMessages) {
      await prisma.message.create({
        data: {
          content: msg.content,
          role: msg.role,
          roomId: room.id,
          userId: user.id,
        },
      });
    }
    console.log(`✅ Created ${testMessages.length} test messages`);

    // 4. 데이터 확인
    const messageCount = await prisma.message.count();
    const roomCount = await prisma.room.count();
    const userCount = await prisma.user.count();

    console.log(`\n📊 Database Summary:`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Rooms: ${roomCount}`);
    console.log(`   Messages: ${messageCount}`);

    console.log('\n🎉 Test data creation completed!');
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();
