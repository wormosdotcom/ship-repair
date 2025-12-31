import { Navigate } from 'react-router-dom';

export function AppHome() {
  return <Navigate to="/app/module1/dashboard" replace />;
}
