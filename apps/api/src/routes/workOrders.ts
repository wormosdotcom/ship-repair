import { Router } from 'express';
import { PrismaClient, Role, WorkOrderStatus, Prisma } from '@prisma/client';
import { requireAuth, requireRole, requireOwnershipOrAdmin } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

function deriveStatus(internalNo: string | null | undefined, startDate: Date, endDate: Date, existing: WorkOrderStatus) {
  if (!internalNo) return WorkOrderStatus.DRAFT;
  if (existing === WorkOrderStatus.PENDING_SETTLEMENT) return existing; // manual later stage
  const today = new Date();
  if (today < startDate) return WorkOrderStatus.PENDING_SERVICE;
  if (today > endDate) return WorkOrderStatus.COMPLETED;
  return WorkOrderStatus.IN_SERVICE;
}

function formatDateKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function prefixFromOperatingCompany(company: string) {
  const normalized = company.trim().toLowerCase();
  if (normalized === 'wormos') return 'XQ';
  if (normalized === 'iship') return 'KD';
  return 'AX';
}

async function generateInternalNo(operatingCompany: string) {
  const prefix = prefixFromOperatingCompany(operatingCompany);
  const dateKey = formatDateKey(new Date());
  const count = await prisma.workOrder.count({
    where: {
      internalNo: { startsWith: `${prefix}-${dateKey}` },
    },
  });
  const seq = String(count + 1).padStart(3, '0');
  return `${prefix}-${dateKey}-${seq}`;
}

async function syncStatus(wo: any) {
  const derived = deriveStatus(wo.internalNo, wo.startDate, wo.endDate, wo.status);
  if (derived !== wo.status) {
    return prisma.workOrder.update({
      where: { id: wo.id },
      data: { status: derived },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        serviceItems: wo.serviceItems
          ? { where: { deletedAt: null }, select: { status: true } }
          : undefined,
      },
    });
  }
  return wo;
}

async function logAudit(userId: string, action: string, entityId: string) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType: 'WorkOrder',
      entityId,
    },
  });
}

async function createDeleteNotification(workOrder: any, userId: string, reason?: string) {
  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  const creator = await prisma.user.findUnique({ where: { id: workOrder.createdById } });
  await prisma.notification.create({
    data: {
      type: 'DELETE_WORK_ORDER_EMAIL_SIMULATION',
      recipient: admin?.email || 'admin@demo.com',
      cc: creator?.email,
      subject: `Work Order Deleted: ${workOrder.internalNo ?? workOrder.id}`,
      body: `Work Order ${workOrder.internalNo ?? workOrder.id} was deleted. Reason: ${reason ?? 'N/A'}.`,
      relatedWorkOrderId: workOrder.id,
      createdById: userId,
    },
  });
}

function canEditOrDelete(user: any, workOrder: any) {
  if (user.role === Role.ADMIN) return true;
  if (user.role === Role.OPS && workOrder.createdById === user.id) return true;
  return false;
}

function parseStatusFilter(raw?: string | string[]) {
  if (!raw) return [];
  const val = Array.isArray(raw) ? raw.join(',') : raw;
  const valid = Object.values(WorkOrderStatus);
  return val
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => valid.includes(s as WorkOrderStatus)) as WorkOrderStatus[];
}

