import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { useAuth } from '../../context/AuthContext';
import { WorkOrder } from '../../types';
import { deleteWorkOrder, exportWorkOrder, fetchWorkOrder, generateWorkOrder, printWorkOrder } from '../../lib/api';
import { DeleteModal } from '../../components/DeleteModal';

export function WorkOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const canEdit = workOrder && user && (user.role === 'ADMIN' || (user.role === 'OPS' && workOrder.createdById === user.id));
  const canExport = hasRole('FINANCE', 'OPS', 'ADMIN');

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    if (!id) return;
    setLoading(true);
    const res = await fetchWorkOrder(id);
    if (res.error) setError(res.error);
    if (res.data?.workOrder) setWorkOrder(res.data.workOrder);
    setLoading(false);
  }

  const handleGenerate = async () => {
    if (!id) return;
    const res = await generateWorkOrder(id);
    if (res.error) {
      alert(res.error);
    } else if (res.data?.workOrder) {
      setWorkOrder(res.data.workOrder);
    }
  };

  const handleDelete = async (reason?: string) => {
    if (!id) return;
    const res = await deleteWorkOrder(id, reason);
    if (res.error) {
      alert(res.error);
    } else {
      setShowDelete(false);
      navigate('/app/module1/dashboard');
    }
  };

  const handleExport = async () => {
    if (!id) return;
    const res = await exportWorkOrder(id);
    if (res.error) alert(res.error);
    else alert(res.data?.message || 'Export triggered');
  };

  const handlePrint = async () => {
    if (!id) return;
    const res = await printWorkOrder(id);
    if (res.error) alert(res.error);
    else alert(res.data?.message || 'Print triggered');
  };

  if (loading) return <div className="p-6 text-slate-700">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!workOrder) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Work Order</p>
            <h1 className="text-2xl font-bold text-slate-900">{workOrder.internalNo || 'Draft'}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={workOrder.status} />
              <span className="text-sm text-slate-600">Schedule: {workOrder.startDate.slice(0, 10)} → {workOrder.endDate.slice(0, 10)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="bg-white" onClick={() => navigate('/app/module1/dashboard')}>
              Back
            </Button>
            {canEdit && (
              <Button onClick={() => navigate(`/app/module1/work-orders/${workOrder.id}/edit`)}>
                Edit
              </Button>
            )}
            {canEdit && !workOrder.internalNo && (
              <Button onClick={handleGenerate}>
                Generate Record
              </Button>
            )}
            {canExport && (
              <Button variant="ghost" className="bg-white" onClick={handleExport}>
                Export
              </Button>
            )}
            {canExport && (
              <Button variant="ghost" className="bg-white" onClick={handlePrint}>
                Print
              </Button>
            )}
            {canEdit && (
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => setShowDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader><h3 className="text-lg font-semibold text-slate-900">Basic Info</h3></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <Field label="Operating Company" value={workOrder.operatingCompany} />
              <Field label="Order Type" value={workOrder.orderType} />
              <Field label="Payment Terms" value={workOrder.paymentTerms} />
              <Field label="PO" value={workOrder.po || '—'} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-lg font-semibold text-slate-900">Vessel Info</h3></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <Field label="Customer" value={workOrder.customerCompany} />
              <Field label="Vessel Name" value={workOrder.vesselName} />
              <Field label="IMO" value={workOrder.imo} />
              <Field label="Vessel Type" value={workOrder.vesselType || '—'} />
              <Field label="Year Built" value={workOrder.yearBuilt?.toString() || '—'} />
              <Field label="Gross Tonnage" value={workOrder.grossTonnage?.toString() || '—'} />
              <Field label="Notes" value={workOrder.vesselNotes || '—'} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-lg font-semibold text-slate-900">Service Info</h3></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <Field label="Location" value={`${workOrder.locationType} / ${workOrder.locationName}, ${workOrder.city}`} />
              <Field label="Start Date" value={workOrder.startDate.slice(0, 10)} />
              <Field label="End Date" value={workOrder.endDate.slice(0, 10)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-lg font-semibold text-slate-900">Personnel</h3></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <Field label="Responsible Engineer" value={workOrder.responsibleEngineerName || '—'} />
              <Field label="Responsible Ops" value={workOrder.responsibleOpsName || '—'} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><h3 className="text-lg font-semibold text-slate-900">Metadata</h3></CardHeader>
          <CardContent className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Created By" value={workOrder.createdBy?.name || workOrder.createdById} />
            <Field label="Created At" value={new Date(workOrder.createdAt).toLocaleString()} />
            <Field label="Updated At" value={new Date(workOrder.updatedAt).toLocaleString()} />
            <Field label="Delete Reason" value={workOrder.deleteReason || '—'} />
          </CardContent>
        </Card>
      </div>

      <DeleteModal
        isOpen={showDelete}
        requireReason={!!workOrder.internalNo}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
