import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface Props {
  isOpen: boolean;
  requireReason: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
}

export function DeleteModal({ isOpen, requireReason, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) {
      setError('Reason is required for generated records');
      return;
    }
    setLoading(true);
    setError(null);
    await onConfirm(reason.trim() || undefined);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-lg font-semibold text-slate-900">Delete Work Order</h3>
          <p className="text-sm text-slate-600">This action is a soft delete. Generated records require a reason and send a notification.</p>
        </div>
        <div className="space-y-3 px-4 py-4">
          {requireReason && (
            <div>
              <label className="text-sm font-medium text-slate-800">Delete reason (required)</label>
              <Input className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Enter reason" />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" className="bg-red-600 hover:bg-red-700" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Deleting…' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
