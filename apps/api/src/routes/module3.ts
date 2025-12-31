import { Router } from 'express';
import { Prisma, PrismaClient, Role } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireRole } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'cost-attachments');
fs.mkdirSync(uploadDir, { recursive: true });

const allowedMime = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMime.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Invalid file type'));
  },
});

const costLineSelect = {
  id: true,
  workOrderId: true,
  itemName: true,
  category: true,
  unitPrice: true,
  quantity: true,
  lineTotal: true,
  notes: true,
  isLocked: true,
  lockedAt: true,
  lockedById: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
};

async function getWorkOrder(workOrderId: string) {
  return prisma.workOrder.findFirst({
    where: { id: workOrderId, deletedAt: null },
    select: { id: true, internalNo: true, vesselName: true, imo: true, createdById: true },
  });
}

function canEdit(user: any, workOrder: any) {
  if (!user) return false;
  if (user.role === Role.ADMIN || user.role === Role.FINANCE) return true;
  if (user.role === Role.OPS && workOrder.createdById === user.id) return true;
  return false;
}

function validateCostLine(body: any) {
  if (!body.itemName) return 'itemName is required';
  if (!body.category) return 'category is required';
  if (body.unitPrice === undefined || body.quantity === undefined) return 'unitPrice and quantity are required';
  const unitPrice = Number(body.unitPrice);
  const quantity = Number(body.quantity);
  if (!(unitPrice > 0) || !(quantity > 0)) return 'unitPrice and quantity must be positive numbers';
  return null;
}

function computeLineTotal(unitPrice: any, quantity: any) {
  const up = Number(unitPrice);
  const qty = Number(quantity);
  return new Prisma.Decimal((up * qty).toFixed(2));
}

async function buildSummary(workOrderId: string) {
  const lines = await prisma.costLine.findMany({
    where: { workOrderId, deletedAt: null },
    select: { lineTotal: true, category: true },
  });
  const totalCost = lines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
  const categoryTotals: Record<string, number> = {};
  lines.forEach((l) => {
    categoryTotals[l.category] = (categoryTotals[l.category] || 0) + Number(l.lineTotal);
  });
  return { totalCost, categoryTotals };
}

router.get('/work-orders/:workOrderId/cost-lines', requireAuth, requireRole([Role.FINANCE, Role.OPS, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const workOrder = await getWorkOrder(req.params.workOrderId);
  if (!workOrder) return res.status(404).json({ error: 'Work order not found' });
  if (user.role === Role.OPS && workOrder.createdById !== user.id) return res.status(403).json({ error: 'Forbidden' });

  const category = req.query.category ? String(req.query.category) : '';
  const search = req.query.search ? String(req.query.search) : '';
  const where: any = { workOrderId: workOrder.id, deletedAt: null };
  if (category) where.category = category;
  if (search) where.itemName = { contains: search, mode: 'insensitive' };

  const lines = await prisma.costLine.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: { ...costLineSelect, lockedBy: { select: { id: true, name: true } } },
  });
  const { totalCost, categoryTotals } = await buildSummary(workOrder.id);
  const attachments = await prisma.costAttachment.findMany({
    where: { workOrderId: workOrder.id },
    select: { id: true, costLineId: true, filename: true, path: true, mimeType: true, size: true, uploaderId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ items: lines, totalCost, categoryTotals, attachments, workOrder });
});

