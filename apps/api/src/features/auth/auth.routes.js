import { Router } from 'express';
import { postLogin, postLogout, getMe } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', postLogin);
authRouter.post('/logout', requireAuth, postLogout);
authRouter.get('/me', requireAuth, getMe);
