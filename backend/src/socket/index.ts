import { Server as SocketIOServer } from 'socket.io'
import jwt from 'jsonwebtoken'
import { config } from '@/config'
import { logger } from '@/utils/logger'

export function setupSocketIO(io: SocketIOServer) {
  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token

      if (!token) {
        return next(new Error('Authentication token required'))
      }

      const decoded = jwt.verify(token, config.jwt.secret) as any
      socket.userId = decoded.userId
      socket.userEmail = decoded.email
      socket.userRole = decoded.role

      logger.logAuth('websocket_connected', decoded.userId, {
        socketId: socket.id,
        ip: socket.handshake.address,
      })

      next()
    } catch (error) {
      logger.error('Socket authentication error:', error)
      next(new Error('Invalid authentication token'))
    }
  })

  io.on('connection', (socket) => {
    logger.info('Socket connected', {
      socketId: socket.id,
      userId: socket.userId,
      userEmail: socket.userEmail,
    })

    // Join user to their personal room
    socket.join(`user:${socket.userId}`)

    // Handle joining analysis room
    socket.on('join_analysis', async (data) => {
      try {
        const { analysisId } = data

        if (!analysisId) {
          socket.emit('error', { message: 'Analysis ID required' })
          return
        }

        // Verify user has access to this analysis
        const { prisma } = await import('@/database')
        const analysis = await prisma.analysisJob.findFirst({
          where: {
            id: analysisId,
            project: {
              OR: [
                { ownerId: socket.userId },
                {
                  collaborators: {
                    some: { userId: socket.userId }
                  }
                },
                { isPublic: true }
              ]
            }
          },
        })

        if (!analysis) {
          socket.emit('error', { message: 'Analysis not found or access denied' })
          return
        }

        socket.join(`analysis:${analysisId}`)
        logger.logAnalysis('socket_joined_analysis', analysisId, {
          userId: socket.userId,
          socketId: socket.id,
        })

        socket.emit('joined_analysis', { analysisId })
      } catch (error) {
        logger.error('Error joining analysis room:', error)
        socket.emit('error', { message: 'Failed to join analysis room' })
      }
    })

    // Handle leaving analysis room
    socket.on('leave_analysis', (data) => {
      const { analysisId } = data
      if (analysisId) {
        socket.leave(`analysis:${analysisId}`)
        logger.logAnalysis('socket_left_analysis', analysisId, {
          userId: socket.userId,
          socketId: socket.id,
        })
      }
    })

    // Handle joining upload room
    socket.on('join_upload', async (data) => {
      try {
        const { uploadId } = data

        if (!uploadId) {
          socket.emit('error', { message: 'Upload ID required' })
          return
        }

        // For now, allow any authenticated user to join upload room
        // In production, you might want to verify upload ownership
        socket.join(`upload:${uploadId}`)

        logger.logFile('socket_joined_upload', uploadId, {
          userId: socket.userId,
          socketId: socket.id,
        })

        socket.emit('joined_upload', { uploadId })
      } catch (error) {
        logger.error('Error joining upload room:', error)
        socket.emit('error', { message: 'Failed to join upload room' })
      }
    })

    // Handle leaving upload room
    socket.on('leave_upload', (data) => {
      const { uploadId } = data
      if (uploadId) {
        socket.leave(`upload:${uploadId}`)
        logger.logFile('socket_left_upload', uploadId, {
          userId: socket.userId,
          socketId: socket.id,
        })
      }
    })

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        reason,
      })
    })

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error:', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message,
      })
    })
  })

  // Make Socket.IO instance available globally for emitting events
  global.socketIO = io

  logger.info('Socket.IO server initialized')
}

// Helper functions to emit events
export const socketEmit = {
  // Analysis events
  analysisProgress: (analysisId: string, data: any) => {
    global.socketIO?.to(`analysis:${analysisId}`).emit('analysis_progress', data)
  },

  analysisCompleted: (analysisId: string, results: any) => {
    global.socketIO?.to(`analysis:${analysisId}`).emit('analysis_completed', {
      analysisId,
      results,
    })
  },

  analysisFailed: (analysisId: string, error: string) => {
    global.socketIO?.to(`analysis:${analysisId}`).emit('analysis_failed', {
      analysisId,
      error,
    })
  },

  // Upload events
  uploadProgress: (uploadId: string, data: any) => {
    global.socketIO?.to(`upload:${uploadId}`).emit('file_upload_progress', data)
  },

  uploadCompleted: (uploadId: string, fileData: any) => {
    global.socketIO?.to(`upload:${uploadId}`).emit('file_upload_completed', {
      uploadId,
      file: fileData,
    })
  },

  uploadFailed: (uploadId: string, error: string) => {
    global.socketIO?.to(`upload:${uploadId}`).emit('file_upload_failed', {
      uploadId,
      error,
    })
  },

  // User-specific notifications
  userNotification: (userId: string, notification: any) => {
    global.socketIO?.to(`user:${userId}`).emit('notification', notification)
  },

  // System-wide announcements
  systemAnnouncement: (message: any) => {
    global.socketIO?.emit('system_announcement', message)
  },
}

// Extend Socket interface to include custom properties
declare global {
  namespace SocketIO {
    interface Socket {
      userId: string
      userEmail: string
      userRole: string
    }
  }

  var socketIO: SocketIOServer | undefined
}