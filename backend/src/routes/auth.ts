import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '@/database'
import { config } from '@/config'
import { authenticateToken, AuthenticatedRequest } from '@/middleware/auth'
import { logger } from '@/utils/logger'
import { oauthController } from '@/controllers/oauthController'

const router = Router()

// Validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),
  body('password')
    .isLength({ min: 12 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 12 characters with uppercase, lowercase, numbers, and symbols'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name required (max 100 characters)'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name required (max 100 characters)'),
  body('institution')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Institution name too long (max 255 characters)'),
  body('orcidId')
    .optional()
    .matches(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/)
    .withMessage('Invalid ORCID ID format'),
]

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),
  body('password')
    .notEmpty()
    .withMessage('Password required'),
]

// Register new user
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 12
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               institution:
 *                 type: string
 *               orcidId:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or user already exists
 */
router.post('/register', registerValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        code: 'VALIDATION_ERROR',
      })
    }

    const { email, password, firstName, lastName, institution, orcidId } = req.body

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      logger.logSecurity('registration_attempt_existing_email', { email })
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
        code: 'AUTH_010',
      })
    }

    // Check ORCID ID uniqueness if provided
    if (orcidId) {
      const existingOrcid = await prisma.user.findUnique({
        where: { orcidId },
      })

      if (existingOrcid) {
        return res.status(400).json({
          success: false,
          error: 'ORCID ID already associated with another account',
          code: 'AUTH_011',
        })
      }
    }

    // Hash password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        institution,
        orcidId,
        role: 'RESEARCHER', // Default role
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        institution: true,
        orcidId: true,
        role: true,
        createdAt: true,
      },
    })

    // Generate tokens
    const accessToken = generateAccessToken(user)
    const refreshToken = generateRefreshToken()

    // Store refresh token
    await prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: await bcrypt.hash(refreshToken, saltRounds),
        refreshToken,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    })

    logger.logAuth('user_registered', user.id, {
      email: user.email,
      institution: user.institution,
    })

    res.status(201).json({
      success: true,
      data: {
        user,
        accessToken,
        refreshToken,
      },
      message: 'User registered successfully',
    })
  } catch (error) {
    logger.error('Registration error:', error)
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      code: 'AUTH_012',
    })
  }
})

// Login user
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        code: 'VALIDATION_ERROR',
      })
    }

    const { email, password } = req.body

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        institution: true,
        orcidId: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })

    if (!user) {
      logger.logSecurity('login_attempt_invalid_email', { email })
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'AUTH_013',
      })
    }

    if (!user.isActive) {
      logger.logSecurity('login_attempt_inactive_account', {
        userId: user.id,
        email: user.email
      })
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated',
        code: 'AUTH_014',
      })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash!)
    if (!isValidPassword) {
      logger.logSecurity('login_attempt_invalid_password', {
        userId: user.id,
        email: user.email
      })
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'AUTH_013',
      })
    }

    // Generate tokens
    const accessToken = generateAccessToken(user)
    const refreshToken = generateRefreshToken()

    // Store refresh token
    const saltRounds = 12
    await prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: await bcrypt.hash(refreshToken, saltRounds),
        refreshToken,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    })

    // Remove password hash from response
    const { passwordHash, ...userResponse } = user

    logger.logAuth('user_login', user.id, {
      email: user.email,
      lastLoginAt: user.lastLoginAt,
    })

    res.json({
      success: true,
      data: {
        user: userResponse,
        accessToken,
        refreshToken,
      },
      message: 'Login successful',
    })
  } catch (error) {
    logger.error('Login error:', error)
    res.status(500).json({
      success: false,
      error: 'Login failed',
      code: 'AUTH_015',
    })
  }
})

