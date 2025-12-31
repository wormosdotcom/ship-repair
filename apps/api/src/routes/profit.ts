import { Router } from 'express';
import { Prisma, PrismaClient, Role, ProfitReportStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

const workOrderBasicSelect = { id: true, internalNo: true, createdById: true, vesselName: true, imo: true };

function canEdit(user: any, workOrder: any) {
  if (!user) return false;
  if (user.role === Role.ADMIN || user.role === Role.FINANCE) return true;
  if (user.role === Role.OPS && workOrder.createdById === user.id) return true;
  return false;
}

async function getWorkOrder(workOrderId: string) {
  return prisma.workOrder.findFirst({ where: { id: workOrderId, deletedAt: null }, select: workOrderBasicSelect });
}

function ratingFromMargin(margin: number) {
  if (margin >= 30) return 'A';
  if (margin >= 15) return 'B';
  if (margin >= 5) return 'C';
  return 'D';
}

function paymentRating(totalInvoices: number, totalPayments: number, overdue: boolean) {
  if (totalInvoices === 0 && totalPayments === 0) return 'C';
  if (totalPayments >= totalInvoices && totalInvoices > 0) return 'A';
  if (overdue) return 'D';
  if (totalPayments > 0) return 'B';
  return 'C';
}

function overallRating(profitRating: string, payRating: string) {
  const map: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
  const avg = (map[profitRating] + map[payRating]) / 2;
  if (avg >= 3.5) return 'A';
  if (avg >= 2.5) return 'B';
  if (avg >= 1.5) return 'C';
  return 'D';
}

async function costSnapshot(workOrderId: string) {
  const lines = await prisma.costLine.findMany({
    where: { workOrderId, deletedAt: null },
    select: { id: true, itemName: true, category: true, unitPrice: true, quantity: true, lineTotal: true, notes: true, isLocked: true },
  });
  const costTotal = lines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
  const costBreakdown: Record<string, number> = {};
  lines.forEach((l) => {
    costBreakdown[l.category] = (costBreakdown[l.category] || 0) + Number(l.lineTotal);
  });
  return { lines, costTotal, costBreakdown };
}

async function incomeSnapshot(workOrderId: string) {
  const quotes = await prisma.quote.findMany({ where: { workOrderId }, select: { id: true, amount: true, currency: true, isFinal: true } });
  const invoices = await prisma.invoice.findMany({ where: { workOrderId }, select: { id: true, amount: true, currency: true, status: true, invoiceNo: true, dueDate: true } });
  const payments = await prisma.paymentReceipt.findMany({ where: { workOrderId }, select: { id: true, amount: true, currency: true, invoiceId: true, date: true, receiptNo: true } });
  const invoiceTotal = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
  const receiptsTotal = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = invoiceTotal - receiptsTotal;
  const finalQuote = quotes.find((q) => q.isFinal);
  const quoteTotal = quotes.reduce((sum, q) => sum + Number(q.amount), 0);
  return { quotes, invoices, payments, invoiceTotal, receiptsTotal, outstanding, finalQuoteAmount: finalQuote ? Number(finalQuote.amount) : 0, quoteTotal };
}

async function ensurePermission(user: any, workOrderId: string) {
  const workOrder = await getWorkOrder(workOrderId);
  if (!workOrder) return { error: { status: 404, message: 'Work order not found' }, workOrder: null };
  if (user.role === Role.ENGINEER) return { error: { status: 403, message: 'Forbidden' }, workOrder: null };
  if (user.role === Role.OPS && workOrder.createdById !== user.id) return { error: { status: 403, message: 'Forbidden' }, workOrder };
  return { workOrder, error: null };
}

router.use(requireAuth, (req, res, next) => {
  if (req.user?.role === Role.ENGINEER) return res.status(403).json({ error: 'Forbidden' });
  next();
});

// Quotes
router.get('/work-orders/:workOrderId/quotes', async (req, res) => {
  const { workOrder, error } = await ensurePermission(req.user, req.params.workOrderId);
  if (error) return res.status(error.status).json({ error: error.message });
  const quotes = await prisma.quote.findMany({ where: { workOrderId: workOrder!.id }, orderBy: { createdAt: 'desc' } });
  res.json({ quotes });
});

router.post('/work-orders/:workOrderId/quotes', async (req, res) => {
  const user = req.user!;
  const { workOrder, error } = await ensurePermission(user, req.params.workOrderId);
  if (error) return res.status(error.status).json({ error: error.message });
  if (!canEdit(user, workOrder)) return res.status(403).json({ error: 'Forbidden' });
  if (!req.body.amount || !req.body.currency) return res.status(400).json({ error: 'amount and currency required' });

  if (req.body.isFinal) {
    await prisma.quote.updateMany({ where: { workOrderId: workOrder!.id, isFinal: true }, data: { isFinal: false } });
  }

  const quote = await prisma.quote.create({
    data: {
      workOrderId: workOrder!.id,
      amount: new Prisma.Decimal(req.body.amount),
      currency: req.body.currency,
      validityDate: req.body.validityDate ? new Date(req.body.validityDate) : null,
      notes: req.body.notes || null,
      isFinal: !!req.body.isFinal,
      createdById: user.id,
    },
  });
  res.status(201).json({ quote });
});

router.put('/quotes/:id', async (req, res) => {
  const user = req.user!;
  const quote = await prisma.quote.findFirst({ where: { id: req.params.id }, include: { workOrder: { select: workOrderBasicSelect } } });
  if (!quote) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(user, quote.workOrder)) return res.status(403).json({ error: 'Forbidden' });
  if (req.body.isFinal) {
    await prisma.quote.updateMany({ where: { workOrderId: quote.workOrderId, isFinal: true, id: { not: quote.id } }, data: { isFinal: false } });
  }
  const updated = await prisma.quote.update({
    where: { id: quote.id },
    data: {
      amount: req.body.amount !== undefined ? new Prisma.Decimal(req.body.amount) : quote.amount,
      currency: req.body.currency || quote.currency,
      validityDate: req.body.validityDate ? new Date(req.body.validityDate) : null,
      notes: req.body.notes || null,
      isFinal: req.body.isFinal ?? quote.isFinal,
    },
  });
  res.json({ quote: updated });
});

