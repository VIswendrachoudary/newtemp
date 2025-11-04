import winston from 'winston'
import { config } from '@/config'

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`

    if (stack) {
      log += `\n${stack}`
    }

    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`
    }

    return log
  })
)

// Create logger instance
export const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: logFormat,
  defaultMeta: {
    service: 'edna-backend',
    environment: config.env,
  },
  transports: [
    // Console transport for all environments
    new winston.transports.Console({
      format: config.env === 'development'
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : logFormat,
    }),

    // File transports for production
    ...(config.env === 'production' ? [
      // Combined log file
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),

      // Error log file
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    ] : []),
  ],

  // Handle uncaught exceptions
  exceptionHandlers: [
    ...(config.env === 'production' ? [
      new winston.transports.File({ filename: 'logs/exceptions.log' })
    ] : [
      new winston.transports.Console()
    ]),
  ],

  // Handle unhandled rejections
  rejectionHandlers: [
    ...(config.env === 'production' ? [
      new winston.transports.File({ filename: 'logs/rejections.log' })
    ] : [
      new winston.transports.Console()
    ]),
  ],
})

// Create a stream object for Morgan
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim())
  },
}

// Helper functions for structured logging
export const logAuth = (action: string, userId?: string, details?: any) => {
  logger.info('Auth event', {
    event: 'auth',
    action,
    userId,
    ...details,
  })
}

export const logFile = (action: string, fileId?: string, details?: any) => {
  logger.info('File operation', {
    event: 'file',
    action,
    fileId,
    ...details,
  })
}

export const logAnalysis = (action: string, analysisId?: string, details?: any) => {
  logger.info('Analysis operation', {
    event: 'analysis',
    action,
    analysisId,
    ...details,
  })
}

export const logProject = (action: string, projectId?: string, details?: any) => {
  logger.info('Project operation', {
    event: 'project',
    action,
    projectId,
    ...details,
  })
}

export const logSystem = (action: string, details?: any) => {
  logger.info('System event', {
    event: 'system',
    action,
    ...details,
  })
}

export const logSecurity = (event: string, details?: any) => {
  logger.warn('Security event', {
    event: 'security',
    securityEvent: event,
    ...details,
  })
}

export const logPerformance = (operation: string, duration: number, details?: any) => {
  logger.info('Performance metric', {
    event: 'performance',
    operation,
    duration,
    ...details,
  })
}

export const logError = (error: Error, context?: any) => {
  logger.error('Application error', {
    event: 'error',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
  })
}

export default logger