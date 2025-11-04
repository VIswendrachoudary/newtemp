import Bull from 'bull'
import Redis from 'ioredis'
import { config } from '@/config'
import { logger } from '@/utils/logger'
import { processAnalysisJob } from '@/jobs/analysisJob'
import { sendEmailJob } from '@/jobs/emailJob'

// Create Redis connection
const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
})

// Create main queue
export const queue = new Bull('eDNA processing queue', {
  redis: config.redis.url,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
})

// Create separate queues for different job types
export const analysisQueue = new Bull('analysis processing', {
  redis: config.redis.url,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
})

export const emailQueue = new Bull('email notifications', {
  redis: config.redis.url,
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 10,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  },
})

// Queue system setup
export async function setupQueue() {
  try {
    // Test Redis connection
    await redis.ping()
    logger.info('Redis connected successfully')

    // Register job processors
    analysisQueue.process('run-analysis', config.processing.maxConcurrentJobs, processAnalysisJob)
    emailQueue.process('send-email', 5, sendEmailJob)

    // Queue event listeners
    setupQueueListeners(analysisQueue, 'analysis')
    setupQueueListeners(emailQueue, 'email')
    setupQueueListeners(queue, 'general')

    logger.info('Queue system initialized successfully')
    return queue
  } catch (error) {
    logger.error('Queue setup failed:', error)
    throw error
  }
}

// Setup queue event listeners
function setupQueueListeners(queue: Bull.Queue, queueName: string) {
  queue.on('completed', (job, result) => {
    logger.info(`${queueName} job completed`, {
      jobId: job.id,
      jobType: job.name,
      duration: Date.now() - job.timestamp,
      result,
    })
  })

  queue.on('failed', (job, err) => {
    logger.error(`${queueName} job failed`, {
      jobId: job.id,
      jobType: job.name,
      attempts: job.attemptsMade,
      error: err.message,
      stack: err.stack,
    })
  })

  queue.on('stalled', (job) => {
    logger.warn(`${queueName} job stalled`, {
      jobId: job.id,
      jobType: job.name,
      attempts: job.attemptsMade,
    })
  })

  queue.on('progress', (job, progress) => {
    logger.debug(`${queueName} job progress`, {
      jobId: job.id,
      jobType: job.name,
      progress,
    })
  })

  queue.on('error', (err) => {
    logger.error(`${queueName} queue error`, {
      error: err.message,
      stack: err.stack,
    })
  })
}

// Graceful queue shutdown
export async function closeQueues() {
  try {
    await queue.close()
    await analysisQueue.close()
    await emailQueue.close()
    await redis.disconnect()
    logger.info('All queues closed successfully')
  } catch (error) {
    logger.error('Queue shutdown failed:', error)
    throw error
  }
}

// Queue health check
export async function checkQueueHealth() {
  try {
    const counts = await queue.getJobCounts()
    const analysisCounts = await analysisQueue.getJobCounts()
    const emailCounts = await emailQueue.getJobCounts()

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      queues: {
        general: counts,
        analysis: analysisCounts,
        email: emailCounts,
      },
    }
  } catch (error) {
    logger.error('Queue health check failed:', error)
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    }
  }
}

// Job creation helpers
export const jobs = {
  // Analysis jobs
  runAnalysis: (data: any, options?: Bull.JobOptions) =>
    analysisQueue.add('run-analysis', data, {
      priority: 10,
      delay: 0,
      ...options,
    }),

  cancelAnalysis: (jobId: string) =>
    analysisQueue.getJob(jobId).then(job => job?.remove()),

  // Email jobs
  sendEmail: (data: any, options?: Bull.JobOptions) =>
    emailQueue.add('send-email', data, {
      priority: 5,
      delay: 0,
      ...options,
    }),

  sendWelcomeEmail: (userId: string, email: string) =>
    emailQueue.add('send-email', {
      type: 'welcome',
      userId,
      to: email,
      template: 'welcome',
    }),

  sendAnalysisCompletedEmail: (userId: string, analysisId: string, email: string) =>
    emailQueue.add('send-email', {
      type: 'analysis_completed',
      userId,
      analysisId,
      to: email,
      template: 'analysis_completed',
    }),

  sendAnalysisFailedEmail: (userId: string, analysisId: string, email: string, error: string) =>
    emailQueue.add('send-email', {
      type: 'analysis_failed',
      userId,
      analysisId,
      to: email,
      template: 'analysis_failed',
      data: { error },
    }),
}

export default queue