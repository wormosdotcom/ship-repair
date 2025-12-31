import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../context/AuthContext';
import {
  confirmProfitReport,
  createInvoice,
  createPayment,
  createQuote,
  deleteInvoice,
  deletePayment,
  deleteQuote,
  exportProfitReport,
  fetchInvoices,
  fetchPayments,
  fetchProfitReports,
  fetchQuotes,
  generateProfitReport,
  printProfitReport,
  updateInvoice,
  updatePayment,
  updateQuote,
} from '../../lib/api';
import { Invoice, InvoiceStatus, PaymentMethod, PaymentReceipt, ProfitReport, Quote, ProfitReportStatus, Currency } from '../../types';

const invoiceStatuses: InvoiceStatus[] = ['DRAFT', 'SENT', 'PAID', 'OVERDUE'];
const currencies: Currency[] = ['CNY', 'USD', 'OTHER'];
const paymentMethods: PaymentMethod[] = ['BANK', 'CASH', 'OTHER'];

export function WorkOrderProfitPage() {
  const { workOrderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentReceipt[]>([]);
  const [reports, setReports] = useState<ProfitReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [tab, setTab] = useState<'business' | 'analysis'>('business');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [quoteForm, setQuoteForm] = useState({ amount: '', currency: 'CNY', validityDate: '', notes: '', isFinal: false });
  const [invoiceForm, setInvoiceForm] = useState({ invoiceNo: '', amount: '', currency: 'CNY', issueDate: '', dueDate: '', status: 'DRAFT', notes: '' });
  const [paymentForm, setPaymentForm] = useState({ invoiceId: '', receiptNo: '', amount: '', currency: 'CNY', date: '', method: 'BANK', reference: '' });

  const selectedReport = useMemo(() => reports.find((r) => r.id === selectedReportId) || reports[0], [reports, selectedReportId]);

  const canEdit = useMemo(() => {
    if (!user) return false;
    if (user.role === 'ENGINEER') return false;
    if (user.role === 'ADMIN' || user.role === 'FINANCE') return true;
    return user.role === 'OPS';
  }, [user]);

  useEffect(() => {
    if (!workOrderId) return;
    loadAll();
  }, [workOrderId]);

  async function loadAll() {
    if (!workOrderId) return;
    setLoading(true);
    const [qRes, iRes, pRes, rRes] = await Promise.all([
      fetchQuotes(workOrderId),
      fetchInvoices(workOrderId),
      fetchPayments(workOrderId),
      fetchProfitReports(workOrderId),
    ]);
    if (qRes.data?.quotes) setQuotes(qRes.data.quotes);
    if (iRes.data?.invoices) setInvoices(iRes.data.invoices);
    if (pRes.data?.payments) setPayments(pRes.data.payments);
    if (rRes.data?.reports) {
      setReports(rRes.data.reports);
      if (!selectedReportId && rRes.data.reports.length) setSelectedReportId(rRes.data.reports[0].id);
    }
    setLoading(false);
  }

  const invoiceTotal = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
  const receiptsTotal = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = invoiceTotal - receiptsTotal;

  const handleCreateQuote = async () => {
    if (!workOrderId) return;
    const res = await createQuote(workOrderId, { ...quoteForm, amount: Number(quoteForm.amount), currency: quoteForm.currency as Currency });
    if (res.error) setError(res.error); else setQuoteForm({ amount: '', currency: 'CNY', validityDate: '', notes: '', isFinal: false });
    await loadAll();
  };

  const markFinal = async (id: string) => {
    await updateQuote(id, { isFinal: true });
    await loadAll();
  };

  const handleCreateInvoice = async () => {
    if (!workOrderId) return;
    const res = await createInvoice(workOrderId, {
      ...invoiceForm,
      amount: Number(invoiceForm.amount),
      issueDate: invoiceForm.issueDate,
      dueDate: invoiceForm.dueDate || undefined,
      currency: invoiceForm.currency as Currency,
      status: invoiceForm.status as InvoiceStatus,
    });
    if (res.error) setError(res.error); else setInvoiceForm({ invoiceNo: '', amount: '', currency: 'CNY', issueDate: '', dueDate: '', status: 'DRAFT', notes: '' });
    await loadAll();
  };

  const handleCreatePayment = async () => {
    if (!workOrderId) return;
    const res = await createPayment(workOrderId, {
      ...paymentForm,
      amount: Number(paymentForm.amount),
      date: paymentForm.date,
      invoiceId: paymentForm.invoiceId || undefined,
      currency: paymentForm.currency as Currency,
      method: paymentForm.method as PaymentMethod,
    });
    if (res.error) setError(res.error); else setPaymentForm({ invoiceId: '', receiptNo: '', amount: '', currency: 'CNY', date: '', method: 'BANK', reference: '' });
    await loadAll();
  };

  const generateReport = async () => {
    if (!workOrderId) return;
    const res = await generateProfitReport(workOrderId);
    if (res.error) setError(res.error); else await loadAll();
  };

  const confirmReport = async (id: string) => {
    const res = await confirmProfitReport(id);
    if (res.error) setError(res.error); else await loadAll();
  };

  const isLocked = selectedReport?.status === 'CONFIRMED';

  if (user?.role === 'ENGINEER') {
    return <div className="p-6 text-red-600">Engineers cannot access Module 4.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Profit Analysis</p>
            <h1 className="text-2xl font-bold text-slate-900">Work Order {workOrderId}</h1>
            {isLocked && <span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Confirmed</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="bg-white" onClick={() => navigate('/app/module1/dashboard')}>
              Back
            </Button>
            {selectedReport && (
              <>
                <Button variant="ghost" className="bg-white" onClick={() => exportProfitReport(selectedReport.id, 'pdf')}>Export PDF</Button>
                <Button variant="ghost" className="bg-white" onClick={() => exportProfitReport(selectedReport.id, 'xlsx')}>Export Excel</Button>
                <Button variant="ghost" className="bg-white" onClick={() => printProfitReport(selectedReport.id)}>Print</Button>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3 text-sm">
          <button className={`rounded-md px-3 py-2 ${tab === 'business' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`} onClick={() => setTab('business')}>Business View</button>
          <button className={`rounded-md px-3 py-2 ${tab === 'analysis' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`} onClick={() => setTab('analysis')}>Analysis View</button>
        </div>

        {tab === 'business' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-slate-900">Quotes</h3>
                <p className="text-sm text-slate-600">Mark one final.</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                {quotes.map((q) => (
                  <div key={q.id} className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{Number(q.amount).toFixed(2)} {q.currency}</p>
                        {q.validityDate && <p className="text-xs text-slate-600">Valid: {q.validityDate.slice(0,10)}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="radio" checked={q.isFinal} onChange={() => markFinal(q.id)} disabled={!canEdit} />
                        <span className="text-xs">Final</span>
                        {canEdit && <Button variant="ghost" className="bg-white text-red-700" onClick={() => deleteQuote(q.id)}>Delete</Button>}
                      </div>
                    </div>
                    {q.notes && <p className="text-xs text-slate-600">{q.notes}</p>}
                  </div>
                ))}
                {canEdit && (
                  <div className="space-y-2 rounded-md border border-dashed border-slate-300 p-3">
                    <p className="font-semibold text-slate-900">Add Quote</p>
                    <Input placeholder="Amount" type="number" value={quoteForm.amount} onChange={(e) => setQuoteForm({ ...quoteForm, amount: e.target.value })} />
                    <select className="h-10 rounded-md border border-slate-300 px-2 text-sm" value={quoteForm.currency} onChange={(e) => setQuoteForm({ ...quoteForm, currency: e.target.value as Currency })}>
                      {currencies.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                    <Input type="date" value={quoteForm.validityDate} onChange={(e) => setQuoteForm({ ...quoteForm, validityDate: e.target.value })} />
                    <Input placeholder="Notes" value={quoteForm.notes} onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })} />
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={quoteForm.isFinal} onChange={(e) => setQuoteForm({ ...quoteForm, isFinal: e.target.checked })} />Mark as final</label>
                    <Button onClick={handleCreateQuote} disabled={!canEdit}>Save Quote</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-slate-900">Invoices</h3>
                <p className="text-sm text-slate-600">Totals: {invoiceTotal.toFixed(2)}</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                {invoices.map((inv) => (
                  <div key={inv.id} className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{inv.invoiceNo}</p>
                        <p className="text-xs text-slate-600">{Number(inv.amount).toFixed(2)} {inv.currency}</p>
                        <p className="text-xs text-slate-500">Issue {inv.issueDate.slice(0,10)} {inv.dueDate ? `Due ${inv.dueDate.slice(0,10)}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{inv.status}</span>
                        {canEdit && <Button variant="ghost" className="bg-white text-red-700" onClick={() => deleteInvoice(inv.id)}>Delete</Button>}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="mt-2 flex gap-2">
                        <Button variant="ghost" className="bg-white" onClick={() => updateInvoice(inv.id, { status: 'PAID' })}>Mark Paid</Button>
                      </div>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <div className="space-y-2 rounded-md border border-dashed border-slate-300 p-3">
                    <p className="font-semibold text-slate-900">Add Invoice</p>
                    <Input placeholder="Invoice No" value={invoiceForm.invoiceNo} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNo: e.target.value })} />
                    <Input placeholder="Amount" type="number" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
                    <select className="h-10 rounded-md border border-slate-300 px-2 text-sm" value={invoiceForm.currency} onChange={(e) => setInvoiceForm({ ...invoiceForm, currency: e.target.value as any })}>
                      {currencies.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                    <Input type="date" value={invoiceForm.issueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })} />
                    <Input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} />
                    <select className="h-10 rounded-md border border-slate-300 px-2 text-sm" value={invoiceForm.status} onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value as InvoiceStatus })}>
                      {invoiceStatuses.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                    <Input placeholder="Notes" value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} />
                    <Button onClick={handleCreateInvoice} disabled={!canEdit}>Save Invoice</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-slate-900">Payments</h3>
                <p className="text-sm text-slate-600">Received: {receiptsTotal.toFixed(2)} | Outstanding: {outstanding.toFixed(2)}</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                {payments.map((pay) => (
                  <div key={pay.id} className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{pay.receiptNo}</p>
                        <p className="text-xs text-slate-600">{Number(pay.amount).toFixed(2)} {pay.currency} • {pay.method}</p>
                        <p className="text-xs text-slate-500">{pay.date.slice(0,10)}</p>
                      </div>
                      {canEdit && <Button variant="ghost" className="bg-white text-red-700" onClick={() => deletePayment(pay.id)}>Delete</Button>}
                    </div>
                  </div>
                ))}
                {canEdit && (
                  <div className="space-y-2 rounded-md border border-dashed border-slate-300 p-3">
                    <p className="font-semibold text-slate-900">Add Payment</p>
                    <Input placeholder="Receipt No" value={paymentForm.receiptNo} onChange={(e) => setPaymentForm({ ...paymentForm, receiptNo: e.target.value })} />
                    <Input placeholder="Amount" type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                    <select className="h-10 rounded-md border border-slate-300 px-2 text-sm" value={paymentForm.currency} onChange={(e) => setPaymentForm({ ...paymentForm, currency: e.target.value as Currency })}>
                      {currencies.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                    <Input type="date" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} />
                    <select className="h-10 rounded-md border border-slate-300 px-2 text-sm" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}>
                      {paymentMethods.map((m) => (<option key={m} value={m}>{m}</option>))}
                    </select>
                    <Input placeholder="Reference" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
                    <Button onClick={handleCreatePayment} disabled={!canEdit}>Save Payment</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'analysis' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={generateReport} disabled={!canEdit}>Generate Draft</Button>
              {selectedReport && selectedReport.status === 'DRAFT' && (
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => confirmReport(selectedReport.id)} disabled={!canEdit}>
                  Confirm Report (locks costs)
                </Button>
              )}
              <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={selectedReport?.id || ''} onChange={(e) => setSelectedReportId(e.target.value || null)}>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.status} • {new Date(r.createdAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            {selectedReport ? (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <Metric label="Revenue" value={selectedReport.revenueTotal} />
                  <Metric label="Cost" value={selectedReport.costTotal} />
                  <Metric label="Profit" value={selectedReport.profit} />
                  <Metric label="Margin %" value={selectedReport.marginPercent} suffix="%" />
                </div>
                <Card>
                  <CardHeader><h3 className="text-base font-semibold text-slate-900">Income Breakdown</h3></CardHeader>
                  <CardContent className="text-sm text-slate-700 space-y-2">
                    <p>Quote Total: {selectedReport.incomeBreakdown?.quoteTotal ?? 0}</p>
                    <p>Invoice Total: {selectedReport.incomeBreakdown?.invoiceTotal ?? 0}</p>
                    <p>Receipts Total: {selectedReport.incomeBreakdown?.receiptsTotal ?? 0}</p>
                    <p>Outstanding: {selectedReport.incomeBreakdown?.outstanding ?? 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><h3 className="text-base font-semibold text-slate-900">Cost Breakdown</h3></CardHeader>
                  <CardContent className="text-sm text-slate-700 space-y-2">
                    {selectedReport.costBreakdown && Object.entries(selectedReport.costBreakdown).map(([k,v]) => (
                      <p key={k}>{k}: {Number(v as any).toFixed(2)}</p>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><h3 className="text-base font-semibold text-slate-900">Ratings</h3></CardHeader>
                  <CardContent className="grid gap-2 md:grid-cols-3 text-sm text-slate-700">
                    <Rating label="Profitability" value={selectedReport.profitabilityRating} />
                    <Rating label="Payment" value={selectedReport.paymentRating} />
                    <Rating label="Overall" value={selectedReport.overallRating} />
                  </CardContent>
                </Card>
              </>
            ) : (
              <p className="text-sm text-slate-700">No reports yet. Generate a draft to begin.</p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-slate-600">Loading…</p>}
      </div>
    </div>
  );
}

function Metric({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900">{Number(value).toFixed(2)}{suffix}</p>
    </div>
  );
}

function Rating({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
