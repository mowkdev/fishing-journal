import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

const { prisma } = await import('../../db/prisma.js');
const { createApp } = await import('../../app.js');

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with db ok when the database is reachable', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ result: 1 }]);

    const res = await request(createApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it('returns 503 with db error when the database query fails', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(createApp()).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.db).toBe('error');
    expect(res.body.dbError).toBe('connection refused');
  });
});
