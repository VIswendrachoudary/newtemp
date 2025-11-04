import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import dotenv from 'dotenv'

import { config } from '@/config'
import { logger } from '@/utils/logger'
import { errorHandler } from '@/middleware/errorHandler'
import { notFoundHandler } from '@/middleware/notFoundHandler'
import { rateLimiter } from '@/middleware/rateLimiter'
import { setupDatabase } from '@/database'
import { setupQueue } from '@/queue'
import { setupSocketIO } from '@/socket'

// Import routes
import authRoutes from '@/routes/auth'
import projectRoutes from '@/routes/projects'
import fileRoutes from '@/routes/files'
import analysisRoutes from '@/routes/analysis'
import resultsRoutes from '@/routes/results'
import systemRoutes from '@/routes/system'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const io = new SocketIOServer(server, {
  cors: {
    origin: config.frontend.url,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

async function startServer() {
  try {
    // Initialize database
    await setupDatabase()
    logger.info('Database initialized successfully')

    // Initialize queue system
    await setupQueue()
    logger.info('Queue system initialized successfully')

    // Setup Socket.IO
    setupSocketIO(io)
    logger.info('Socket.IO initialized successfully')

    // Middleware
    app.use(helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }))

    app.use(compression())

    app.use(cors({
      origin: config.frontend.url,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }))

    app.use(morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) }
    }))

    app.use(express.json({ limit: '10mb' }))
    app.use(express.urlencoded({ extended: true, limit: '10mb' }))

    // Rate limiting
    app.use(rateLimiter)

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.env,
      })
    })

    // API routes
    app.use('/api/auth', authRoutes)
    app.use('/api/projects', projectRoutes)
    app.use('/api/files', fileRoutes)
    app.use('/api/analysis', analysisRoutes)
    app.use('/api/results', resultsRoutes)
    app.use('/api/system', systemRoutes)

    // API documentation (in development)
    if (config.env === 'development') {
      import('swagger-ui-express').then(({ default: swaggerUi }) => {
        import('swagger-jsdoc').then(({ default: swaggerJsdoc }) => {
          const swaggerOptions = {
            definition: {
              openapi: '3.0.0',
              info: {
                title: 'eDNA Platform API',
                version: '1.0.0',
                description: 'AI-powered eDNA biodiversity monitoring system API',
              },
              servers: [
                {
                  url: `http://localhost:${config.port}/api`,
                  description: 'Development server',
                },
              ],
              components: {
                securitySchemes: {
                  bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                  },
                },
              },
            },
            apis: ['./src/routes/*.ts'],
          }

          const specs = swaggerJsdoc(swaggerOptions)
          app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs))
          logger.info('API documentation available at /api/docs')
        })
      })
    }

    // Error handling middleware (must be last)
    app.use(notFoundHandler)
    app.use(errorHandler)

    // Start server
    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.env} mode`)
      logger.info(`API documentation: http://localhost:${config.port}/api/docs`)
      logger.info(`Health check: http://localhost:${config.port}/health`)
    })

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`)

      server.close(async () => {
        logger.info('HTTP server closed')

        try {
          // Close database connections
          await import('@/database').then(({ prisma }) => prisma.$disconnect())
          logger.info('Database connections closed')

          // Close queue connections
          await import('@/queue').then(({ queue }) => queue.close())
          logger.info('Queue connections closed')

          process.exit(0)
        } catch (error) {
          logger.error('Error during shutdown:', error)
          process.exit(1)
        }
      })
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the server
startServer()