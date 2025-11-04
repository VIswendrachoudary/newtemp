import { Request, Response, NextFunction } from 'express'
import { logger } from '@/utils/logger'

export interface AppError extends Error {
  statusCode?: number
  code?: string
  details?: any
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
  })

  // Default error response
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal server error'
  let code = err.code || 'INTERNAL_ERROR'

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400
    code = 'VALIDATION_ERROR'
    message = 'Validation failed'
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401
    code = 'AUTH_005'
    message = 'Invalid token'
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401
    code = 'AUTH_004'
    message = 'Token expired'
  } else if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any
    switch (prismaError.code) {
      case 'P2002':
        statusCode = 409
        code = 'DUPLICATE_ENTRY'
        message = 'Resource already exists'
        break
      case 'P2025':
        statusCode = 404
        code = 'NOT_FOUND'
        message = 'Resource not found'
        break
      default:
        statusCode = 500
        code = 'DATABASE_ERROR'
        message = 'Database operation failed'
    }
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    code,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details,
    }),
  })
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method,
  })
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}