router.get('/cost-lines/:id', requireAuth, requireRole([Role.FINANCE, Role.OPS, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const line = await prisma.costLine.findFirst({
    where: { id: req.params.id, deletedAt: null },
    select: { ...costLineSelect, workOrder: { select: { id: true, createdById: true, internalNo: true } } },
  });
  if (!line) return res.status(404).json({ error: 'Not found' });
  if (user.role === Role.OPS && line.workOrder.createdById !== user.id) return res.status(403).json({ error: 'Forbidden' });
  return res.json({ costLine: line });
});

router.get('/work-orders/:workOrderId/cost-summary', requireAuth, requireRole([Role.FINANCE, Role.OPS, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const workOrder = await getWorkOrder(req.params.workOrderId);
  if (!workOrder) return res.status(404).json({ error: 'Work order not found' });
  if (user.role === Role.OPS && workOrder.createdById !== user.id) return res.status(403).json({ error: 'Forbidden' });
  const summary = await buildSummary(workOrder.id);
  return res.json(summary);
});

router.post('/work-orders/:workOrderId/cost-lines', requireAuth, requireRole([Role.FINANCE, Role.OPS, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const workOrder = await getWorkOrder(req.params.workOrderId);
  if (!workOrder) return res.status(404).json({ error: 'Work order not found' });
  if (!canEdit(user, workOrder)) return res.status(403).json({ error: 'Forbidden' });

  const error = validateCostLine(req.body);
  if (error) return res.status(400).json({ error });

  const lineTotal = computeLineTotal(req.body.unitPrice, req.body.quantity);

  const created = await prisma.costLine.create({
    data: {
      workOrderId: workOrder.id,
      itemName: req.body.itemName,
      category: req.body.category,
      unitPrice: new Prisma.Decimal(req.body.unitPrice),
      quantity: new Prisma.Decimal(req.body.quantity),
      lineTotal,
      notes: req.body.notes || null,
      createdById: user.id,
    },
    select: { ...costLineSelect, lockedBy: { select: { id: true, name: true } } },
  });
  await prisma.auditLog.create({ data: { userId: user.id, action: 'COST_LINE_CREATE', entityType: 'CostLine', entityId: created.id } });
  const { totalCost, categoryTotals } = await buildSummary(workOrder.id);
  return res.status(201).json({ costLine: created, totalCost, categoryTotals });
});

router.put('/cost-lines/:id', requireAuth, requireRole([Role.FINANCE, Role.OPS, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const existing = await prisma.costLine.findFirst({
    where: { id: req.params.id, deletedAt: null },
    select: { ...costLineSelect, workOrder: { select: { id: true, createdById: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.isLocked) return res.status(400).json({ error: 'Cost line is locked' });
  if (!canEdit(user, existing.workOrder)) return res.status(403).json({ error: 'Forbidden' });

  const error = validateCostLine(req.body);
  if (error) return res.status(400).json({ error });

  const lineTotal = computeLineTotal(req.body.unitPrice, req.body.quantity);

  const updated = await prisma.costLine.update({
    where: { id: existing.id },
    data: {
      itemName: req.body.itemName,
      category: req.body.category,
      unitPrice: new Prisma.Decimal(req.body.unitPrice),
      quantity: new Prisma.Decimal(req.body.quantity),
      lineTotal,
      notes: req.body.notes || null,
    },
    select: { ...costLineSelect, lockedBy: { select: { id: true, name: true } } },
  });
  await prisma.auditLog.create({ data: { userId: user.id, action: 'COST_LINE_UPDATE', entityType: 'CostLine', entityId: existing.id } });
  const { totalCost, categoryTotals } = await buildSummary(existing.workOrder.id);
  return res.json({ costLine: updated, totalCost, categoryTotals });
});

router.delete('/cost-lines/:id', requireAuth, requireRole([Role.FINANCE, Role.OPS, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const existing = await prisma.costLine.findFirst({
    where: { id: req.params.id, deletedAt: null },
    select: { ...costLineSelect, workOrder: { select: { id: true, createdById: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.isLocked) return res.status(400).json({ error: 'Cost line is locked' });
  if (!canEdit(user, existing.workOrder)) return res.status(403).json({ error: 'Forbidden' });

  await prisma.costLine.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  await prisma.auditLog.create({ data: { userId: user.id, action: 'COST_LINE_DELETE', entityType: 'CostLine', entityId: existing.id } });
  const { totalCost, categoryTotals } = await buildSummary(existing.workOrder.id);
  return res.json({ success: true, totalCost, categoryTotals });
});

router.post('/work-orders/:workOrderId/cost-lines/lock', requireAuth, requireRole([Role.FINANCE, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const workOrder = await getWorkOrder(req.params.workOrderId);
  if (!workOrder) return res.status(404).json({ error: 'Work order not found' });

  await prisma.costLine.updateMany({
    where: { workOrderId: workOrder.id, deletedAt: null, isLocked: false },
    data: { isLocked: true, lockedAt: new Date(), lockedById: user.id },
  });
  return res.json({ success: true });
});

router.post('/work-orders/:workOrderId/cost-attachments/upload', requireAuth, requireRole([Role.FINANCE, Role.OPS, Role.ADMIN]), upload.single('file'), async (req, res) => {
  const user = req.user!;
  const workOrder = await getWorkOrder(req.params.workOrderId);
  if (!workOrder) return res.status(404).json({ error: 'Work order not found' });
  if (!canEdit(user, workOrder)) return res.status(403).json({ error: 'Forbidden' });
  if (!req.file) return res.status(400).json({ error: 'File required' });

  const costLineId = req.body.costLineId as string | undefined;
  if (costLineId) {
    const line = await prisma.costLine.findFirst({ where: { id: costLineId, workOrderId: workOrder.id, deletedAt: null } });
    if (!line) return res.status(404).json({ error: 'Cost line not found' });
    if (line.isLocked) return res.status(400).json({ error: 'Cost line is locked' });
  }

  const file = req.file;
  const attachment = await prisma.costAttachment.create({
    data: {
      costLineId: costLineId || null,
      workOrderId: workOrder.id,
      filename: file.originalname,
      path: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      uploaderId: user.id,
    },
    select: { id: true, costLineId: true, filename: true, path: true, mimeType: true, size: true, uploaderId: true, createdAt: true },
  });
  return res.status(201).json({ attachment });
});

router.get('/cost-attachments/:id/download', requireAuth, requireRole([Role.FINANCE, Role.OPS, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const attachment = await prisma.costAttachment.findFirst({
    where: { id: req.params.id },
    include: { workOrder: true, costLine: true },
  });
  if (!attachment || attachment.workOrder.deletedAt) return res.status(404).json({ error: 'Not found' });
  if (user.role === Role.OPS && attachment.workOrder.createdById !== user.id) return res.status(403).json({ error: 'Forbidden' });
  const filePath = path.join(uploadDir, attachment.path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath, attachment.filename);
});

router.delete('/cost-attachments/:id', requireAuth, requireRole([Role.FINANCE, Role.OPS, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const attachment = await prisma.costAttachment.findFirst({
    where: { id: req.params.id },
    include: { workOrder: true, costLine: true },
  });
  if (!attachment || attachment.workOrder.deletedAt) return res.status(404).json({ error: 'Not found' });
  if (attachment.costLine && attachment.costLine.isLocked) return res.status(400).json({ error: 'Cost line is locked' });
  if (!canEdit(user, attachment.workOrder)) return res.status(403).json({ error: 'Forbidden' });

  const filePath = path.join(uploadDir, attachment.path);
  await prisma.costAttachment.delete({ where: { id: attachment.id } });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return res.json({ success: true });
});

export default router;
