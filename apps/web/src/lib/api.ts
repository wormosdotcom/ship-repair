import {
  User,
  WorkOrder,
  WorkOrderAlerts,
  WorkOrderStats,
  ServiceItem,
  ServiceAttachment,
  CostLine,
  CostAttachment,
  Quote,
  Invoice,
  PaymentReceipt,
  ProfitReport,
} from '../types';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include',
    });

    const json = await res.json();
    if (!res.ok) {
      return { error: json.error || 'Request failed' };
    }
    return { data: json as T };
  } catch (err) {
    console.error(err);
    return { error: 'Network error' };
  }
}

export function login(email: string, password: string) {
  return request<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return request<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
}

export function me() {
  return request<{ user: User }>('/api/auth/me');
}

export interface WorkOrderListResponse {
  items: WorkOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export function fetchWorkOrders(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.append(key, String(value));
  });
  return request<WorkOrderListResponse>(`/api/work-orders?${query.toString()}`);
}

export function fetchWorkOrder(id: string) {
  return request<{ workOrder: WorkOrder }>(`/api/work-orders/${id}`);
}

export function fetchWorkOrderStats() {
  return request<WorkOrderStats>('/api/work-orders/stats');
}

export function fetchWorkOrderAlerts() {
  return request<WorkOrderAlerts>('/api/work-orders/alerts');
}

export function createWorkOrder(payload: Partial<WorkOrder>) {
  return request<{ workOrder: WorkOrder }>('/api/work-orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateWorkOrder(id: string, payload: Partial<WorkOrder>) {
  return request<{ workOrder: WorkOrder }>(`/api/work-orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function generateWorkOrder(id: string) {
  return request<{ workOrder: WorkOrder }>(`/api/work-orders/${id}/generate`, { method: 'POST' });
}

export function deleteWorkOrder(id: string, reason?: string) {
  return request<{ success: boolean }>(`/api/work-orders/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });
}

export function exportWorkOrder(id: string) {
  return request<{ message: string }>(`/api/work-orders/${id}/export`, { method: 'POST' });
}

export function printWorkOrder(id: string) {
  return request<{ message: string }>(`/api/work-orders/${id}/print`, { method: 'POST' });
}

export function exportModuleReport() {
  return request<{ message: string }>('/api/work-orders/export', { method: 'POST' });
}

export function fetchEngineers() {
  return request<{ engineers: User[] }>('/api/users/engineers');
}

export function fetchServiceItems(workOrderId: string, params: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) query.append(k, v);
  });
  return request<{ items: ServiceItem[]; workOrder: WorkOrder }>(`/api/work-orders/${workOrderId}/service-items?${query.toString()}`);
}

export function fetchServiceItem(id: string) {
  return request<{ serviceItem: ServiceItem }>(`/api/service-items/${id}`);
}