// Refresh access token
/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token required',
        code: 'AUTH_016',
      })
    }

    // Find valid session with this refresh token
    const session = await prisma.userSession.findFirst({
      where: {
        refreshToken,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            institution: true,
            orcidId: true,
            role: true,
            isActive: true,
          },
        },
      },
    })

    if (!session || !session.user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
        code: 'AUTH_017',
      })
    }

    // Generate new access token
    const accessToken = generateAccessToken(session.user)

    logger.logAuth('token_refreshed', session.user.id)

    res.json({
      success: true,
      data: {
        accessToken,
      },
      message: 'Token refreshed successfully',
    })
  } catch (error) {
    logger.error('Token refresh error:', error)
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
      code: 'AUTH_018',
    })
  }
})

// Logout user
/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user and invalidate tokens
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    // Invalidate user sessions
    await prisma.userSession.updateMany({
      where: {
        userId: req.user!.id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    })

    logger.logAuth('user_logout', req.user!.id)

    res.json({
      success: true,
      message: 'Logout successful',
    })
  } catch (error) {
    logger.error('Logout error:', error)
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      code: 'AUTH_019',
    })
  }
})

// Get current user
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        institution: true,
        orcidId: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'AUTH_020',
      })
    }

    res.json({
      success: true,
      data: user,
    })
  } catch (error) {
    logger.error('Get user error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get user information',
      code: 'AUTH_021',
    })
  }
})

// Update user profile
/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               institution:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', authenticateToken, [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters'),
  body('institution')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Institution name too long'),
  body('avatarUrl')
    .optional()
    .isURL()
    .withMessage('Valid avatar URL required'),
], async (req: AuthenticatedRequest, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        code: 'VALIDATION_ERROR',
      })
    }

    const { firstName, lastName, institution, avatarUrl } = req.body

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(institution !== undefined && { institution }),
        ...(avatarUrl && { avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        institution: true,
        orcidId: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    logger.logAuth('profile_updated', req.user!.id, {
      changes: { firstName, lastName, institution, avatarUrl },
    })

    res.json({
      success: true,
      data: user,
      message: 'Profile updated successfully',
    })
  } catch (error) {
    logger.error('Profile update error:', error)
    res.status(500).json({
      success: false,
      error: 'Profile update failed',
      code: 'AUTH_022',
    })
  }
})

// Change password
/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 12
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.post('/change-password', authenticateToken, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password required'),
  body('newPassword')
    .isLength({ min: 12 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must be at least 12 characters with uppercase, lowercase, numbers, and symbols'),
], async (req: AuthenticatedRequest, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        code: 'VALIDATION_ERROR',
      })
    }

    const { currentPassword, newPassword } = req.body

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { passwordHash: true },
    })

    if (!user?.passwordHash) {
      return res.status(400).json({
        success: false,
        error: 'User has no password set (OAuth user)',
        code: 'AUTH_023',
      })
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValidPassword) {
      logger.logSecurity('invalid_current_password', {
        userId: req.user!.id,
      })
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect',
        code: 'AUTH_024',
      })
    }

    // Hash new password
    const saltRounds = 12
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds)

    // Update password
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash: newPasswordHash },
    })

    // Invalidate all existing sessions (force re-login)
    await prisma.userSession.updateMany({
      where: {
        userId: req.user!.id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    })

    logger.logAuth('password_changed', req.user!.id)

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.',
    })
  } catch (error) {
    logger.error('Password change error:', error)
    res.status(500).json({
      success: false,
      error: 'Password change failed',
      code: 'AUTH_025',
    })
  }
})

// OAuth routes
router.get('/oauth/google/url', oauthController.getGoogleAuthUrl)
router.post('/oauth/google', oauthController.handleGoogleCallback)
router.get('/oauth/orcid/url', oauthController.getORCIDAuthUrl)
router.post('/oauth/orcid', oauthController.handleORCIDCallback)
router.get('/oauth/github/url', oauthController.getGitHubAuthUrl)
router.post('/oauth/github', oauthController.handleGitHubCallback)

// Helper functions
function generateAccessToken(user: any) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  )
}

function generateRefreshToken() {
  return jwt.sign(
    { type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  )
}

export default router