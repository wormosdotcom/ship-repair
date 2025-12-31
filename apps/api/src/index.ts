import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { FRONTEND_ORIGIN, PORT } from './config';
import authRoutes from './routes/auth';
import workOrderRoutes from './routes/workOrders';
import module3Routes from './routes/module3';
import module4Routes from './routes/module4';
import serviceItemRoutes from './routes/serviceItems';
import userRoutes from './routes/users';
import profitRoutes from './routes/profit';

const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api', module3Routes);
app.use('/api/module4', module4Routes);
app.use('/api', serviceItemRoutes);
app.use('/api/users', userRoutes);
app.use('/api', profitRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
