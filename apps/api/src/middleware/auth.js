import { prisma } from '../db/prisma.js';
import { verifySessionToken } from '../lib/jwt.js';

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'Missing bearer token' } });
    }

    const token = header.slice('Bearer '.length).trim();

    let payload;
    try {
      payload = verifySessionToken(token);
    } catch {
      return res.status(401).json({ error: { message: 'Invalid or expired token' } });
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: { message: 'Session expired' } });
    }

    req.session = session;
    req.user = session.user;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }
  next();
};
