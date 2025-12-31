import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = 'demo1234';
  const passwordHash = await bcrypt.hash(password, 10);

  const users = [
    { email: 'engineer@demo.com', name: 'Engineer Demo', role: Role.ENGINEER },
    { email: 'finance@demo.com', name: 'Finance Demo', role: Role.FINANCE },
    { email: 'ops@demo.com', name: 'Ops Demo', role: Role.OPS },
    { email: 'admin@demo.com', name: 'Admin Demo', role: Role.ADMIN }
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        ...user,
        passwordHash,
      }
    });
  }

  console.log('Seed complete: demo users created. Password: demo1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
