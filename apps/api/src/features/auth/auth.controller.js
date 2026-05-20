import { z } from 'zod';
import { login, logout, getCurrentUser } from './auth.service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const postLogin = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: 'Invalid request body', issues: parsed.error.flatten() },
      });
    }

    const result = await login(parsed.data);
    if (!result) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const postLogout = async (req, res, next) => {
  try {
    await logout(req.session.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const getMe = (req, res) => {
  res.json({ user: getCurrentUser(req.user) });
};
