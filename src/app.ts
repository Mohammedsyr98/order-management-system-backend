import express from 'express';
import { toNodeHandler } from 'better-auth/node';

import { auth } from './auth.js';

export const app = express();

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Test');
});
