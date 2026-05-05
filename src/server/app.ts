import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '../auth/auth.js';
import { staffRouter } from '../staff/staff-routes.js';

export const app = express();

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

app.use('/api/staff', staffRouter);

app.get('/', (req, res) => {
  res.send('Test');
});
