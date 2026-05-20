import { checkHealth } from './health.service.js';

export const getHealth = async (req, res, next) => {
  try {
    const result = await checkHealth();
    const status = result.db === 'ok' ? 200 : 503;
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
};
