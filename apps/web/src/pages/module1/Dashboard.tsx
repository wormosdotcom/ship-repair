import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWorkOrders, fetchWorkOrderStats, fetchWorkOrderAlerts, exportModuleReport } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { WorkOrder, WorkOrderStatus, WorkOrderStats, WorkOrderAlerts } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader } from '../../components/ui/card';

const statusOptions: WorkOrderStatus[] = ['DRAFT', 'PENDING_SERVICE', 'IN_SERVICE', 'COMPLETED', 'PENDING_SETTLEMENT'];

export function Module1Dashboard() {
  const { user, hasRole, logout } = useAuth();
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<WorkOrderStats | null>(null);
  const [alerts, setAlerts] = useState<WorkOrderAlerts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [operatingCompany, setOperatingCompany] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus[]>([]);

  const canCreate = hasRole('OPS', 'ADMIN');
  const canExport = hasRole('FINANCE', 'OPS', 'ADMIN');

  useEffect(() => {
    loadData();
  }, [search, operatingCompany, statusFilter]);

  async function loadData() {
    setLoading(true);
    setError(null);
    const statusParam = statusFilter.length ? statusFilter.join(',') : undefined;
    const { data, error } = await fetchWorkOrders({ search, operatingCompany, status: statusParam, pageSize: 50 });
    if (error) setError(error);
    if (data?.items) setWorkOrders(data.items);
    const statsRes = await fetchWorkOrderStats();
    if (statsRes.data) setStats(statsRes.data);
    const alertsRes = await fetchWorkOrderAlerts();
    if (alertsRes.data) setAlerts(alertsRes.data);
    setLoading(false);
  }

  const uniqueOperatingCompanies = useMemo(() => {
    const set = new Set(workOrders.map((w) => w.operatingCompany));
    return Array.from(set.values());
  }, [workOrders]);

  const toggleStatus = (value: WorkOrderStatus) => {
    setStatusFilter((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
  };

  const canEdit = (wo: WorkOrder) => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if (user.role === 'OPS' && wo.createdById === user.id) return true;
    return false;
  };

  const handleExport = async () => {
    const res = await exportModuleReport();
    if (res.error) {
      alert(res.error);
    } else {
      alert(res.data?.message ?? 'Export triggered');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Ship Repair ERP</p>
          <h1 className="text-xl font-bold text-slate-900">Ship Repair Work Orders Dashboard</h1>
          <p className="text-sm text-slate-600">Operations Control Center · Logged in as <span className="font-semibold">{user?.role}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="bg-white" onClick={logout}>Logout</Button>
          {canCreate && (
            <Button onClick={() => navigate('/app/module1/work-orders/new')}>
              Create Work Order
            </Button>
          )}
        </div>
      </header>

      <main className="bg-slate-100 p-4">
        <div className="mx-auto max-w-6xl space-y-4">
          {/* Overview cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SmallStat label="Vessels" value={stats?.totalVessels} />
            <SmallStat label="Work Orders" value={stats?.totalWorkOrders} />
            <SmallStat label="Service Orders" value={stats?.inService} />
            <SmallStat label="Completed" value={stats?.completed} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Left column - statuses */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 text-sm font-semibold text-slate-900">Work Order Status</div>
              <div className="space-y-2 text-sm text-slate-800">
                <Stat label="Total" value={stats?.totalWorkOrders} />
                <Stat label="Pending Dispatch" value={stats?.pendingDispatch} />
                <Stat label="In Progress" value={stats?.inProgress} />
                <Stat label="Pending Settlement" value={stats?.pendingSettlement} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-800">
                <div className="flex items-center gap-2 font-semibold"><span role="img" aria-label="engineer">🧑‍🔧</span><span>Engineer Workload</span></div>
                <div className="space-y-1">
                  {stats?.engineerLoad?.length ? (
                    stats.engineerLoad.map((e) => (
                      <div key={e.name} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                        <span>{e.name}</span>
                        <span className="font-semibold">{e.count}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500">No data</p>
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-800">
                <div className="flex items-center gap-2 font-semibold"><span role="img" aria-label="region">🌏</span><span>Region Distribution</span></div>
                <div className="space-y-1">
                  {stats?.regionDistribution?.length ? (
                    stats.regionDistribution.map((r) => (
                      <div key={r.city} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                        <span>{r.city}</span>
                        <span className="font-semibold">{r.count}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500">No data</p>
                  )}
                </div>
              </div>
            </div>

            {/* Center column - work orders */}
            <div className="lg:col-span-1 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:col-span-1 xl:col-span-1">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Module 1 · Operations Control Center</p>
                  <h3 className="text-base font-semibold text-slate-900">Work Orders</h3>
                </div>
                {canExport && (
                  <Button variant="ghost" className="bg-white" onClick={handleExport}>Export Report</Button>
                )}
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-slate-700">Search</label>
                    <Input
                      className="mt-1"
                      placeholder="Search work orders, vessel, IMO, customer, shipyard"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Operating Company</label>
                    <select
                      className="mt-1 h-10 w-52 rounded-md border border-slate-300 bg-white px-3 text-sm"
                      value={operatingCompany}
                      onChange={(e) => setOperatingCompany(e.target.value)}
                    >
                      <option value="">All</option>
                      {uniqueOperatingCompanies.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {uniqueOperatingCompanies.length === 0 && (
                        <>
                          <option value="Wormos">Wormos</option>
                          <option value="iShip">iShip</option>
                          <option value="Other">Other</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {statusOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleStatus(s)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        statusFilter.includes(s)
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                {loading && <p className="mt-2 text-sm text-slate-600">Loading…</p>}
              </div>

              <div className="mt-4 space-y-3">
                {workOrders.map((wo) => (
                  <div key={wo.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-semibold text-slate-900">{wo.internalNo || 'Draft'}</p>
                          <StatusBadge status={wo.status} />
                        </div>
                        <p className="text-xs text-slate-600">PO: {wo.po || '—'}</p>
                        <p className="text-xs text-slate-600">Customer: {wo.customerCompany}</p>
                        <p className="text-xs text-slate-600">Shipyard: {wo.locationName}, {wo.city}</p>
                      </div>
                      <div className="text-right text-xs text-slate-600">
                        <p>Planned: {wo.startDate.slice(0, 10)} → {wo.endDate.slice(0, 10)}</p>
                        <p>Engineers: {wo.responsibleEngineerName || 'Unassigned'}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-slate-700">
                      <div className="w-full max-w-sm">
                        <p className="font-semibold text-slate-900">Task Completion</p>
                        <div className="mt-1 h-2 rounded-full bg-slate-200">
                          <div className="h-2 w-0 rounded-full bg-slate-900" style={{ width: '0%' }}></div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <Button
                          variant="ghost"
                          className="bg-white"
                          onClick={() => navigate(`/app/module2/work-orders/${wo.id}/service-items`)}
                        >
                          Tasks
                        </Button>
                        <Button
                          variant="ghost"
                          className="bg-white"
                          disabled={user?.role === 'ENGINEER'}
                          onClick={() => navigate(`/app/module3/work-orders/${wo.id}/cost`)}
                        >
                          Costs
                        </Button>
                        {wo.status === 'COMPLETED' && (
                          <Button
                            variant="ghost"
                            className="bg-white"
                            disabled={user?.role === 'ENGINEER'}
                            onClick={() => navigate(`/app/module4/work-orders/${wo.id}/profit`)}
                          >
                            View Profit Report
                          </Button>
                        )}
                        {canEdit(wo) && (
                          <Button variant="ghost" className="bg-white" onClick={() => navigate(`/app/module1/work-orders/${wo.id}/edit`)}>
                            Edit
                          </Button>
                        )}
                        <Button variant="ghost" className="bg-white" onClick={() => navigate(`/app/module1/work-orders/${wo.id}`)}>
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {!loading && workOrders.length === 0 && <p className="text-sm text-slate-600">No work orders</p>}
              </div>
            </div>

            {/* Right column - alerts/quick actions */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 text-sm font-semibold text-slate-900">Alerts & Follow-ups</div>
              <div className="space-y-3 text-sm text-slate-800">
                <AlertBlock title="Critical" items={alerts?.overdue?.map((a) => `${a.internalNo || 'Draft'} is overdue`)} />
                <AlertBlock title="Reminders" items={alerts?.startingSoon?.map((a) => `${a.internalNo || 'Draft'} starts soon`)} />
                <AlertBlock title="Engineer Load >80%" items={alerts?.engineerLoad?.map((e) => `${e.name} (${e.count})`)} />
                <AlertBlock
                  title="Service Status Mismatch"
                  items={alerts?.serviceStatusMismatches?.map((m) => `${m.internalNo || 'Draft'} – ${m.message}`)}
                />
              </div>
              <div className="mt-4 border-t border-slate-200 pt-3">
                <p className="text-sm font-semibold text-slate-900">Quick Actions</p>
                <div className="mt-2 flex flex-col gap-2">
                  <Button onClick={() => navigate('/app/module1/work-orders/new')} disabled={!canCreate}>
                    + Create Work Order
                  </Button>
                  <Button variant="ghost" className="bg-white" disabled>
                    Bulk Import (coming soon)
                  </Button>
                  <Button variant="ghost" className="bg-white" onClick={handleExport} disabled={!canExport}>
                    Export Report
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
      <span>{label}</span>
      <span className="font-semibold">{value ?? 0}</span>
    </div>
  );
}

function AlertBlock({ title, items }: { title: string; items?: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {items && items.length ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
          {items.map((item, idx) => (
            <li key={`${item}-${idx}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No alerts</p>
      )}
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value ?? 0}</p>
    </div>
  );
}
