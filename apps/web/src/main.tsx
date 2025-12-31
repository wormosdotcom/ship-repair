import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AppHome } from './pages/AppHome';
import { Module1Dashboard } from './pages/module1/Dashboard';
import { WorkOrderFormPage } from './pages/module1/WorkOrderFormPage';
import { WorkOrderDetailPage } from './pages/module1/WorkOrderDetailPage';
import { ServiceItemListPage } from './pages/module2/ServiceItemListPage';
import { ServiceItemDetailPage } from './pages/module2/ServiceItemDetailPage';
import { ServiceItemFormPage } from './pages/module2/ServiceItemFormPage';
import { CostPage } from './pages/module3/CostPage';
import { WorkOrderProfitPage } from './pages/module4/WorkOrderProfitPage';
import { ProfitReportDetailPage } from './pages/module4/ProfitReportDetailPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppHome />} />
            <Route path="/app/module1/dashboard" element={<Module1Dashboard />} />
            <Route path="/app/module1/work-orders/new" element={<WorkOrderFormPage />} />
            <Route path="/app/module1/work-orders/:id" element={<WorkOrderDetailPage />} />
            <Route path="/app/module1/work-orders/:id/edit" element={<WorkOrderFormPage />} />
            <Route path="/app/module2/work-orders/:workOrderId/service-items" element={<ServiceItemListPage />} />
            <Route path="/app/module2/work-orders/:workOrderId/service-items/new" element={<ServiceItemFormPage />} />
            <Route path="/app/module2/service-items/:serviceItemId" element={<ServiceItemDetailPage />} />
            <Route path="/app/module2/service-items/:serviceItemId/edit" element={<ServiceItemFormPage />} />
            <Route path="/app/module3/work-orders/:workOrderId/cost" element={<CostPage />} />
            <Route path="/app/module4/work-orders/:workOrderId/profit" element={<WorkOrderProfitPage />} />
            <Route path="/app/module4/profit-reports/:reportId" element={<ProfitReportDetailPage />} />
            <Route path="/" element={<Navigate to="/app" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
