import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '@/database'
import { config } from '@/config'
import { logger } from '@/utils/logger'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
  }
}

export interface JWTPayload {
  userId: string
  email: string
  role: string
  iat: number
  exp: number
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'AUTH_001',
      })
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload

    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
      },
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'AUTH_002',
      })
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated',
        code: 'AUTH_003',
      })
    }

    // Update last login time (async, don't wait)
    prisma.user
      .update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
      .catch((error) => {
        logger.error('Failed to update last login time:', error)
      })

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    }

    logger.logAuth('token_authenticated', user.id, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    })

    next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'AUTH_004',
      })
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'AUTH_005',
      })
    }

    logger.error('Authentication error:', error)
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_006',
    })
  }
}

export const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_001',
      })
    }

    if (!roles.includes(req.user.role)) {
      logger.logSecurity('insufficient_permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path,
        method: req.method,
      })

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'AUTH_007',
      })
    }

    next()
  }
}

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return next() // No token, continue without authentication
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true },
    })

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      }
    }

    next()
  } catch (error) {
    // Ignore errors in optional auth, just continue without user
    next()
  }
}

export const requireOwnership = (resourceType: 'project' | 'analysis' | 'file') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_001',
      })
    }

    const resourceId = req.params.id || req.params.projectId || req.params.analysisId || req.params.fileId

    if (!resourceId) {
      return res.status(400).json({
        success: false,
        error: 'Resource ID required',
        code: 'VALIDATION_ERROR',
      })
    }

    try {
      let hasAccess = false

      switch (resourceType) {
        case 'project':
          const project = await prisma.project.findUnique({
            where: { id: resourceId },
            select: {
              ownerId: true,
              collaborators: {
                where: { userId: req.user!.id },
                select: { role: true },
              },
              isPublic: true,
            },
          })
          hasAccess = !!(
            project?.ownerId === req.user!.id ||
            project?.collaborators.length > 0 ||
            project?.isPublic ||
            req.user!.role === 'system_admin'
          )
          break

        case 'analysis':
          const analysis = await prisma.analysisJob.findUnique({
            where: { id: resourceId },
            select: {
              project: {
                select: {
                  ownerId: true,
                  collaborators: {
                    where: { userId: req.user!.id },
                    select: { role: true },
                  },
                  isPublic: true,
                },
              },
            },
          })
          hasAccess = !!(
            analysis?.project.ownerId === req.user!.id ||
            analysis?.project.collaborators.length > 0 ||
            analysis?.project.isPublic ||
            req.user!.role === 'system_admin'
          )
          break

        case 'file':
          const file = await prisma.uploadedFile.findUnique({
            where: { id: resourceId },
            select: {
              project: {
                select: {
                  ownerId: true,
                  collaborators: {
                    where: { userId: req.user!.id },
                    select: { role: true },
                  },
                  isPublic: true,
                },
              },
            },
          })
          hasAccess = !!(
            file?.project.ownerId === req.user!.id ||
            file?.project.collaborators.length > 0 ||
            file?.project.isPublic ||
            req.user!.role === 'system_admin'
          )
          break
      }

      if (!hasAccess) {
        logger.logSecurity('unauthorized_resource_access', {
          userId: req.user!.id,
          resourceType,
          resourceId,
          path: req.path,
          method: req.method,
        })

        return res.status(403).json({
          success: false,
          error: 'Access denied to this resource',
          code: 'AUTH_008',
        })
      }

      next()
    } catch (error) {
      logger.error('Ownership check error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to verify resource access',
        code: 'AUTH_009',
      })
    }
  }
}