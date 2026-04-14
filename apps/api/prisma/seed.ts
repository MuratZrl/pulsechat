import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ──────────────────────────────────────────────────────────────────

  const passwordHash = await bcrypt.hash('Demo123!', 10);
  const systemHash = await bcrypt.hash('system-unused', 10);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'demo@example.com' },
      update: {},
      create: {
        id: 'user-demo',
        name: 'Alex Demo',
        email: 'demo@example.com',
        passwordHash,
        bio: 'Full-stack developer. Coffee enthusiast.',
        avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Alex',
        emailVerified: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'sarah@example.com' },
      update: {},
      create: {
        id: 'user-sarah',
        name: 'Sarah Chen',
        email: 'sarah@example.com',
        passwordHash,
        bio: 'Engineering lead. Loves Rust and distributed systems.',
        avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Sarah',
        emailVerified: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'marcus@example.com' },
      update: {},
      create: {
        id: 'user-marcus',
        name: 'Marcus Johnson',
        email: 'marcus@example.com',
        passwordHash,
        bio: 'DevOps engineer. Kubernetes whisperer.',
        avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Marcus',
        emailVerified: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'elena@example.com' },
      update: {},
      create: {
        id: 'user-elena',
        name: 'Elena Rodriguez',
        email: 'elena@example.com',
        passwordHash,
        bio: 'Product designer. Pixel perfectionist.',
        avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Elena',
        emailVerified: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'system@pulsechat.internal' },
      update: {},
      create: {
        id: 'user-system',
        name: 'System',
        email: 'system@pulsechat.internal',
        passwordHash: systemHash,
        emailVerified: true,
      },
    }),
  ]);

  const [alex, sarah, marcus, elena, system] = users;
  console.log(`  ✅ ${users.length} users`);

  // ── Rooms ──────────────────────────────────────────────────────────────────

  const general = await prisma.room.upsert({
    where: { id: 'room-general' },
    update: {},
    create: { id: 'room-general', name: 'General', createdById: system.id },
  });

  const engineering = await prisma.room.upsert({
    where: { id: 'room-engineering' },
    update: {},
    create: { id: 'room-engineering', name: 'Engineering', createdById: sarah.id },
  });

  const random = await prisma.room.upsert({
    where: { id: 'room-random' },
    update: {},
    create: { id: 'room-random', name: 'Random', createdById: system.id },
  });

  // DM between Alex and Sarah
  const dm = await prisma.room.upsert({
    where: { id: 'room-dm-alex-sarah' },
    update: {},
    create: {
      id: 'room-dm-alex-sarah',
      name: 'user-demo__user-sarah',
      type: 'DM',
      createdById: alex.id,
    },
  });

  console.log('  ✅ 3 channels + 1 DM');

  // ── Room Members ───────────────────────────────────────────────────────────

  const allUsers = [alex, sarah, marcus, elena];
  const memberData: { userId: string; roomId: string; role: string }[] = [];

  // Everyone in General and Random
  for (const u of allUsers) {
    memberData.push({ userId: u.id, roomId: general.id, role: u.id === system.id ? 'admin' : 'member' });
    memberData.push({ userId: u.id, roomId: random.id, role: 'member' });
  }

  // Engineering: Sarah (admin), Alex, Marcus
  memberData.push({ userId: sarah.id, roomId: engineering.id, role: 'admin' });
  memberData.push({ userId: alex.id, roomId: engineering.id, role: 'member' });
  memberData.push({ userId: marcus.id, roomId: engineering.id, role: 'moderator' });

  // DM: Alex and Sarah
  memberData.push({ userId: alex.id, roomId: dm.id, role: 'member' });
  memberData.push({ userId: sarah.id, roomId: dm.id, role: 'member' });

  for (const m of memberData) {
    await prisma.roomMember.upsert({
      where: { userId_roomId: { userId: m.userId, roomId: m.roomId } },
      update: {},
      create: m,
    });
  }

  console.log(`  ✅ ${memberData.length} room memberships`);

  // ── Messages ───────────────────────────────────────────────────────────────

  // Helper to create a message at a relative time (minutes ago)
  function ago(minutes: number): Date {
    return new Date(Date.now() - minutes * 60 * 1000);
  }

  const messages = await Promise.all([
    // ── General channel ──
    prisma.message.upsert({
      where: { id: 'msg-g1' },
      update: {},
      create: { id: 'msg-g1', roomId: general.id, senderId: sarah.id, text: 'Good morning everyone! Hope you all had a great weekend.', createdAt: ago(120) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-g2' },
      update: {},
      create: { id: 'msg-g2', roomId: general.id, senderId: alex.id, text: 'Morning! Yeah it was nice, finally got some rest.', createdAt: ago(118) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-g3' },
      update: {},
      create: { id: 'msg-g3', roomId: general.id, senderId: marcus.id, text: 'Hey all. Anyone up for lunch at noon?', createdAt: ago(115) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-g4' },
      update: {},
      create: { id: 'msg-g4', roomId: general.id, senderId: elena.id, text: 'Count me in! The new ramen place?', createdAt: ago(113) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-g5' },
      update: {},
      create: { id: 'msg-g5', roomId: general.id, senderId: marcus.id, text: 'Yes! I heard their tonkotsu is amazing.', createdAt: ago(112) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-g6' },
      update: {},
      create: { id: 'msg-g6', roomId: general.id, senderId: alex.id, text: "I'm in too. Let's meet at the lobby at 11:50.", createdAt: ago(110) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-g7' },
      update: {},
      create: { id: 'msg-g7', roomId: general.id, senderId: sarah.id, text: 'Reminder: team standup at 2pm today.', createdAt: ago(60) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-g8' },
      update: {},
      create: { id: 'msg-g8', roomId: general.id, senderId: elena.id, text: 'Thanks for the heads up @Sarah Chen', createdAt: ago(58) },
    }),

    // ── Engineering channel ──
    prisma.message.upsert({
      where: { id: 'msg-e1' },
      update: {},
      create: { id: 'msg-e1', roomId: engineering.id, senderId: sarah.id, text: "I've been looking at the WebSocket performance. We're hitting some bottlenecks with 500+ concurrent connections.", createdAt: ago(90) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-e2' },
      update: {},
      create: { id: 'msg-e2', roomId: engineering.id, senderId: marcus.id, text: 'Have you checked the Redis adapter config? We might need to tune the pub/sub channels.', createdAt: ago(88) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-e3' },
      update: {},
      create: { id: 'msg-e3', roomId: engineering.id, senderId: alex.id, text: "I ran into something similar last sprint. The issue was message serialization — switching to msgpack cut latency by 40%.", createdAt: ago(85) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-e4' },
      update: {},
      create: { id: 'msg-e4', roomId: engineering.id, senderId: sarah.id, text: "That's a good lead. @Alex Demo can you share the PR where you made that change?", createdAt: ago(83) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-e5' },
      update: {},
      create: { id: 'msg-e5', roomId: engineering.id, senderId: alex.id, text: 'Sure, let me dig it up. Give me 10 minutes.', createdAt: ago(82) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-e6' },
      update: {},
      create: { id: 'msg-e6', roomId: engineering.id, senderId: marcus.id, text: 'Also, we should add connection pooling for the database. Prisma has built-in support for that.', createdAt: ago(75) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-e7' },
      update: {},
      create: { id: 'msg-e7', roomId: engineering.id, senderId: sarah.id, text: "Good point. Let's create a ticket for that. I'll prioritize it for next sprint.", createdAt: ago(73) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-e8' },
      update: {},
      create: { id: 'msg-e8', roomId: engineering.id, senderId: alex.id, text: "Found it! The key change was in the socket adapter config. I'll post the link in the ticket.", createdAt: ago(40) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-e9' },
      update: {},
      create: { id: 'msg-e9', roomId: engineering.id, senderId: sarah.id, text: 'Perfect, thanks! 🎉', createdAt: ago(38) },
    }),

    // ── Random channel ──
    prisma.message.upsert({
      where: { id: 'msg-r1' },
      update: {},
      create: { id: 'msg-r1', roomId: random.id, senderId: elena.id, text: 'Has anyone tried that new coffee shop on 5th street?', createdAt: ago(200) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-r2' },
      update: {},
      create: { id: 'msg-r2', roomId: random.id, senderId: alex.id, text: 'Yes! Their cold brew is incredible. Highly recommend.', createdAt: ago(195) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-r3' },
      update: {},
      create: { id: 'msg-r3', roomId: random.id, senderId: marcus.id, text: "I'm more of a tea person but I'll check it out.", createdAt: ago(190) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-r4' },
      update: {},
      create: { id: 'msg-r4', roomId: random.id, senderId: elena.id, text: 'They have matcha lattes too! Really good ones.', createdAt: ago(188) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-r5' },
      update: {},
      create: { id: 'msg-r5', roomId: random.id, senderId: sarah.id, text: 'Friday fun fact: the first webcam was created to monitor a coffee pot at Cambridge University. ☕', createdAt: ago(30) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-r6' },
      update: {},
      create: { id: 'msg-r6', roomId: random.id, senderId: alex.id, text: "Haha that's so nerdy, I love it.", createdAt: ago(28) },
    }),

    // ── DM: Alex ↔ Sarah ──
    prisma.message.upsert({
      where: { id: 'msg-d1' },
      update: {},
      create: { id: 'msg-d1', roomId: dm.id, senderId: sarah.id, text: 'Hey Alex, quick question about the auth refactor — are you using refresh token rotation?', createdAt: ago(50) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-d2' },
      update: {},
      create: { id: 'msg-d2', roomId: dm.id, senderId: alex.id, text: 'Yeah, each refresh generates a new pair. Old refresh tokens are invalidated.', createdAt: ago(48) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-d3' },
      update: {},
      create: { id: 'msg-d3', roomId: dm.id, senderId: sarah.id, text: 'Nice. And the access token TTL is 15 minutes?', createdAt: ago(46) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-d4' },
      update: {},
      create: { id: 'msg-d4', roomId: dm.id, senderId: alex.id, text: 'Yep, 15m access / 7d refresh. Configurable via env vars.', createdAt: ago(45) },
    }),
    prisma.message.upsert({
      where: { id: 'msg-d5' },
      update: {},
      create: { id: 'msg-d5', roomId: dm.id, senderId: sarah.id, text: 'Great, that matches what we discussed. Thanks!', createdAt: ago(44) },
    }),
  ]);

  console.log(`  ✅ ${messages.length} messages`);

  // ── Reactions ──────────────────────────────────────────────────────────────

  const reactions = [
    { messageId: 'msg-g1', userId: alex.id, emoji: '👋' },
    { messageId: 'msg-g1', userId: marcus.id, emoji: '👋' },
    { messageId: 'msg-g1', userId: elena.id, emoji: '☀️' },
    { messageId: 'msg-g4', userId: alex.id, emoji: '🍜' },
    { messageId: 'msg-g4', userId: marcus.id, emoji: '🍜' },
    { messageId: 'msg-g5', userId: elena.id, emoji: '😋' },
    { messageId: 'msg-e3', userId: sarah.id, emoji: '🔥' },
    { messageId: 'msg-e3', userId: marcus.id, emoji: '👍' },
    { messageId: 'msg-e9', userId: alex.id, emoji: '🎉' },
    { messageId: 'msg-e9', userId: marcus.id, emoji: '🎉' },
    { messageId: 'msg-r5', userId: alex.id, emoji: '😂' },
    { messageId: 'msg-r5', userId: elena.id, emoji: '☕' },
    { messageId: 'msg-r5', userId: marcus.id, emoji: '🤓' },
    { messageId: 'msg-d5', userId: alex.id, emoji: '👍' },
  ];

  for (const r of reactions) {
    await prisma.messageReaction.upsert({
      where: { messageId_userId_emoji: { messageId: r.messageId, userId: r.userId, emoji: r.emoji } },
      update: {},
      create: r,
    });
  }

  console.log(`  ✅ ${reactions.length} reactions`);

  // ── Pins ───────────────────────────────────────────────────────────────────

  const pins = [
    { messageId: 'msg-g7', userId: sarah.id, roomId: general.id },    // standup reminder
    { messageId: 'msg-e1', userId: sarah.id, roomId: engineering.id }, // perf discussion
    { messageId: 'msg-e6', userId: marcus.id, roomId: engineering.id }, // connection pooling suggestion
  ];

  for (const p of pins) {
    await prisma.pin.upsert({
      where: { messageId_userId: { messageId: p.messageId, userId: p.userId } },
      update: {},
      create: p,
    });
  }

  console.log(`  ✅ ${pins.length} pins`);

  // ── Stars ──────────────────────────────────────────────────────────────────

  const stars = [
    { messageId: 'msg-e3', userId: alex.id, roomId: engineering.id },   // Alex's own perf tip
    { messageId: 'msg-e3', userId: sarah.id, roomId: engineering.id },  // Sarah starred it too
    { messageId: 'msg-r5', userId: alex.id, roomId: random.id },       // fun fact
    { messageId: 'msg-d1', userId: alex.id, roomId: dm.id },           // auth question
    { messageId: 'msg-g7', userId: elena.id, roomId: general.id },     // standup reminder
  ];

  for (const s of stars) {
    await prisma.star.upsert({
      where: { messageId_userId: { messageId: s.messageId, userId: s.userId } },
      update: {},
      create: s,
    });
  }

  console.log(`  ✅ ${stars.length} stars`);

  // ── Read Receipts ──────────────────────────────────────────────────────────

  const receipts = [
    { messageId: 'msg-g8', userId: sarah.id },
    { messageId: 'msg-g8', userId: marcus.id },
    { messageId: 'msg-g8', userId: alex.id },
    { messageId: 'msg-e9', userId: alex.id },
    { messageId: 'msg-e9', userId: marcus.id },
    { messageId: 'msg-d5', userId: alex.id },
    { messageId: 'msg-r6', userId: sarah.id },
    { messageId: 'msg-r6', userId: elena.id },
  ];

  for (const r of receipts) {
    await prisma.readReceipt.upsert({
      where: { messageId_userId: { messageId: r.messageId, userId: r.userId } },
      update: {},
      create: r,
    });
  }

  console.log(`  ✅ ${receipts.length} read receipts`);

  // ── Mentions ───────────────────────────────────────────────────────────────

  const mentions = [
    { messageId: 'msg-g8', userId: sarah.id, read: true },
    { messageId: 'msg-e4', userId: alex.id, read: true },
  ];

  for (const m of mentions) {
    await prisma.mention.upsert({
      where: { messageId_userId: { messageId: m.messageId, userId: m.userId } },
      update: {},
      create: m,
    });
  }

  console.log(`  ✅ ${mentions.length} mentions`);

  console.log('\n🎉 Seed complete! Login with demo@example.com / Demo123!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
