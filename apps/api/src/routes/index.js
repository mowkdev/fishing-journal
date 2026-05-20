import { Router } from 'express';
import { healthRouter } from '../features/health/health.routes.js';

export const router = Router();

router.use('/health', healthRouter);
