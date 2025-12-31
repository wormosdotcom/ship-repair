import { WorkOrderStatus, ServiceItemStatus } from '../types';
import { cn } from '../lib/utils';

type Status = WorkOrderStatus | ServiceItemStatus;

const statusStyles: Record<Status, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border border-slate-200',
  PENDING_SERVICE: 'bg-amber-100 text-amber-800 border border-amber-200',
  IN_SERVICE: 'bg-blue-100 text-blue-800 border border-blue-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  PENDING_SETTLEMENT: 'bg-purple-100 text-purple-800 border border-purple-200',
  PENDING: 'bg-slate-100 text-slate-700 border border-slate-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border border-blue-200',
  CANCELED: 'bg-red-100 text-red-700 border border-red-200',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold uppercase', statusStyles[status])}>
      {status.replace('_', ' ')}
    </span>
  );
}
