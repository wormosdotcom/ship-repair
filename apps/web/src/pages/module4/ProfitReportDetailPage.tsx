import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { fetchProfitReport, exportProfitReport, printProfitReport } from '../../lib/api';
import { ProfitReport } from '../../types';

export function ProfitReportDetailPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<ProfitReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [reportId]);

  async function load() {
    if (!reportId) return;
    const res = await fetchProfitReport(reportId);
    if (res.error) setError(res.error);
    if (res.data?.report) setReport(res.data.report);
  }

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!report) return <div className="p-6 text-slate-700">Loading…</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Profit Report</p>
            <h1 className="text-2xl font-bold text-slate-900">{report.status}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="bg-white" onClick={() => navigate(-1)}>Back</Button>
            <Button variant="ghost" className="bg-white" onClick={() => exportProfitReport(report.id, 'pdf')}>Export PDF</Button>
            <Button variant="ghost" className="bg-white" onClick={() => exportProfitReport(report.id, 'xlsx')}>Export Excel</Button>
            <Button variant="ghost" className="bg-white" onClick={() => printProfitReport(report.id)}>Print</Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Revenue" value={report.revenueTotal} />
          <Metric label="Cost" value={report.costTotal} />
          <Metric label="Profit" value={report.profit} />
          <Metric label="Margin %" value={report.marginPercent} suffix="%" />
        </div>

        <Card>
          <CardHeader><h3 className="text-base font-semibold text-slate-900">Income Breakdown</h3></CardHeader>
          <CardContent className="text-sm text-slate-700 space-y-2">
            <p>Quote Total: {report.incomeBreakdown?.quoteTotal ?? 0}</p>
            <p>Invoice Total: {report.incomeBreakdown?.invoiceTotal ?? 0}</p>
            <p>Receipts Total: {report.incomeBreakdown?.receiptsTotal ?? 0}</p>
            <p>Outstanding: {report.incomeBreakdown?.outstanding ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="text-base font-semibold text-slate-900">Cost Breakdown (snapshot)</h3></CardHeader>
          <CardContent className="text-sm text-slate-700 space-y-2">
            {report.costBreakdown && Object.entries(report.costBreakdown).map(([k,v]) => (
              <p key={k}>{k}: {Number(v as any).toFixed(2)}</p>
            ))}
          </CardContent>
        </Card>
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
