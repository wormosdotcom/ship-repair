import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { WorkOrder, WorkOrderStatus } from '../../types';
import { createWorkOrder, deleteWorkOrder, fetchWorkOrder, generateWorkOrder, updateWorkOrder } from '../../lib/api';
import { DeleteModal } from '../../components/DeleteModal';

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

export function WorkOrderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(!!id);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(!id);
  const [showDelete, setShowDelete] = useState(false);

  const canCreate = hasRole('OPS', 'ADMIN');
  const canEdit = workOrder && user && (user.role === 'ADMIN' || (user.role === 'OPS' && workOrder.createdById === user.id));
  const canDelete = canEdit;

  useEffect(() => {
    if (id) load();
    else initNew();
  }, [id]);

  function initNew() {
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    setForm({
      operatingCompany: '',
      orderType: '',
      paymentTerms: '',
      customerCompany: '',
      vesselName: '',
      imo: '',
      vesselType: '',
      yearBuilt: '',
      grossTonnage: '',
      vesselNotes: '',
      po: '',
      locationType: '',
      locationName: '',
      city: '',
      startDate: now.toISOString().slice(0, 10),
      endDate: tomorrow.toISOString().slice(0, 10),
      responsibleEngineerName: '',
      responsibleOpsName: '',
    });
  }

  async function load() {
    if (!id) return;
    setLoading(true);
    const res = await fetchWorkOrder(id);
    if (res.error) setError(res.error);
    if (res.data?.workOrder) {
      setWorkOrder(res.data.workOrder);
      setForm({
        operatingCompany: res.data.workOrder.operatingCompany,
        orderType: res.data.workOrder.orderType,
        paymentTerms: res.data.workOrder.paymentTerms,
        customerCompany: res.data.workOrder.customerCompany,
        vesselName: res.data.workOrder.vesselName,
        imo: res.data.workOrder.imo,
        vesselType: res.data.workOrder.vesselType || '',
        yearBuilt: res.data.workOrder.yearBuilt ?? '',
        grossTonnage: res.data.workOrder.grossTonnage ?? '',
        vesselNotes: res.data.workOrder.vesselNotes || '',
        po: res.data.workOrder.po || '',
        locationType: res.data.workOrder.locationType,
        locationName: res.data.workOrder.locationName,
        city: res.data.workOrder.city,
        startDate: res.data.workOrder.startDate.slice(0, 10),
        endDate: res.data.workOrder.endDate.slice(0, 10),
        responsibleEngineerName: res.data.workOrder.responsibleEngineerName || '',
        responsibleOpsName: res.data.workOrder.responsibleOpsName || '',
      });
    }
    setLoading(false);
  }

  const isNew = !id;
  const readOnly = id ? !isEditing : false;

  const validationError = useMemo(() => {
    for (const field of requiredFields) {
      if (!form[field]) return `${field} is required`;
    }
    if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
      return 'Start date must be before or equal to end date';
    }
    return null;
  }, [form]);

  const canSaveDraft = canCreate || canEdit;

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const persistData = async (generate: boolean) => {
    if (!canSaveDraft) {
      alert('You do not have permission');
      return;
    }
    if (validationError) {
      alert(validationError);
      return;
    }
    setLoading(true);
    setError(null);

    const payload = {
      ...form,
      yearBuilt: form.yearBuilt ? Number(form.yearBuilt) : undefined,
      grossTonnage: form.grossTonnage ? Number(form.grossTonnage) : undefined,
    };

    let targetId = id;
    if (isNew) {
      const res = await createWorkOrder(payload as any);
      if (res.error || !res.data?.workOrder) {
        setError(res.error || 'Failed to save');
        setLoading(false);
        return;
      }
      targetId = res.data.workOrder.id;
      setWorkOrder(res.data.workOrder);
    } else if (id) {
      const res = await updateWorkOrder(id, payload as any);
      if (res.error || !res.data?.workOrder) {
        setError(res.error || 'Failed to save');
        setLoading(false);
        return;
      }
      setWorkOrder(res.data.workOrder);
    }

    if (generate && targetId) {
      const resGen = await generateWorkOrder(targetId);
      if (resGen.error) {
        setError(resGen.error);
      } else if (resGen.data?.workOrder) {
        setWorkOrder(resGen.data.workOrder);
        setIsEditing(false);
      }
    }

    setLoading(false);
    if (targetId) navigate(`/app/module1/work-orders/${targetId}`);
  };

  const handleDelete = async (reason?: string) => {
    if (!id) return;
    const res = await deleteWorkOrder(id, reason);
    if (res.error) alert(res.error);
    else navigate('/app/module1/dashboard');
  };

  if (!id && !canCreate) {
    return <div className="p-6 text-red-600">You do not have permission to create work orders.</div>;
  }
  if (id && workOrder && !canEdit) {
    return <div className="p-6 text-red-600">You do not have permission to edit this work order.</div>;
  }

  if (loading && id && !workOrder) {
    return <div className="p-6 text-slate-700">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Work Order Form</p>
            <h1 className="text-2xl font-bold text-slate-900">{workOrder?.internalNo || 'Draft'}</h1>
            {workOrder?.status && <div className="mt-2"><StatusBadge status={workOrder.status} /></div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="bg-white" onClick={() => navigate(workOrder ? `/app/module1/work-orders/${workOrder.id}` : '/app/module1/dashboard')}>
              Back
            </Button>
            {id && canEdit && (
              <Button variant="ghost" className="bg-white" onClick={() => setIsEditing((v) => !v)}>
                {isEditing ? 'View Mode' : 'Edit'}
              </Button>
            )}
            {canSaveDraft && (
              <Button onClick={() => persistData(false)} disabled={loading || (!isNew && readOnly)}>
                Save Draft
              </Button>
            )}
            {canSaveDraft && (
              <Button onClick={() => persistData(true)} disabled={loading}>
                Generate Record
              </Button>
            )}
            {canDelete && id && (
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => setShowDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="overflow-hidden rounded-lg border-2 border-black bg-white shadow-md">
          <div className="grid grid-cols-1 divide-y divide-black">
            <Section title="Step 1 Basic Info">
              <div className="grid gap-4 md:grid-cols-3">
                <SelectField
                  label="Operating Company*"
                  value={form.operatingCompany}
                  onChange={(v) => handleChange('operatingCompany', v)}
                  disabled={readOnly}
                  options={['Wormos', 'iShip', 'Other']}
                />
                <SelectField
                  label="Order Type*"
                  value={form.orderType}
                  onChange={(v) => handleChange('orderType', v)}
                  disabled={readOnly}
                  options={['Dry Dock', 'Voyage Repair', 'Emergency', 'Inspection']}
                />
                <SelectField
                  label="Payment Terms*"
                  value={form.paymentTerms}
                  onChange={(v) => handleChange('paymentTerms', v)}
                  disabled={readOnly}
                  options={['NET30', 'NET45', 'NET60', 'Advance', 'Milestone'] }
                />
              </div>
            </Section>

            <Section title="Step 2 Vessel Info">
              <div className="grid gap-4 md:grid-cols-3">
                <FieldInput label="Customer Company*" value={form.customerCompany} onChange={(v) => handleChange('customerCompany', v)} disabled={readOnly} />
                <FieldInput label="Vessel Name*" value={form.vesselName} onChange={(v) => handleChange('vesselName', v)} disabled={readOnly} />
                <FieldInput label="IMO*" value={form.imo} onChange={(v) => handleChange('imo', v)} disabled={readOnly} />
                <SelectField
                  label="Vessel Type"
                  value={form.vesselType}
                  onChange={(v) => handleChange('vesselType', v)}
                  disabled={readOnly}
                  options={['Cargo', 'Tanker', 'Bulk Carrier', 'Container', 'Ferry', 'Offshore', 'Other']}
                  allowBlank
                />
                <FieldInput label="Year Built" value={form.yearBuilt} onChange={(v) => handleChange('yearBuilt', v)} disabled={readOnly} />
                <FieldInput label="Gross Tonnage" value={form.grossTonnage} onChange={(v) => handleChange('grossTonnage', v)} disabled={readOnly} />
                <div className="md:col-span-3">
                  <FieldInput label="Vessel Notes" value={form.vesselNotes} onChange={(v) => handleChange('vesselNotes', v)} disabled={readOnly} />
                </div>
              </div>
            </Section>

            <Section title="Step 3 Service Info">
              <div className="grid gap-4 md:grid-cols-3">
                <FieldInput label="PO" value={form.po} onChange={(v) => handleChange('po', v)} disabled={readOnly} />
                <FieldInput label="Internal No" value={workOrder?.internalNo || '—'} disabled readOnly />
                <div />
                <SelectField
                  label="Location Type*"
                  value={form.locationType}
                  onChange={(v) => handleChange('locationType', v)}
                  disabled={readOnly}
                  options={['Shipyard', 'Anchorage', 'At Sea', 'Port'] }
                />
                <FieldInput label="Location Name*" value={form.locationName} onChange={(v) => handleChange('locationName', v)} disabled={readOnly} />
                <FieldInput label="City*" value={form.city} onChange={(v) => handleChange('city', v)} disabled={readOnly} />
                <div>
                  <FieldInput label="Start Date*" type="date" value={form.startDate} onChange={(v) => handleChange('startDate', v)} disabled={readOnly} />
                  <p className="mt-1 text-xs text-red-600">Status turns In Service on start date</p>
                </div>
                <div>
                  <FieldInput label="End Date*" type="date" value={form.endDate} onChange={(v) => handleChange('endDate', v)} disabled={readOnly} />
                  <p className="mt-1 text-xs text-red-600">Status turns Completed after end date</p>
                </div>
              </div>
            </Section>

            <Section title="Step 4 Personnel Info">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldInput label="Responsible Engineer" value={form.responsibleEngineerName} onChange={(v) => handleChange('responsibleEngineerName', v)} disabled={readOnly} />
                <FieldInput label="Responsible Ops" value={form.responsibleOpsName} onChange={(v) => handleChange('responsibleOpsName', v)} disabled={readOnly} />
              </div>
            </Section>

            <Section title="Footer Meta">
              <div className="grid gap-4 md:grid-cols-3 text-sm text-slate-700">
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Created By</span>
                  <span className="font-semibold">{workOrder?.createdBy?.name || workOrder?.createdById || '—'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Created At</span>
                  <span className="font-semibold">{workOrder ? new Date(workOrder.createdAt).toLocaleString() : '—'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Updated At</span>
                  <span className="font-semibold">{workOrder ? new Date(workOrder.updatedAt).toLocaleString() : '—'}</span>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>

      <DeleteModal
        isOpen={showDelete}
        requireReason={!!workOrder?.internalNo}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 px-4 py-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function FieldInput({ label, value, onChange, type = 'text', disabled = false, readOnly = false }: { label: string; value: any; onChange?: (v: string) => void; type?: string; disabled?: boolean; readOnly?: boolean; }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-800">{label}</label>
      <Input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        readOnly={readOnly}
        className="border-black"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, disabled = false, allowBlank = false }: { label: string; value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean; allowBlank?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-800">{label}</label>
      <select
        className="h-10 w-full rounded-md border border-black bg-white px-3 text-sm shadow-sm"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {(allowBlank || !value) && <option value="">Select</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
