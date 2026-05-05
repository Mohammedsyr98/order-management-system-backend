import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '../auth/auth.js';
import { sessionRouter } from '../session/session-routes.js';
import { staffRouter } from '../staff/staff-routes.js';

export const app = express();

app.post('/api/auth/sign-up/email', (_req, res) => {
  res.status(404).end();
});

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

app.use('/api/session', sessionRouter);
app.use('/api/staff', staffRouter);

app.get('/', (req, res) => {
  res.send('Test');
});