router.delete('/quotes/:id', async (req, res) => {
  const user = req.user!;
  const quote = await prisma.quote.findFirst({ where: { id: req.params.id }, include: { workOrder: { select: workOrderBasicSelect } } });
  if (!quote) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(user, quote.workOrder)) return res.status(403).json({ error: 'Forbidden' });
  await prisma.quote.delete({ where: { id: quote.id } });
  res.json({ success: true });
});

// Invoices
router.get('/work-orders/:workOrderId/invoices', async (req, res) => {
  const { workOrder, error } = await ensurePermission(req.user, req.params.workOrderId);
  if (error) return res.status(error.status).json({ error: error.message });
  const invoices = await prisma.invoice.findMany({ where: { workOrderId: workOrder!.id }, orderBy: { createdAt: 'desc' } });
  res.json({ invoices });
});

router.post('/work-orders/:workOrderId/invoices', async (req, res) => {
  const user = req.user!;
  const { workOrder, error } = await ensurePermission(user, req.params.workOrderId);
  if (error) return res.status(error.status).json({ error: error.message });
  if (!canEdit(user, workOrder)) return res.status(403).json({ error: 'Forbidden' });
  const required = ['invoiceNo', 'amount', 'currency', 'issueDate', 'status'];
  for (const f of required) if (!req.body[f]) return res.status(400).json({ error: `${f} is required` });

  const invoice = await prisma.invoice.create({
    data: {
      workOrderId: workOrder!.id,
      invoiceNo: req.body.invoiceNo,
      amount: new Prisma.Decimal(req.body.amount),
      currency: req.body.currency,
      issueDate: new Date(req.body.issueDate),
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      status: req.body.status,
      notes: req.body.notes || null,
      createdById: user.id,
    },
  });
  res.status(201).json({ invoice });
});

router.put('/invoices/:id', async (req, res) => {
  const user = req.user!;
  const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id }, include: { workOrder: { select: workOrderBasicSelect } } });
  if (!invoice) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(user, invoice.workOrder)) return res.status(403).json({ error: 'Forbidden' });

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      invoiceNo: req.body.invoiceNo ?? invoice.invoiceNo,
      amount: req.body.amount !== undefined ? new Prisma.Decimal(req.body.amount) : invoice.amount,
      currency: req.body.currency ?? invoice.currency,
      issueDate: req.body.issueDate ? new Date(req.body.issueDate) : invoice.issueDate,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      status: req.body.status ?? invoice.status,
      notes: req.body.notes ?? invoice.notes,
    },
  });
  res.json({ invoice: updated });
});

router.delete('/invoices/:id', async (req, res) => {
  const user = req.user!;
  const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id }, include: { workOrder: { select: workOrderBasicSelect } } });
  if (!invoice) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(user, invoice.workOrder)) return res.status(403).json({ error: 'Forbidden' });
  await prisma.invoice.delete({ where: { id: invoice.id } });
  res.json({ success: true });
});

// Payments
router.get('/work-orders/:workOrderId/payments', async (req, res) => {
  const { workOrder, error } = await ensurePermission(req.user, req.params.workOrderId);
  if (error) return res.status(error.status).json({ error: error.message });
  const payments = await prisma.paymentReceipt.findMany({ where: { workOrderId: workOrder!.id }, orderBy: { date: 'desc' } });
  res.json({ payments });
});

