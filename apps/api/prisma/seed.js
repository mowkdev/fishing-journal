import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const main = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set (see apps/api/.env.example).',
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'ADMIN' },
    create: { email, passwordHash, role: 'ADMIN' },
  });

  console.log(`[seed] admin ready: ${admin.email} (id: ${admin.id}, role: ${admin.role})`);
};

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
