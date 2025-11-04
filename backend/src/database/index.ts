import { PrismaClient } from '@prisma/client'
import { config } from '@/config'
import { logger } from '@/utils/logger'

// Create Prisma client instance
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.database.url,
    },
  },
  log: config.env === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
})

// Database connection setup
export async function setupDatabase() {
  try {
    // Test database connection
    await prisma.$connect()
    logger.info('Database connected successfully')

    // Run migrations in production
    if (config.env === 'production') {
      // Note: In production, migrations should be run separately
      // This is just for development convenience
      logger.info('Database is ready for production use')
    }

    return prisma
  } catch (error) {
    logger.error('Database connection failed:', error)
    throw error
  }
}

// Graceful database disconnection
export async function disconnectDatabase() {
  try {
    await prisma.$disconnect()
    logger.info('Database disconnected successfully')
  } catch (error) {
    logger.error('Database disconnection failed:', error)
    throw error
  }
}

// Database health check
export async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'healthy', timestamp: new Date().toISOString() }
  } catch (error) {
    logger.error('Database health check failed:', error)
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() }
  }
}

// Database transaction helper
export async function withTransaction<T>(
  callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(callback)
}

export default prisma