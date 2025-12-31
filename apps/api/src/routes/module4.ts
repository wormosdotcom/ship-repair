import { Router } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/placeholder', requireAuth, requireRole([Role.FINANCE, Role.OPS, Role.ADMIN]), (_req, res) => {
  res.json({ message: 'Module 4 placeholder: access granted (engineers blocked).' });
});

export default router;
