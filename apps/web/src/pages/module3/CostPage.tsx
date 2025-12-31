import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../context/AuthContext';
import { CostAttachment, CostCategory, CostLine, WorkOrder } from '../../types';
import {
  createCostLine,
  deleteCostAttachment,
  deleteCostLine,
  fetchCostLines,
  lockCostLines,
  updateCostLine,
  uploadCostAttachment,
} from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';

const categories: CostCategory[] = ['PARTS', 'LABOR', 'OUTSOURCE', 'OTHER'];

interface EditorState {
  id?: string;
  itemName: string;
  category: CostCategory;
  unitPrice: string;
  quantity: string;
  notes: string;
}

export function CostPage() {
  const { workOrderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [lines, setLines] = useState<CostLine[]>([]);
  const [attachments, setAttachments] = useState<CostAttachment[]>([]);
  const [categoryTotals, setCategoryTotals] = useState<Record<string, number>>({});
  const [totalCost, setTotalCost] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const locked = lines.some((l) => l.isLocked);

  const canEdit = useMemo(() => {
    if (!user || !workOrder) return false;
    if (user.role === 'ADMIN' || user.role === 'FINANCE') return true;
    if (user.role === 'OPS' && workOrder.createdById === user.id) return true;
    return false;
  }, [user, workOrder]);

  const canLock = user?.role === 'ADMIN' || user?.role === 'FINANCE';

  useEffect(() => {
    if (user?.role === 'ENGINEER') return;
    load();
  }, [filterCategory, search, workOrderId]);

  async function load() {
    if (!workOrderId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await fetchCostLines(workOrderId, { category: filterCategory, search });
    if (error) setError(error);
    if (data) {
      setLines(data.items);
      setWorkOrder(data.workOrder);
      setTotalCost(data.totalCost || 0);
      setCategoryTotals(data.categoryTotals || {});
      setAttachments(data.attachments || []);
    }
    setLoading(false);
  }

  const selectedSubtotal = useMemo(() => {
    return lines.reduce((sum, l) => (selected.has(l.id) ? sum + Number(l.lineTotal) : sum), 0);
  }, [selected, lines]);

  const startEdit = (line?: CostLine) => {
    if (!canEdit) return;
    if (line && line.isLocked) return;
    setEditor(
      line
        ? {
            id: line.id,
            itemName: line.itemName,
            category: line.category,
            unitPrice: String(line.unitPrice),
            quantity: String(line.quantity),
            notes: line.notes || '',
          }
        : { id: undefined, itemName: '', category: 'PARTS', unitPrice: '0', quantity: '1', notes: '' }
    );
  };

  const cancelEdit = () => setEditor(null);

  const save = async () => {
    if (!workOrderId || !editor) return;
    if (!editor.itemName) return setError('Item name is required');
    if (!(Number(editor.unitPrice) > 0) || !(Number(editor.quantity) > 0)) return setError('Unit price and quantity must be positive');
    setError(null);
    setLoading(true);
    if (editor.id) {
      const res = await updateCostLine(editor.id, {
        itemName: editor.itemName,
        category: editor.category,
        unitPrice: Number(editor.unitPrice),
        quantity: Number(editor.quantity),
        notes: editor.notes,
      });
      if (res.error) setError(res.error);
    } else {
      const res = await createCostLine(workOrderId, {
        itemName: editor.itemName,
        category: editor.category,
        unitPrice: Number(editor.unitPrice),
        quantity: Number(editor.quantity),
        notes: editor.notes,
      });
      if (res.error) setError(res.error);
    }
    setEditor(null);
    setLoading(false);
    await load();
  };

  const removeLine = async (id: string, isLocked: boolean) => {
    if (!canEdit || isLocked) return;
    const res = await deleteCostLine(id);
    if (res.error) setError(res.error);
    await load();
  };

  const handleLock = async () => {
    if (!workOrderId) return;
    const res = await lockCostLines(workOrderId);
    if (res.error) setError(res.error);
    await load();
  };

  const handleAttachmentUpload = async (file: File) => {
    if (!workOrderId) return;
    const res = await uploadCostAttachment(workOrderId, file);
    if (res.error) alert(res.error);
    await load();
  };

  const handleAttachmentDelete = async (id: string, isLockedLine: boolean) => {
    if (isLockedLine) return;
    const res = await deleteCostAttachment(id);
    if (res.error) alert(res.error);
    await load();
  };

  if (user?.role === 'ENGINEER') {
    return <div className="p-6 text-red-600">Engineers cannot access Module 3.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Cost Collection</p>
            <h1 className="text-2xl font-bold text-slate-900">{workOrder?.internalNo || 'Work Order'}</h1>
            {workOrder && <p className="text-sm text-slate-600">{workOrder.vesselName} • IMO {workOrder.imo}</p>}
            {locked && <div className="mt-2"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Locked</span></div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="bg-white" onClick={() => navigate('/app/module1/dashboard')}>
              Back
            </Button>
            {canLock && (
              <Button onClick={handleLock} disabled={locked}>
                Lock Costs
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  {canEdit && (
                    <Button onClick={() => startEdit()} disabled={locked}>
                      + Add Cost Line
                    </Button>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700">Category</label>
                    <select
                      className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                    >
                      <option value="">All</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <Input placeholder="Search item name" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  {locked && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Locked</span>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {error && <p className="text-sm text-red-600">{error}</p>}
                {loading && <p className="text-sm text-slate-600">Loading…</p>}

                <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                      <tr>
                        <th className="px-3 py-2"><input type="checkbox" checked={selected.size === lines.length && lines.length > 0} onChange={(e) => {
                          if (e.target.checked) setSelected(new Set(lines.map((l) => l.id)));
                          else setSelected(new Set());
                        }} /></th>
                        <th className="px-3 py-2 text-left">Cost Item</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2 text-right">Unit Price</th>
                        <th className="px-3 py-2 text-right">Quantity</th>
                        <th className="px-3 py-2 text-right">Line Total</th>
                        <th className="px-3 py-2">Notes</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {lines.map((line) => (
                        <tr key={line.id} className="bg-white">
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selected.has(line.id)}
                              onChange={(e) => {
                                const next = new Set(selected);
                                if (e.target.checked) next.add(line.id);
                                else next.delete(line.id);
                                setSelected(next);
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{line.itemName}</td>
                          <td className="px-3 py-2 text-center">{line.category}</td>
                          <td className="px-3 py-2 text-right">{Number(line.unitPrice).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{Number(line.quantity).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900">{Number(line.lineTotal).toFixed(2)}</td>
                          <td className="px-3 py-2 text-slate-700">{line.notes || '—'}</td>
                          <td className="px-3 py-2 space-x-2">
                            {canEdit && (
                              <Button variant="ghost" className="bg-white" onClick={() => startEdit(line)} disabled={line.isLocked}>
                                Edit
                              </Button>
                            )}
                            {canEdit && (
                              <Button variant="ghost" className="bg-white text-red-700" onClick={() => removeLine(line.id, line.isLocked)} disabled={line.isLocked}>
                                Delete
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!loading && lines.length === 0 && <p className="p-4 text-sm text-slate-600">No cost lines.</p>}
                </div>

                <div className="flex flex-wrap items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
                  <span>Selected Subtotal: {selectedSubtotal.toFixed(2)}</span>
                  <span>Total Cost: {totalCost.toFixed(2)}</span>
                </div>

                {editor && (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="text-base font-semibold text-slate-900">{editor.id ? 'Edit Cost Line' : 'Add Cost Line'}</h4>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-slate-700">Item Name*</label>
                        <Input className="mt-1" value={editor.itemName} onChange={(e) => setEditor({ ...editor, itemName: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Category*</label>
                        <select
                          className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                          value={editor.category}
                          onChange={(e) => setEditor({ ...editor, category: e.target.value as CostCategory })}
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Unit Price*</label>
                        <Input
                          className="mt-1"
                          type="number"
                          step="0.01"
                          value={editor.unitPrice}
                          onChange={(e) => setEditor({ ...editor, unitPrice: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Quantity*</label>
                        <Input
                          className="mt-1"
                          type="number"
                          step="0.01"
                          value={editor.quantity}
                          onChange={(e) => setEditor({ ...editor, quantity: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-slate-700">Notes</label>
                        <Input className="mt-1" value={editor.notes} onChange={(e) => setEditor({ ...editor, notes: e.target.value })} />
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button onClick={save} disabled={loading}>
                        Save
                      </Button>
                      <Button variant="ghost" className="bg-white" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <Card>
                  <CardHeader>
                    <h4 className="text-base font-semibold text-slate-900">Attachments</h4>
                    <p className="text-sm text-slate-600">Receipts/Invoices (jpg/png/pdf/doc/docx/xlsx up to 10MB)</p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-700">
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAttachmentUpload(file);
                      }}
                      disabled={!canEdit}
                    />
                    <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                      {attachments.map((att) => {
                        const isLockedLine = att.costLineId ? lines.find((l) => l.id === att.costLineId)?.isLocked : false;
                        return (
                          <div key={att.id} className="flex items-center justify-between px-3 py-2">
                            <div>
                              <p className="font-semibold text-slate-900">{att.filename}</p>
                              <p className="text-xs text-slate-600">{(att.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <a className="text-sm font-semibold text-blue-700" href={`/api/cost-attachments/${att.id}/download`} target="_blank" rel="noreferrer">
                                Download
                              </a>
                              {canEdit && (
                                <Button variant="ghost" className="bg-white text-red-700" onClick={() => handleAttachmentDelete(att.id, !!isLockedLine)} disabled={!!isLockedLine}>
                                  Delete
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {attachments.length === 0 && <p className="p-3 text-sm text-slate-600">No attachments.</p>}
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-slate-900">Cost Analysis</h3>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <SummaryRow label="Total Cost" value={totalCost} bold />
                {categories.map((c) => (
                  <SummaryRow key={c} label={c} value={categoryTotals[c] || 0} />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-slate-900">Breakdown</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categories.map((c) => {
                    const val = categoryTotals[c] || 0;
                    const pct = totalCost ? Math.round((val / totalCost) * 100) : 0;
                    return (
                      <div key={c}>
                        <div className="flex justify-between text-sm text-slate-700">
                          <span>{c}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200">
                          <div className="h-2 rounded-full bg-slate-700" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {locked && <p className="mt-3 text-sm font-semibold text-amber-700">Locked: cost lines are read-only.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
      <span className={bold ? 'font-semibold text-slate-900' : 'text-slate-700'}>{label}</span>
      <span className={bold ? 'font-semibold text-slate-900' : 'text-slate-700'}>{value.toFixed(2)}</span>
    </div>
  );
}
