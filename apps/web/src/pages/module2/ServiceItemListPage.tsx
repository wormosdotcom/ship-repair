import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../context/AuthContext';
import { fetchEngineers, fetchServiceItems } from '../../lib/api';
import { ServiceItem, ServiceItemStatus, User, WorkOrder } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';

const statusOptions: ServiceItemStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'];

export function ServiceItemListPage() {
  const { workOrderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [engineers, setEngineers] = useState<User[]>([]);
  const [status, setStatus] = useState('');
  const [engineerId, setEngineerId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEditWorkOrder = useMemo(() => {
    if (!user || !workOrder) return false;
    if (user.role === 'ADMIN') return true;
    if (user.role === 'OPS' && workOrder.createdById === user.id) return true;
    return false;
  }, [user, workOrder]);

  const canCreate = canEditWorkOrder;

  useEffect(() => {
    load();
    fetchEngineers().then((res) => {
      if (res.data?.engineers) setEngineers(res.data.engineers);
    });
  }, [status, engineerId, search, workOrderId]);

  async function load() {
    if (!workOrderId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await fetchServiceItems(workOrderId, { status, engineerId, search });
    if (error) setError(error);
    if (data?.items) setItems(data.items);
    if (data?.workOrder) setWorkOrder(data.workOrder);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Service Items</p>
            <h1 className="text-2xl font-bold text-slate-900">{workOrder?.internalNo || 'Work Order'}</h1>
            {workOrder && (
              <p className="text-sm text-slate-600">{workOrder.vesselName} • IMO {workOrder.imo}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="bg-white" onClick={() => navigate('/app/module1/dashboard')}>
              Back to Dashboard
            </Button>
            {canCreate && (
              <Button onClick={() => navigate(`/app/module2/work-orders/${workOrderId}/service-items/new`)}>+ New Service Item</Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-slate-900">Filters</h3>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Engineer</label>
              <select className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" value={engineerId} onChange={(e) => setEngineerId(e.target.value)}>
                <option value="">All</option>
                {engineers.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Equipment Search</label>
              <Input className="mt-1" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Equipment name" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-slate-900">Service Items</h3>
            {loading && <p className="text-sm text-slate-600">Loading…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Equipment</th>
                    <th className="px-3 py-2">Engineers</th>
                    <th className="px-3 py-2">Updated</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2"><StatusBadge status={item.status as any} /></td>
                      <td className="px-3 py-2 font-medium text-slate-900">{item.equipmentName}</td>
                      <td className="px-3 py-2 text-slate-700">{item.assignedEngineers.map((e) => e.name).join(', ') || 'Unassigned'}</td>
                      <td className="px-3 py-2 text-slate-600">{new Date(item.updatedAt).toLocaleString()}</td>
                      <td className="px-3 py-2 space-x-2">
                        <Button variant="ghost" className="bg-white" onClick={() => navigate(`/app/module2/service-items/${item.id}`)}>
                          View
                        </Button>
                        {canEditWorkOrder && (
                          <Button variant="ghost" className="bg-white" onClick={() => navigate(`/app/module2/service-items/${item.id}/edit`)}>
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && items.length === 0 && <p className="p-4 text-sm text-slate-600">No service items found.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
