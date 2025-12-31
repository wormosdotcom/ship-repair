import { Router } from 'express';
import { PrismaClient, Role, ServiceItemStatus } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireRole } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'service-items');
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
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMime.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Invalid file type'));
  },
});

function canEdit(user: any, workOrder: any) {
  if (user.role === Role.ADMIN) return true;
  if (user.role === Role.OPS && workOrder.createdById === user.id) return true;
  return false;
}

const workOrderSelect = {
  id: true,
  internalNo: true,
  status: true,
  operatingCompany: true,
  orderType: true,
  paymentTerms: true,
  customerCompany: true,
  vesselName: true,
  imo: true,
  vesselType: true,
  yearBuilt: true,
  grossTonnage: true,
  vesselNotes: true,
  po: true,
  locationType: true,
  locationName: true,
  city: true,
  startDate: true,
  endDate: true,
  responsibleEngineerName: true,
  responsibleOpsName: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
};

async function ensureWorkOrder(workOrderId: string) {
  return prisma.workOrder.findFirst({ where: { id: workOrderId, deletedAt: null }, select: workOrderSelect });
}

function mapSelect() {
  return {
    id: true,
    workOrderId: true,
    status: true,
    equipmentName: true,
    model: true,
    serial: true,
    serviceContent: true,
    createdById: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    workOrder: { select: { id: true, internalNo: true, vesselName: true, imo: true, createdById: true } },
    engineers: {
      select: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    },
    attachments: {
      select: { id: true, filename: true, path: true, mimeType: true, size: true, uploaderId: true, createdAt: true },
    },
  };
}

function formatServiceItem(item: any) {
  return {
    id: item.id,
    workOrderId: item.workOrderId,
    status: item.status,
    equipmentName: item.equipmentName,
    model: item.model,
    serial: item.serial,
    serviceContent: item.serviceContent,
    createdById: item.createdById,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    workOrder: item.workOrder,
    assignedEngineers: item.engineers.map((e: any) => e.user),
    attachments: item.attachments,
  };
}

async function validatePayload(body: any) {
  const required = ['equipmentName', 'serviceContent', 'status'];
  for (const f of required) {
    if (!body[f]) return `${f} is required`;
  }
  if (!Object.values(ServiceItemStatus).includes(body.status as ServiceItemStatus)) return 'Invalid status';
  if (body.status === ServiceItemStatus.IN_PROGRESS) {
    if (!body.assignedEngineerIds || (Array.isArray(body.assignedEngineerIds) && body.assignedEngineerIds.length === 0)) {
      return 'At least one assigned engineer is required when status is IN_PROGRESS';
    }
  }
  return null;
}

router.get('/work-orders/:workOrderId/service-items', requireAuth, async (req, res) => {
  const workOrder = await ensureWorkOrder(req.params.workOrderId);
  if (!workOrder) return res.status(404).json({ error: 'Work order not found' });

  const status = req.query.status ? String(req.query.status) : '';
  const engineerId = req.query.engineerId ? String(req.query.engineerId) : '';
  const search = req.query.search ? String(req.query.search) : '';

  const where: any = { workOrderId: req.params.workOrderId, deletedAt: null };
  if (status) where.status = status;
  if (search) where.equipmentName = { contains: search, mode: 'insensitive' };
  if (engineerId) {
    where.engineers = { some: { userId: engineerId } };
  }

  const items = await prisma.serviceItem.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: mapSelect(),
  });

  return res.json({ items: items.map(formatServiceItem), workOrder });
});

router.get('/service-items/:id', requireAuth, async (req, res) => {
  const item = await prisma.serviceItem.findFirst({ where: { id: req.params.id, deletedAt: null }, select: mapSelect() });
  if (!item) return res.status(404).json({ error: 'Not found' });
  return res.json({ serviceItem: formatServiceItem(item) });
});

