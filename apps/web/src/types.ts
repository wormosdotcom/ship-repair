export type Role = 'ENGINEER' | 'FINANCE' | 'OPS' | 'ADMIN';

export type WorkOrderStatus = 'DRAFT' | 'PENDING_SERVICE' | 'IN_SERVICE' | 'COMPLETED' | 'PENDING_SETTLEMENT';
export type ServiceItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
export type CostCategory = 'PARTS' | 'LABOR' | 'OUTSOURCE' | 'OTHER';
export type Currency = 'CNY' | 'USD' | 'OTHER';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE';
export type PaymentMethod = 'BANK' | 'CASH' | 'OTHER';
export type ProfitReportStatus = 'DRAFT' | 'CONFIRMED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface WorkOrder {
  id: string;
  internalNo: string | null;
  status: WorkOrderStatus;
  operatingCompany: string;
  orderType: string;
  paymentTerms: string;
  customerCompany: string;
  vesselName: string;
  imo: string;
  vesselType?: string | null;
  yearBuilt?: number | null;
  grossTonnage?: number | null;
  vesselNotes?: string | null;
  po?: string | null;
  locationType: string;
  locationName: string;
  city: string;
  startDate: string;
  endDate: string;
  responsibleEngineerName?: string | null;
  responsibleOpsName?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  deleteReason?: string | null;
  createdBy?: Pick<User, 'id' | 'name' | 'email' | 'role'>;
}

export interface WorkOrderStats {
  totalVessels: number;
  totalWorkOrders: number;
  pendingService: number;
  inService: number;
  completed: number;
  pendingDispatch: number;
  inProgress: number;
  pendingSettlement: number;
  engineerLoad: { name: string; count: number }[];
  regionDistribution: { city: string; count: number }[];
}

export interface WorkOrderAlerts {
  overdue: Array<{ id: string; internalNo: string | null; vesselName: string; endDate: string }>;
  startingSoon: Array<{ id: string; internalNo: string | null; vesselName: string; startDate: string }>;
  engineerLoad: Array<{ name: string; count: number }>;
  serviceStatusMismatches?: Array<{ workOrderId: string; internalNo: string | null; message: string }>;
}

export interface ServiceAttachment {
  id: string;
  filename: string;
  path: string;
  mimeType: string;
  size: number;
  uploaderId: string;
  createdAt: string;
}

export interface ServiceItem {
  id: string;
  workOrderId: string;
  status: ServiceItemStatus;
  equipmentName: string;
  model?: string | null;
  serial?: string | null;
  serviceContent: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  workOrder?: WorkOrder;
  assignedEngineers: User[];
  attachments: ServiceAttachment[];
}

export interface CostLine {
  id: string;
  workOrderId: string;
  itemName: string;
  category: CostCategory;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  notes?: string | null;
  isLocked: boolean;
  lockedAt?: string | null;
  lockedById?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CostAttachment {
  id: string;
  costLineId?: string | null;
  workOrderId: string;
  filename: string;
  path: string;
  mimeType: string;
  size: number;
  uploaderId: string;
  createdAt: string;
}

export interface Quote {
  id: string;
  workOrderId: string;
  amount: number;
  currency: Currency;
  validityDate?: string | null;
  notes?: string | null;
  isFinal: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  workOrderId: string;
  invoiceNo: string;
  amount: number;
  currency: Currency;
  issueDate: string;
  dueDate?: string | null;
  status: InvoiceStatus;
  notes?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentReceipt {
  id: string;
  workOrderId: string;
  invoiceId?: string | null;
  receiptNo: string;
  amount: number;
  currency: Currency;
  date: string;
  method: PaymentMethod;
  reference?: string | null;
  createdById: string;
  createdAt: string;
}

export interface ProfitReport {
  id: string;
  workOrderId: string;
  status: ProfitReportStatus;
  revenueTotal: number;
  costTotal: number;
  profit: number;
  marginPercent: number;
  incomeBreakdown: any;
  costBreakdown: any;
  lockedCostSnapshot: any;
  lockedInvoiceSnapshot: any;
  profitabilityRating: string;
  paymentRating: string;
  overallRating: string;
  createdById: string;
  confirmedById?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