function buildBaseWhere(query: any): Prisma.WorkOrderWhereInput {
  const where: Prisma.WorkOrderWhereInput = { deletedAt: null };
  const search = query.search ? String(query.search).trim() : '';
  const operatingCompany = query.operatingCompany ? String(query.operatingCompany).trim() : '';
  const startDateFrom = query.startDateFrom ? new Date(String(query.startDateFrom)) : null;
  const startDateTo = query.startDateTo ? new Date(String(query.startDateTo)) : null;

  if (search) {
    where.OR = [
      { internalNo: { contains: search, mode: 'insensitive' } },
      { vesselName: { contains: search, mode: 'insensitive' } },
      { imo: { contains: search, mode: 'insensitive' } },
      { po: { contains: search, mode: 'insensitive' } },
      { customerCompany: { contains: search, mode: 'insensitive' } },
      { locationName: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (operatingCompany) {
    where.operatingCompany = { equals: operatingCompany, mode: 'insensitive' };
  }
  if (startDateFrom || startDateTo) {
    where.startDate = {};
    if (startDateFrom) where.startDate.gte = startDateFrom;
    if (startDateTo) where.startDate.lte = startDateTo;
  }
  return where;
}

function validateWorkOrderInput(body: any) {
  const requiredFields = [
    'operatingCompany',
    'orderType',
    'paymentTerms',
    'customerCompany',
    'vesselName',
    'imo',
    'locationType',
    'locationName',
    'city',
    'startDate',
    'endDate',
  ];
  for (const field of requiredFields) {
    if (!body[field]) {
      return `${field} is required`;
    }
  }
  const start = new Date(body.startDate);
  const end = new Date(body.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid dates';
  }
  if (start > end) return 'startDate must be before or equal to endDate';
  return null;
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
  deletedAt: true,
  deleteReason: true,
  createdBy: { select: { id: true, name: true, email: true, role: true } },
};

router.get('/', requireAuth, async (req, res) => {
  const where = buildBaseWhere(req.query);
  const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
  const pageSize = Number(req.query.pageSize) > 0 ? Number(req.query.pageSize) : 10;
  const statusFilter = parseStatusFilter(req.query.status as string | string[] | undefined);

  const all = await prisma.workOrder.findMany({ where, orderBy: { createdAt: 'desc' }, select: workOrderSelect });
  const synced = await Promise.all(all.map(syncStatus));
  const filtered = statusFilter.length ? synced.filter((wo) => statusFilter.includes(wo.status)) : synced;
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  return res.json({ items, total, page, pageSize });
});

router.get('/stats', requireAuth, async (_req, res) => {
  const all = await prisma.workOrder.findMany({ where: { deletedAt: null }, select: workOrderSelect });
  const synced = await Promise.all(all.map(syncStatus));
  const uniqueImo = new Set(synced.map((w) => w.imo)).size;
  const counts: Record<WorkOrderStatus, number> = {
    [WorkOrderStatus.DRAFT]: 0,
    [WorkOrderStatus.PENDING_SERVICE]: 0,
    [WorkOrderStatus.IN_SERVICE]: 0,
    [WorkOrderStatus.COMPLETED]: 0,
    [WorkOrderStatus.PENDING_SETTLEMENT]: 0,
  };
  synced.forEach((w) => {
    const key = w.status as WorkOrderStatus;
    counts[key] = (counts[key] || 0) + 1;
  });

  const engineerLoadMap: Record<string, number> = {};
  synced.forEach((w) => {
    if (!w.responsibleEngineerName) return;
    if (w.status === WorkOrderStatus.PENDING_SERVICE || w.status === WorkOrderStatus.IN_SERVICE) {
      const key = w.responsibleEngineerName;
      engineerLoadMap[key] = (engineerLoadMap[key] || 0) + 1;
    }
  });
  const engineerLoad = Object.entries(engineerLoadMap).map(([name, count]) => ({ name, count }));

  const regionMap: Record<string, number> = {};
  synced.forEach((w) => {
    if (!w.city) return;
    regionMap[w.city] = (regionMap[w.city] || 0) + 1;
  });
  const regions = Object.entries(regionMap).map(([city, count]) => ({ city, count }));

  return res.json({
    totalVessels: uniqueImo,
    totalWorkOrders: synced.length,
    pendingService: counts[WorkOrderStatus.PENDING_SERVICE] || 0,
    inService: counts[WorkOrderStatus.IN_SERVICE] || 0,
    completed: counts[WorkOrderStatus.COMPLETED] || 0,
    pendingDispatch: counts[WorkOrderStatus.PENDING_SERVICE] || 0,
    inProgress: counts[WorkOrderStatus.IN_SERVICE] || 0,
    pendingSettlement: counts[WorkOrderStatus.PENDING_SETTLEMENT] || 0,
    engineerLoad,
    regionDistribution: regions,
  });
});

router.get('/alerts', requireAuth, async (_req, res) => {
  const all = await prisma.workOrder.findMany({
    where: { deletedAt: null },
    select: {
      ...workOrderSelect,
      serviceItems: {
        where: { deletedAt: null },
        select: { status: true },
      },
    },
  });
  const synced = await Promise.all(all.map(syncStatus));
  const today = new Date();
  const overdue = synced.filter((w) => w.status !== WorkOrderStatus.COMPLETED && today > w.endDate);
  const startingSoon = synced.filter((w) => w.status !== WorkOrderStatus.DRAFT && w.startDate >= today && (w.startDate.getTime() - today.getTime()) <= 5 * 24 * 60 * 60 * 1000);
  const engineerLoadMap: Record<string, number> = {};
  synced.forEach((w) => {
    if (!w.responsibleEngineerName) return;
    if (w.status === WorkOrderStatus.PENDING_SERVICE || w.status === WorkOrderStatus.IN_SERVICE) {
      engineerLoadMap[w.responsibleEngineerName] = (engineerLoadMap[w.responsibleEngineerName] || 0) + 1;
    }
  });
  const heavyEngineers = Object.entries(engineerLoadMap)
    .filter(([, count]) => count > 3)
    .map(([name, count]) => ({ name, count }));

  const mismatches = synced
    .filter(
      (w: any) =>
        (w.status === WorkOrderStatus.PENDING_SERVICE || w.status === WorkOrderStatus.IN_SERVICE) &&
        w.serviceItems?.some((si: any) => si.status === 'COMPLETED')
    )
    .map((w: any) => ({
      workOrderId: w.id,
      internalNo: w.internalNo,
      message: 'Service items show completed but work order not completed',
    }));

  return res.json({
    overdue: overdue.map((w) => ({ id: w.id, internalNo: w.internalNo, vesselName: w.vesselName, endDate: w.endDate })),
    startingSoon: startingSoon.map((w) => ({ id: w.id, internalNo: w.internalNo, vesselName: w.vesselName, startDate: w.startDate })),
    engineerLoad: heavyEngineers,
    serviceStatusMismatches: mismatches,
  });
});

router.post('/', requireAuth, requireRole([Role.OPS, Role.ADMIN]), async (req, res) => {
  const user = req.user!;
  const error = validateWorkOrderInput(req.body);
  if (error) return res.status(400).json({ error });

  const data = {
    internalNo: null,
    status: WorkOrderStatus.DRAFT,
    operatingCompany: req.body.operatingCompany,
    orderType: req.body.orderType,
    paymentTerms: req.body.paymentTerms,
    customerCompany: req.body.customerCompany,
    vesselName: req.body.vesselName,
    imo: req.body.imo,
    vesselType: req.body.vesselType || null,
    yearBuilt: req.body.yearBuilt ? Number(req.body.yearBuilt) : null,
    grossTonnage: req.body.grossTonnage ? Number(req.body.grossTonnage) : null,
    vesselNotes: req.body.vesselNotes || null,
    po: req.body.po || null,
    locationType: req.body.locationType,
    locationName: req.body.locationName,
    city: req.body.city,
    startDate: new Date(req.body.startDate),
    endDate: new Date(req.body.endDate),
    responsibleEngineerName: req.body.responsibleEngineerName || null,
    responsibleOpsName: req.body.responsibleOpsName || null,
    createdById: user.id,
  };

  const workOrder = await prisma.workOrder.create({ data, select: workOrderSelect });
  await logAudit(user.id, 'WORK_ORDER_CREATE', workOrder.id);
  return res.status(201).json({ workOrder });
});

router.get('/:id', requireAuth, async (req, res) => {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: req.params.id, deletedAt: null },
    select: workOrderSelect,
  });
  if (!workOrder) return res.status(404).json({ error: 'Not found' });
  const synced = await syncStatus(workOrder);
  return res.json({ workOrder: synced });
});

