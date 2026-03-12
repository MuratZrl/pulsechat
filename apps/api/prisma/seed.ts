import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create a system user to own default rooms
  const systemHash = await bcrypt.hash('system-unused', 10);
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@realtime-chat.internal' },
    update: {},
    create: {
      id: 'user-system',
      name: 'System',
      email: 'system@realtime-chat.internal',
      passwordHash: systemHash,
    },
  });

  // Create default rooms
  const general = await prisma.room.upsert({
    where: { id: 'room-general' },
    update: {},
    create: {
      id: 'room-general',
      name: 'General',
      createdById: systemUser.id,
    },
  });

  const random = await prisma.room.upsert({
    where: { id: 'room-random' },
    update: {},
    create: {
      id: 'room-random',
      name: 'Random',
      createdById: systemUser.id,
    },
  });

  console.log('✅ Seeded default rooms:', general.name, random.name);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