router.post('/work-orders/:workOrderId/service-items', requireAuth, requireRole([Role.OPS, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const workOrder = await ensureWorkOrder(req.params.workOrderId);
  if (!workOrder) return res.status(404).json({ error: 'Work order not found' });
  if (!canEdit(user, workOrder)) return res.status(403).json({ error: 'Forbidden' });

  const error = await validatePayload(req.body);
  if (error) return res.status(400).json({ error });

  const assignedEngineerIds: string[] = Array.isArray(req.body.assignedEngineerIds) ? req.body.assignedEngineerIds : [];
  if (assignedEngineerIds.length) {
    const engineers = await prisma.user.count({ where: { id: { in: assignedEngineerIds }, role: Role.ENGINEER } });
    if (engineers !== assignedEngineerIds.length) return res.status(400).json({ error: 'Assigned engineers must be engineer role' });
  }

  const created = await prisma.serviceItem.create({
    data: {
      workOrderId: workOrder.id,
      status: req.body.status,
      equipmentName: req.body.equipmentName,
      model: req.body.model || null,
      serial: req.body.serial || null,
      serviceContent: req.body.serviceContent,
      createdById: user.id,
      engineers: {
        create: assignedEngineerIds.map((id) => ({ userId: id })),
      },
    },
    select: mapSelect(),
  });

  await prisma.auditLog.create({ data: { userId: user.id, action: 'SERVICE_ITEM_CREATE', entityType: 'ServiceItem', entityId: created.id } });

  return res.status(201).json({ serviceItem: formatServiceItem(created) });
});

router.put('/service-items/:id', requireAuth, requireRole([Role.OPS, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const existing = await prisma.serviceItem.findFirst({ where: { id: req.params.id, deletedAt: null }, select: mapSelect() });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const workOrder = await ensureWorkOrder(existing.workOrderId);
  if (!workOrder) return res.status(404).json({ error: 'Work order not found' });
  if (!canEdit(user, workOrder)) return res.status(403).json({ error: 'Forbidden' });

  const error = await validatePayload(req.body);
  if (error) return res.status(400).json({ error });

  const assignedEngineerIds: string[] = Array.isArray(req.body.assignedEngineerIds) ? req.body.assignedEngineerIds : [];
  if (assignedEngineerIds.length) {
    const engineers = await prisma.user.count({ where: { id: { in: assignedEngineerIds }, role: Role.ENGINEER } });
    if (engineers !== assignedEngineerIds.length) return res.status(400).json({ error: 'Assigned engineers must be engineer role' });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.serviceItemEngineer.deleteMany({ where: { serviceItemId: existing.id, userId: { notIn: assignedEngineerIds } } });
    for (const id of assignedEngineerIds) {
      await tx.serviceItemEngineer.upsert({
        where: { serviceItemId_userId: { serviceItemId: existing.id, userId: id } },
        update: {},
        create: { serviceItemId: existing.id, userId: id },
      });
    }

    return tx.serviceItem.update({
      where: { id: existing.id },
      data: {
        status: req.body.status,
        equipmentName: req.body.equipmentName,
        model: req.body.model || null,
        serial: req.body.serial || null,
        serviceContent: req.body.serviceContent,
      },
      select: mapSelect(),
    });
  });

  await prisma.auditLog.create({ data: { userId: user.id, action: 'SERVICE_ITEM_UPDATE', entityType: 'ServiceItem', entityId: existing.id } });
  return res.json({ serviceItem: formatServiceItem(updated) });
});

router.delete('/service-items/:id', requireAuth, requireRole([Role.OPS, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const existing = await prisma.serviceItem.findFirst({ where: { id: req.params.id, deletedAt: null }, select: mapSelect() });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const workOrder = await ensureWorkOrder(existing.workOrderId);
  if (!workOrder) return res.status(404).json({ error: 'Work order not found' });
  if (!canEdit(user, workOrder)) return res.status(403).json({ error: 'Forbidden' });

  await prisma.serviceItem.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  await prisma.auditLog.create({ data: { userId: user.id, action: 'SERVICE_ITEM_DELETE', entityType: 'ServiceItem', entityId: existing.id } });
  return res.json({ success: true });
});

router.post('/service-items/:id/attachments', requireAuth, requireRole([Role.OPS, Role.ADMIN]), upload.single('file'), async (req, res) => {
  const user = req.user!;
  const existing = await prisma.serviceItem.findFirst({ where: { id: req.params.id, deletedAt: null }, select: mapSelect() });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const workOrder = await ensureWorkOrder(existing.workOrderId);
  if (!workOrder) return res.status(404).json({ error: 'Work order not found' });
  if (!canEdit(user, workOrder)) return res.status(403).json({ error: 'Forbidden' });
  if (!req.file) return res.status(400).json({ error: 'File required' });

  const file = req.file;
  const attachment = await prisma.serviceAttachment.create({
    data: {
      serviceItemId: existing.id,
      filename: file.originalname,
      path: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      uploaderId: user.id,
    },
    select: { id: true, filename: true, path: true, mimeType: true, size: true, uploaderId: true, createdAt: true },
  });
  return res.status(201).json({ attachment });
});

router.get('/attachments/:id/download', requireAuth, async (req, res) => {
  const attachment = await prisma.serviceAttachment.findFirst({
    where: { id: req.params.id },
    include: { serviceItem: { include: { workOrder: true } } },
  });
  if (!attachment || attachment.serviceItem.deletedAt) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(uploadDir, attachment.path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath, attachment.filename);
});

router.delete('/attachments/:id', requireAuth, requireRole([Role.OPS, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const attachment = await prisma.serviceAttachment.findFirst({
    where: { id: req.params.id },
    include: { serviceItem: { include: { workOrder: true } } },
  });
  if (!attachment || attachment.serviceItem.deletedAt) return res.status(404).json({ error: 'Not found' });
  const workOrder = attachment.serviceItem.workOrder;
  if (!canEdit(user, workOrder)) return res.status(403).json({ error: 'Forbidden' });

  const filePath = path.join(uploadDir, attachment.path);
  await prisma.serviceAttachment.delete({ where: { id: attachment.id } });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return res.json({ success: true });
});

export default router;
