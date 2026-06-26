import { Router, type Response } from 'express';

import { sendApiError } from '../http/api-errors.js';
import {
  getCurrentSession,
  loginSession,
  logoutSession,
} from './session-service.js';
import type { LoginRequestBody, SessionErrorCode } from './session-types.js';

const sessionErrorStatus = (errorCode: SessionErrorCode) =>
  errorCode === 'INVALID_LOGIN_REQUEST'
    ? 400
    : errorCode === 'INVALID_CREDENTIALS' || errorCode === 'UNAUTHENTICATED'
      ? 401
      : errorCode === 'TENANT_MEMBERSHIP_REQUIRED'
        ? 403
        : 500;

const sendSessionError = (res: Response, errorCode: SessionErrorCode) => {
  sendApiError(res, sessionErrorStatus(errorCode), errorCode);
};

export const sessionRouter = Router();

sessionRouter.post('/login', async (req, res) => {
  const result = await loginSession(req, req.body as LoginRequestBody);

  if (!result.ok) {
    sendSessionError(res, result.errorCode);
    return;
  }

  for (const cookie of result.setCookieHeaders ?? []) {
    res.append('set-cookie', cookie);
  }

  res.json(result.data);
});

sessionRouter.get('/current', async (req, res) => {
  const result = await getCurrentSession(req);

  if (!result.ok) {
    sendSessionError(res, result.errorCode);
    return;
  }

  res.json(result.data);
});

sessionRouter.post('/logout', async (req, res) => {
  await logoutSession(req);
  res.status(204).end();
});
