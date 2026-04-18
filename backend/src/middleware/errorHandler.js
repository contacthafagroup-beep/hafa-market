const logger = require('../config/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const notFound = (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
};

const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message } = err;

  // Prisma errors
  if (err.code === 'P2002') { statusCode = 409; message = 'A record with this value already exists.'; }
  if (err.code === 'P2025') { statusCode = 404; message = 'Record not found.'; }
  if (err.code === 'P2003') { statusCode = 400; message = 'Invalid reference — related record not found.'; }

  // JWT errors
  if (err.name === 'JsonWebTokenError') { statusCode = 401; message = 'Invalid token.'; }
  if (err.name === 'TokenExpiredError') { statusCode = 401; message = 'Token expired.'; }

  if (statusCode === 500) logger.error(err);

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { AppError, notFound, errorHandler };