export function createServiceItem(workOrderId: string, payload: Partial<ServiceItem> & { assignedEngineerIds?: string[] }) {
  return request<{ serviceItem: ServiceItem }>(`/api/work-orders/${workOrderId}/service-items`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateServiceItem(id: string, payload: Partial<ServiceItem> & { assignedEngineerIds?: string[] }) {
  return request<{ serviceItem: ServiceItem }>(`/api/service-items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteServiceItem(id: string) {
  return request<{ success: boolean }>(`/api/service-items/${id}`, { method: 'DELETE' });
}

export async function uploadServiceAttachment(id: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`/api/service-items/${id}/attachments`, { method: 'POST', body: formData, credentials: 'include' });
    const json = await res.json();
    if (!res.ok) return { error: json.error || 'Upload failed' };
    return { data: json as { attachment: ServiceAttachment } };
  } catch (err) {
    console.error(err);
    return { error: 'Network error' };
  }
}

export function deleteAttachment(id: string) {
  return request<{ success: boolean }>(`/api/attachments/${id}`, { method: 'DELETE' });
}

export function fetchCostLines(workOrderId: string, params: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) query.append(k, v);
  });
  return request<{ items: CostLine[]; totalCost: number; categoryTotals: Record<string, number>; attachments: CostAttachment[]; workOrder: WorkOrder }>(
    `/api/work-orders/${workOrderId}/cost-lines?${query.toString()}`
  );
}

export function fetchCostLine(id: string) {
  return request<{ costLine: CostLine }>(`/api/cost-lines/${id}`);
}

export function createCostLine(workOrderId: string, payload: Partial<CostLine>) {
  return request<{ costLine: CostLine; totalCost: number; categoryTotals: Record<string, number> }>(`/api/work-orders/${workOrderId}/cost-lines`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCostLine(id: string, payload: Partial<CostLine>) {
  return request<{ costLine: CostLine; totalCost: number; categoryTotals: Record<string, number> }>(`/api/cost-lines/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteCostLine(id: string) {
  return request<{ success: boolean; totalCost: number; categoryTotals: Record<string, number> }>(`/api/cost-lines/${id}`, { method: 'DELETE' });
}

export function lockCostLines(workOrderId: string) {
  return request<{ success: boolean }>(`/api/work-orders/${workOrderId}/cost-lines/lock`, { method: 'POST' });
}

export async function uploadCostAttachment(workOrderId: string, file: File, costLineId?: string) {
  const formData = new FormData();
  formData.append('file', file);
  if (costLineId) formData.append('costLineId', costLineId);
  try {
    const res = await fetch(`/api/work-orders/${workOrderId}/cost-attachments/upload`, { method: 'POST', body: formData, credentials: 'include' });
    const json = await res.json();
    if (!res.ok) return { error: json.error || 'Upload failed' };
    return { data: json as { attachment: CostAttachment } };
  } catch (err) {
    console.error(err);
    return { error: 'Network error' };
  }
}

export function deleteCostAttachment(id: string) {
  return request<{ success: boolean }>(`/api/cost-attachments/${id}`, { method: 'DELETE' });
}

// Module 4
export function fetchQuotes(workOrderId: string) {
  return request<{ quotes: Quote[] }>(`/api/work-orders/${workOrderId}/quotes`);
}

export function createQuote(workOrderId: string, payload: Partial<Quote>) {
  return request<{ quote: Quote }>(`/api/work-orders/${workOrderId}/quotes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateQuote(id: string, payload: Partial<Quote>) {
  return request<{ quote: Quote }>(`/api/quotes/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteQuote(id: string) {
  return request<{ success: boolean }>(`/api/quotes/${id}`, { method: 'DELETE' });
}

export function fetchInvoices(workOrderId: string) {
  return request<{ invoices: Invoice[] }>(`/api/work-orders/${workOrderId}/invoices`);
}

export function createInvoice(workOrderId: string, payload: Partial<Invoice>) {
  return request<{ invoice: Invoice }>(`/api/work-orders/${workOrderId}/invoices`, { method: 'POST', body: JSON.stringify(payload) });
}

export function updateInvoice(id: string, payload: Partial<Invoice>) {
  return request<{ invoice: Invoice }>(`/api/invoices/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteInvoice(id: string) {
  return request<{ success: boolean }>(`/api/invoices/${id}`, { method: 'DELETE' });
}

export function fetchPayments(workOrderId: string) {
  return request<{ payments: PaymentReceipt[] }>(`/api/work-orders/${workOrderId}/payments`);
}

export function createPayment(workOrderId: string, payload: Partial<PaymentReceipt>) {
  return request<{ payment: PaymentReceipt }>(`/api/work-orders/${workOrderId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updatePayment(id: string, payload: Partial<PaymentReceipt>) {
  return request<{ payment: PaymentReceipt }>(`/api/payments/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deletePayment(id: string) {
  return request<{ success: boolean }>(`/api/payments/${id}`, { method: 'DELETE' });
}

export function fetchProfitReports(workOrderId: string) {
  return request<{ reports: ProfitReport[] }>(`/api/work-orders/${workOrderId}/profit-reports`);
}

export function fetchProfitReport(id: string) {
  return request<{ report: ProfitReport }>(`/api/profit-reports/${id}`);
}

export function generateProfitReport(workOrderId: string) {
  return request<{ report: ProfitReport }>(`/api/work-orders/${workOrderId}/profit-reports/generate`, { method: 'POST' });
}

export function confirmProfitReport(id: string) {
  return request<{ report: ProfitReport }>(`/api/profit-reports/${id}/confirm`, { method: 'POST' });
}

export function exportProfitReport(id: string, format: 'pdf' | 'xlsx') {
  return request<{ message: string }>(`/api/profit-reports/${id}/export?format=${format}`);
}

export function printProfitReport(id: string) {
  return request<{ message: string }>(`/api/profit-reports/${id}/print`);
}