router.put('/:id', requireAuth, async (req, res) => {
  const user = req.user!;
  const existing = await prisma.workOrder.findFirst({ where: { id: req.params.id, deletedAt: null }, select: workOrderSelect });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (!canEditOrDelete(user, existing)) return res.status(403).json({ error: 'Forbidden' });
  const error = validateWorkOrderInput(req.body);
  if (error) return res.status(400).json({ error });

  const data = {
    operatingCompany: req.body.operatingCompany,
    orderType: req.body.orderType,
    paymentTerms: req.body.paymentTerms,
    customerCompany: req.body.customerCompany,
    vesselName: req.body.vesselName,
    imo: req.body.imo,
    vesselType: req.body.vesselType || null,
    yearBuilt: req.body.yearBuilt ? Number(req.body.yearBuilt) : null,
    grossTonnage: req.body.grossTonnage ? Number(req.body.grossTonnage) : null,
    vesselNotes: req.body.vesselNotes || null,
    po: req.body.po || null,
    locationType: req.body.locationType,
    locationName: req.body.locationName,
    city: req.body.city,
    startDate: new Date(req.body.startDate),
    endDate: new Date(req.body.endDate),
    responsibleEngineerName: req.body.responsibleEngineerName || null,
    responsibleOpsName: req.body.responsibleOpsName || null,
  };

  const updated = await prisma.workOrder.update({
    where: { id: existing.id },
    data,
    select: workOrderSelect,
  });
  const synced = await syncStatus(updated);
  await logAudit(user.id, 'WORK_ORDER_UPDATE', existing.id);
  return res.json({ workOrder: synced });
});

