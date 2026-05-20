import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signSessionToken = ({ sessionId, userId }) =>
  jwt.sign({ sid: sessionId, uid: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

export const verifySessionToken = (token) => jwt.verify(token, env.JWT_SECRET);
