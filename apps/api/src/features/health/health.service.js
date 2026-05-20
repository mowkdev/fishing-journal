import { prisma } from '../../db/prisma.js';

export const checkHealth = async () => {
  let db = 'ok';
  let dbError;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    db = 'error';
    dbError = err.message;
  }

  return {
    status: db === 'ok' ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db,
    ...(dbError ? { dbError } : {}),
  };
};
