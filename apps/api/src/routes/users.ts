import { Router } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { requireAuth } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

router.get('/engineers', requireAuth, async (_req, res) => {
  const engineers = await prisma.user.findMany({
    where: { role: Role.ENGINEER },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });
  return res.json({ engineers });
});

export default router;
