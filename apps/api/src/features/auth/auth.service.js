import { prisma } from '../../db/prisma.js';
import { verifyPassword } from '../../lib/password.js';
import { signSessionToken } from '../../lib/jwt.js';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
});

export const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  const token = signSessionToken({ sessionId: session.id, userId: user.id });

  return { token, user: toPublicUser(user) };
};

export const logout = async (sessionId) => {
  await prisma.session.deleteMany({ where: { id: sessionId } });
};

export const getCurrentUser = (user) => toPublicUser(user);
