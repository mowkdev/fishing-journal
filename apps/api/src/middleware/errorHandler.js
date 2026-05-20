export const errorHandler = (err, req, res, _next) => {
  const status = err.status ?? err.statusCode ?? 500;
  const isDev = process.env.NODE_ENV === 'development';

  res.status(status).json({
    error: {
      message: err.message ?? 'Internal Server Error',
      ...(isDev && err.stack ? { stack: err.stack } : {}),
    },
  });
};
