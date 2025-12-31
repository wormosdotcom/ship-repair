import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../context/AuthContext';
import { createServiceItem, deleteAttachment, deleteServiceItem, fetchEngineers, fetchServiceItem, updateServiceItem, uploadServiceAttachment } from '../../lib/api';
import { ServiceItem, ServiceItemStatus, User } from '../../types';

const statusOptions: ServiceItemStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'];

export function ServiceItemFormPage() {
  const { workOrderId, serviceItemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [item, setItem] = useState<ServiceItem | null>(null);
  const [engineers, setEngineers] = useState<User[]>([]);
  const [form, setForm] = useState({
    status: 'PENDING' as ServiceItemStatus,
    equipmentName: '',
    model: '',
    serial: '',
    serviceContent: '',
    assignedEngineerIds: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const isEdit = !!serviceItemId;

  const canEdit = useMemo(() => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if (user.role === 'OPS' && item?.workOrder?.createdById === user.id) return true;
    if (!isEdit && user.role === 'OPS') return true;
    return false;
  }, [user, item, isEdit]);

  useEffect(() => {
    fetchEngineers().then((res) => {
      if (res.data?.engineers) setEngineers(res.data.engineers);
    });
    if (serviceItemId) {
      loadItem();
    }
  }, [serviceItemId]);

  async function loadItem() {
    if (!serviceItemId) return;
    setLoading(true);
    const res = await fetchServiceItem(serviceItemId);
    if (res.error) setError(res.error);
    if (res.data?.serviceItem) {
      setItem(res.data.serviceItem);
      setForm({
        status: res.data.serviceItem.status as ServiceItemStatus,
        equipmentName: res.data.serviceItem.equipmentName,
        model: res.data.serviceItem.model || '',
        serial: res.data.serviceItem.serial || '',
        serviceContent: res.data.serviceItem.serviceContent,
        assignedEngineerIds: res.data.serviceItem.assignedEngineers.map((e) => e.id),
      });
    }
    setLoading(false);
  }

  const validationError = useMemo(() => {
    if (!form.equipmentName) return 'Equipment name is required';
    if (!form.serviceContent) return 'Service content is required';
    if (!form.status) return 'Status is required';
    if (form.status === 'IN_PROGRESS' && form.assignedEngineerIds.length === 0) return 'Assign at least one engineer when In Progress';
    return null;
  }, [form]);

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleEngineer = (id: string) => {
    setForm((prev) => {
      const exists = prev.assignedEngineerIds.includes(id);
      return {
        ...prev,
        assignedEngineerIds: exists ? prev.assignedEngineerIds.filter((e) => e !== id) : [...prev.assignedEngineerIds, id],
      };
    });
  };

  const save = async () => {
    if (!canEdit) {
      alert('No permission');
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);

    if (isEdit && serviceItemId) {
      const res = await updateServiceItem(serviceItemId, form);
      if (res.error || !res.data?.serviceItem) setError(res.error || 'Failed to save');
      else {
        setItem(res.data.serviceItem);
        navigate(`/app/module2/service-items/${serviceItemId}`);
      }
    } else if (workOrderId) {
      const res = await createServiceItem(workOrderId, form);
      if (res.error || !res.data?.serviceItem) setError(res.error || 'Failed to save');
      else {
        navigate(`/app/module2/service-items/${res.data.serviceItem.id}`);
      }
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!serviceItemId) return;
    const res = await deleteServiceItem(serviceItemId);
    if (res.error) setError(res.error);
    else navigate(`/app/module2/work-orders/${item?.workOrderId}/service-items`);
  };

  const handleUpload = async (file: File) => {
    if (!serviceItemId) return;
    const res = await uploadServiceAttachment(serviceItemId, file);
    if (res.error) {
      alert(res.error);
      return;
    }
    await loadItem();
  };

  const handleDeleteAttachment = async (id: string) => {
    const res = await deleteAttachment(id);
    if (res.error) alert(res.error);
    else await loadItem();
  };

  const handlePrint = () => window.print();

  if (!canEdit && !isEdit) {
    return <div className="p-6 text-red-600">You do not have permission to create service items.</div>;
  }
  if (isEdit && !canEdit) {
    return <div className="p-6 text-red-600">You do not have permission to edit this service item.</div>;
  }

  if (loading && isEdit && !item) return <div className="p-6 text-slate-700">Loading…</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Service Item Form</p>
            <h1 className="text-2xl font-bold text-slate-900">{item?.equipmentName || 'New Service Item'}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="bg-white" onClick={() => navigate(item ? `/app/module2/service-items/${item.id}` : `/app/module2/work-orders/${workOrderId}/service-items`)}>
              Back
            </Button>
            {isEdit && (
              <Button variant="ghost" className="bg-white" onClick={handlePrint}>
                Print
              </Button>
            )}
            {isEdit && (
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => setShowDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900">Service Item Info</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Status</label>
                <select className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" value={form.status} onChange={(e) => handleChange('status', e.target.value)}>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Equipment Name*</label>
                <Input className="mt-1" value={form.equipmentName} onChange={(e) => handleChange('equipmentName', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Model</label>
                <Input className="mt-1" value={form.model} onChange={(e) => handleChange('model', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Serial</label>
                <Input className="mt-1" value={form.serial} onChange={(e) => handleChange('serial', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Assigned Engineers</label>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {engineers.map((eng) => (
                  <label key={eng.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-400"
                      checked={form.assignedEngineerIds.includes(eng.id)}
                      onChange={() => toggleEngineer(eng.id)}
                    />
                    {eng.name}
                  </label>
                ))}
                {engineers.length === 0 && <p className="text-sm text-slate-600">No engineers found.</p>}
              </div>
              {form.status === 'IN_PROGRESS' && form.assignedEngineerIds.length === 0 && (
                <p className="text-xs text-red-600">At least one engineer required when In Progress.</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Service Content*</label>
              <textarea
                className="mt-1 h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.serviceContent}
                onChange={(e) => handleChange('serviceContent', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900">Attachments</h3>
            <p className="text-sm text-slate-600">Allowed: jpg/png/pdf/doc/docx/xlsx up to 10MB.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            {!isEdit && <p>Save the service item first to upload attachments.</p>}
            {isEdit && (
              <div className="space-y-2">
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                  className="text-sm"
                />
                <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                  {item?.attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="font-semibold text-slate-900">{att.filename}</p>
                        <p className="text-xs text-slate-600">{(att.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <a className="text-sm font-semibold text-blue-700" href={`/api/attachments/${att.id}/download`} target="_blank" rel="noreferrer">
                          Download
                        </a>
                        {canEdit && (
                          <Button variant="ghost" className="bg-white text-red-700" onClick={() => handleDeleteAttachment(att.id)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {item?.attachments.length === 0 && <p className="p-3 text-sm text-slate-600">No attachments yet.</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button onClick={save} disabled={loading}>
            Save
          </Button>
          <Button variant="ghost" className="bg-white" onClick={() => navigate(item ? `/app/module2/service-items/${item.id}` : `/app/module2/work-orders/${workOrderId}/service-items`)}>
            Cancel
          </Button>
        </div>
      </div>

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete Service Item</h3>
            <p className="text-sm text-slate-700">This is a soft delete.</p>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="ghost" className="bg-white" onClick={() => setShowDelete(false)}>
                Cancel
              </Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
