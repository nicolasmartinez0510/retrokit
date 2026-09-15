import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const templates = [
  {
    name: 'Start / Stop / Continue',
    description: 'Decide what to start doing, stop doing, and continue doing.',
    columns: [
      { title: 'Start', icon: '🚀', position: 0 },
      { title: 'Stop', icon: '🛑', position: 1 },
      { title: 'Continue', icon: '✅', position: 2 },
    ],
  },
  {
    name: '4Ls',
    description: 'Liked, Learned, Lacked, Longed for.',
    columns: [
      { title: 'Liked', icon: '❤️', position: 0 },
      { title: 'Learned', icon: '📚', position: 1 },
      { title: 'Lacked', icon: '🔍', position: 2 },
      { title: 'Longed for', icon: '✨', position: 3 },
    ],
  },
  {
    name: 'Mad / Sad / Glad',
    description: 'Share what made you mad, sad, and glad.',
    columns: [
      { title: 'Mad', icon: '😠', position: 0 },
      { title: 'Sad', icon: '😢', position: 1 },
      { title: 'Glad', icon: '😊', position: 2 },
    ],
  },
  {
    name: 'Keep / Drop / Start',
    description: 'Keep what works, drop what does not, start something new.',
    columns: [
      { title: 'Keep', icon: '🔒', position: 0 },
      { title: 'Drop', icon: '🗑️', position: 1 },
      { title: 'Start', icon: '🌱', position: 2 },
    ],
  },
  {
    name: 'Went Well / To Improve / Ideas',
    description: 'Celebrate wins, surface improvements, and capture ideas.',
    columns: [
      { title: 'Went Well', icon: '👍', position: 0 },
      { title: 'To Improve', icon: '🔧', position: 1 },
      { title: 'Ideas', icon: '💡', position: 2 },
    ],
  },
];

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      'ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed',
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existingAdmin = await prisma.user.findFirst({
    where: { isAdmin: true },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        email,
        passwordHash,
        name: existingAdmin.name || 'Admin',
        isAdmin: true,
      },
    });
    console.log(`Updated system admin: ${email}`);
    return;
  }

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { passwordHash, isAdmin: true, name: byEmail.name || 'Admin' },
    });
    console.log(`Promoted existing user to system admin: ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Admin',
      isAdmin: true,
    },
  });
  console.log(`Seeded system admin: ${email}`);
}

async function main() {
  await seedAdmin();

  for (const t of templates) {
    const existing = await prisma.template.findFirst({
      where: { name: t.name, isGlobal: true },
    });
    if (existing) {
      console.log(`Template already exists: ${t.name}`);
      continue;
    }
    const created = await prisma.template.create({
      data: {
        name: t.name,
        description: t.description,
        isGlobal: true,
        columns: { create: t.columns },
      },
      include: { columns: true },
    });
    console.log(`Seeded template: ${created.name} (${created.columns.length} columns)`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