router.post('/work-orders/:workOrderId/payments', async (req, res) => {
  const user = req.user!;
  const { workOrder, error } = await ensurePermission(user, req.params.workOrderId);
  if (error) return res.status(error.status).json({ error: error.message });
  if (!canEdit(user, workOrder)) return res.status(403).json({ error: 'Forbidden' });
  const required = ['receiptNo', 'amount', 'currency', 'date', 'method'];
  for (const f of required) if (!req.body[f]) return res.status(400).json({ error: `${f} is required` });

  const payment = await prisma.paymentReceipt.create({
    data: {
      workOrderId: workOrder!.id,
      invoiceId: req.body.invoiceId || null,
      receiptNo: req.body.receiptNo,
      amount: new Prisma.Decimal(req.body.amount),
      currency: req.body.currency,
      date: new Date(req.body.date),
      method: req.body.method,
      reference: req.body.reference || null,
      createdById: user.id,
    },
  });
  res.status(201).json({ payment });
});

router.put('/payments/:id', async (req, res) => {
  const user = req.user!;
  const payment = await prisma.paymentReceipt.findFirst({ where: { id: req.params.id }, include: { workOrder: { select: workOrderBasicSelect } } });
  if (!payment) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(user, payment.workOrder)) return res.status(403).json({ error: 'Forbidden' });

  const updated = await prisma.paymentReceipt.update({
    where: { id: payment.id },
    data: {
      invoiceId: req.body.invoiceId ?? payment.invoiceId,
      receiptNo: req.body.receiptNo ?? payment.receiptNo,
      amount: req.body.amount !== undefined ? new Prisma.Decimal(req.body.amount) : payment.amount,
      currency: req.body.currency ?? payment.currency,
      date: req.body.date ? new Date(req.body.date) : payment.date,
      method: req.body.method ?? payment.method,
      reference: req.body.reference ?? payment.reference,
    },
  });
  res.json({ payment: updated });
});

router.delete('/payments/:id', async (req, res) => {
  const user = req.user!;
  const payment = await prisma.paymentReceipt.findFirst({ where: { id: req.params.id }, include: { workOrder: { select: workOrderBasicSelect } } });
  if (!payment) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(user, payment.workOrder)) return res.status(403).json({ error: 'Forbidden' });
  await prisma.paymentReceipt.delete({ where: { id: payment.id } });
  res.json({ success: true });
});

// Profit Reports
router.get('/work-orders/:workOrderId/profit-reports', async (req, res) => {
  const { workOrder, error } = await ensurePermission(req.user, req.params.workOrderId);
  if (error) return res.status(error.status).json({ error: error.message });
  const reports = await prisma.profitReport.findMany({ where: { workOrderId: workOrder!.id }, orderBy: { createdAt: 'desc' } });
  res.json({ reports });
});

router.get('/profit-reports/:id', async (req, res) => {
  const report = await prisma.profitReport.findFirst({
    where: { id: req.params.id },
    include: { workOrder: { select: workOrderBasicSelect } },
  });
  if (!report) return res.status(404).json({ error: 'Not found' });
  const user = req.user!;
  if (user.role === Role.ENGINEER) return res.status(403).json({ error: 'Forbidden' });
  if (user.role === Role.OPS && report.workOrder.createdById !== user.id) return res.status(403).json({ error: 'Forbidden' });
  res.json({ report });
});

router.post('/work-orders/:workOrderId/profit-reports/generate', async (req, res) => {
  const user = req.user!;
  const { workOrder, error } = await ensurePermission(user, req.params.workOrderId);
  if (error) return res.status(error.status).json({ error: error.message });
  if (!canEdit(user, workOrder)) return res.status(403).json({ error: 'Forbidden' });

  const { costTotal, costBreakdown } = await costSnapshot(workOrder!.id);
  const income = await incomeSnapshot(workOrder!.id);
  const revenueTotal = income.invoiceTotal || income.finalQuoteAmount || 0;
  const profit = revenueTotal - costTotal;
  const marginPercent = costTotal ? (profit / costTotal) * 100 : 0;
  const profitRating = ratingFromMargin(marginPercent);
  const hasOverdue = income.invoices.some((i) => i.status === 'OVERDUE');
  const payRating = paymentRating(income.invoiceTotal, income.receiptsTotal, hasOverdue);
  const overall = overallRating(profitRating, payRating);

  const report = await prisma.profitReport.create({
    data: {
      workOrderId: workOrder!.id,
      status: ProfitReportStatus.DRAFT,
      revenueTotal: new Prisma.Decimal(revenueTotal),
      costTotal: new Prisma.Decimal(costTotal),
      profit: new Prisma.Decimal(profit),
      marginPercent: new Prisma.Decimal(marginPercent.toFixed(2)),
      incomeBreakdown: {
        invoiceTotal: income.invoiceTotal,
        receiptsTotal: income.receiptsTotal,
        outstanding: income.outstanding,
        quoteTotal: income.quoteTotal,
        finalQuoteAmount: income.finalQuoteAmount,
      },
      costBreakdown,
      lockedCostSnapshot: {},
      lockedInvoiceSnapshot: {},
      profitabilityRating: profitRating,
      paymentRating: payRating,
      overallRating: overall,
      createdById: user.id,
    },
  });
  res.status(201).json({ report });
});

