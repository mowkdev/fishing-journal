import { Router } from 'express';
import { healthRouter } from '../features/health/health.routes.js';
import { authRouter } from '../features/auth/auth.routes.js';

export const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
