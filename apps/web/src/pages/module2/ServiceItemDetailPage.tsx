import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { useAuth } from '../../context/AuthContext';
import { fetchServiceItem } from '../../lib/api';
import { ServiceItem } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';

export function ServiceItemDetailPage() {
  const { serviceItemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<ServiceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    if (!item || !user) return false;
    if (user.role === 'ADMIN') return true;
    if (user.role === 'OPS' && item.workOrder?.createdById === user.id) return true;
    return false;
  }, [item, user]);

  useEffect(() => {
    load();
  }, [serviceItemId]);

  async function load() {
    if (!serviceItemId) return;
    setLoading(true);
    const res = await fetchServiceItem(serviceItemId);
    if (res.error) setError(res.error);
    if (res.data?.serviceItem) setItem(res.data.serviceItem);
    setLoading(false);
  }

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-6 text-slate-700">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!item) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Service Item</p>
            <h1 className="text-2xl font-bold text-slate-900">{item.equipmentName}</h1>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={item.status as any} />
              <span className="text-sm text-slate-600">Updated {new Date(item.updatedAt).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="bg-white" onClick={() => navigate(`/app/module2/work-orders/${item.workOrderId}/service-items`)}>
              Back
            </Button>
            {canEdit && (
              <Button onClick={() => navigate(`/app/module2/service-items/${item.id}/edit`)}>
                Edit
              </Button>
            )}
            <Button variant="ghost" className="bg-white" onClick={handlePrint}>
              Print
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900">Details</h3>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Field label="Status" value={item.status.replace('_', ' ')} />
            <Field label="Equipment" value={item.equipmentName} />
            <Field label="Model" value={item.model || '—'} />
            <Field label="Serial" value={item.serial || '—'} />
            <Field label="Assigned Engineers" value={item.assignedEngineers.map((e) => e.name).join(', ') || 'Unassigned'} />
            <div className="md:col-span-2">
              <Field label="Service Content" value={item.serviceContent} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900">Attachments</h3>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            {item.attachments.length === 0 && <p>No attachments.</p>}
            {item.attachments.map((att) => (
              <div key={att.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <div>
                  <p className="font-semibold text-slate-900">{att.filename}</p>
                  <p className="text-xs text-slate-600">{(att.size / 1024).toFixed(1)} KB</p>
                </div>
                <a className="text-sm font-semibold text-blue-700" href={`/api/attachments/${att.id}/download`} target="_blank" rel="noreferrer">
                  Download
                </a>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