router.post('/profit-reports/:id/confirm', async (req, res) => {
  const user = req.user!;
  const existing = await prisma.profitReport.findFirst({
    where: { id: req.params.id },
    include: { workOrder: { select: workOrderBasicSelect } },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.status === ProfitReportStatus.CONFIRMED) return res.status(400).json({ error: 'Already confirmed' });
  if (!canEdit(user, existing.workOrder)) return res.status(403).json({ error: 'Forbidden' });

  const income = await incomeSnapshot(existing.workOrderId);
  const { lines, costTotal, costBreakdown } = await costSnapshot(existing.workOrderId);
  if (costTotal <= 0) return res.status(400).json({ error: 'Costs must be greater than zero to confirm' });
  const hasInvoicesOrFinal = income.invoiceTotal > 0 || income.finalQuoteAmount > 0;
  if (!hasInvoicesOrFinal) return res.status(400).json({ error: 'Require at least one invoice or final quote to confirm' });

  // enforce single confirmed per work order
  const confirmedExists = await prisma.profitReport.findFirst({
    where: { workOrderId: existing.workOrderId, status: ProfitReportStatus.CONFIRMED },
  });
  if (confirmedExists) return res.status(400).json({ error: 'Confirmed report already exists for this work order' });

  // lock costs
  await prisma.costLine.updateMany({
    where: { workOrderId: existing.workOrderId, deletedAt: null },
    data: { isLocked: true, lockedAt: new Date(), lockedById: user.id },
  });

  const revenueTotal = income.invoiceTotal || income.finalQuoteAmount || 0;
  const profit = revenueTotal - costTotal;
  const marginPercent = costTotal ? (profit / costTotal) * 100 : 0;
  const profitRating = ratingFromMargin(marginPercent);
  const hasOverdue = income.invoices.some((i) => i.status === 'OVERDUE');
  const payRating = paymentRating(income.invoiceTotal, income.receiptsTotal, hasOverdue);
  const overall = overallRating(profitRating, payRating);

  const report = await prisma.profitReport.update({
    where: { id: existing.id },
    data: {
      status: ProfitReportStatus.CONFIRMED,
      revenueTotal: new Prisma.Decimal(revenueTotal),
      costTotal: new Prisma.Decimal(costTotal),
      profit: new Prisma.Decimal(profit),
      marginPercent: new Prisma.Decimal(marginPercent.toFixed(2)),
      incomeBreakdown: {
        invoiceTotal: income.invoiceTotal,
        receiptsTotal: income.receiptsTotal,
        outstanding: income.outstanding,
        quoteTotal: income.quoteTotal,
        finalQuoteAmount: income.finalQuoteAmount,
      },
      costBreakdown,
      lockedCostSnapshot: { lines },
      lockedInvoiceSnapshot: { invoices: income.invoices, payments: income.payments },
      profitabilityRating: profitRating,
      paymentRating: payRating,
      overallRating: overall,
      confirmedById: user.id,
      confirmedAt: new Date(),
    },
  });

  res.json({ report });
});

router.get('/profit-reports/:id/export', async (req, res) => {
  const report = await prisma.profitReport.findFirst({
    where: { id: req.params.id },
    include: { workOrder: { select: workOrderBasicSelect } },
  });
  if (!report) return res.status(404).json({ error: 'Not found' });
  const user = req.user!;
  if (user.role === Role.ENGINEER) return res.status(403).json({ error: 'Forbidden' });
  if (user.role === Role.OPS && report.workOrder.createdById !== user.id) return res.status(403).json({ error: 'Forbidden' });
  const format = req.query.format || 'pdf';
  res.json({ message: `Export ${format} placeholder for report ${report.id}` });
});

router.get('/profit-reports/:id/print', async (req, res) => {
  const report = await prisma.profitReport.findFirst({
    where: { id: req.params.id },
    include: { workOrder: { select: workOrderBasicSelect } },
  });
  if (!report) return res.status(404).json({ error: 'Not found' });
  const user = req.user!;
  if (user.role === Role.ENGINEER) return res.status(403).json({ error: 'Forbidden' });
  if (user.role === Role.OPS && report.workOrder.createdById !== user.id) return res.status(403).json({ error: 'Forbidden' });
  res.json({ message: `Print placeholder for report ${report.id}` });
});

export default router;