router.post('/:id/generate', requireAuth, async (req, res) => {
  const user = req.user!;
  const existing = await prisma.workOrder.findFirst({ where: { id: req.params.id, deletedAt: null }, select: workOrderSelect });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (!canEditOrDelete(user, existing)) return res.status(403).json({ error: 'Forbidden' });
  if (existing.internalNo) return res.status(400).json({ error: 'Work order already generated' });

  const internalNo = await generateInternalNo(existing.operatingCompany);
  const newStatus = deriveStatus(internalNo, existing.startDate, existing.endDate, existing.status);

  const updated = await prisma.workOrder.update({
    where: { id: existing.id },
    data: { internalNo, status: newStatus },
    select: workOrderSelect,
  });
  await logAudit(user.id, 'WORK_ORDER_GENERATE', existing.id);
  return res.json({ workOrder: updated });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const user = req.user!;
  const existing = await prisma.workOrder.findFirst({ where: { id: req.params.id, deletedAt: null }, select: workOrderSelect });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (!canEditOrDelete(user, existing)) return res.status(403).json({ error: 'Forbidden' });
  const { reason } = req.body as { reason?: string };
  if (existing.internalNo && !reason) {
    return res.status(400).json({ error: 'Delete reason required for generated records' });
  }

  await prisma.workOrder.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), deleteReason: reason || null },
  });
  await createDeleteNotification(existing, user.id, reason);
  await logAudit(user.id, 'WORK_ORDER_DELETE', existing.id);
  return res.json({ success: true });
});

router.post('/:id/export', requireAuth, requireRole([Role.FINANCE, Role.OPS, Role.ADMIN]), async (req, res) => {
  const existing = await prisma.workOrder.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { id: true, internalNo: true } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  return res.json({ message: `Export placeholder for work order ${existing.internalNo ?? existing.id}` });
});

router.post('/:id/print', requireAuth, requireRole([Role.FINANCE, Role.OPS, Role.ADMIN]), async (req, res) => {
  const existing = await prisma.workOrder.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { id: true, internalNo: true } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  return res.json({ message: `Print placeholder for work order ${existing.internalNo ?? existing.id}` });
});

router.post('/export', requireAuth, requireRole([Role.FINANCE, Role.OPS, Role.ADMIN]), async (_req, res) => {
  return res.json({ message: 'Module 1 export placeholder' });
});

export default router;
