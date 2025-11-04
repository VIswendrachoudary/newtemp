import { Request, Response } from 'express'
import { google } from 'googleapis'
import axios from 'axios'
import { prisma } from '@/database'
import { config } from '@/config'
import { logger } from '@/utils/logger'
import { generateAccessToken, generateRefreshToken } from '@/utils/auth'

export const oauthController = {
  // Google OAuth
  async getGoogleAuthUrl(req: Request, res: Response) {
    try {
      if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
        return res.status(503).json({
          success: false,
          error: 'Google OAuth not configured',
          code: 'OAUTH_001',
        })
      }

      const oauth2Client = new google.auth.OAuth2(
        config.oauth.google.clientId,
        config.oauth.google.clientSecret,
        `${config.frontend.url}/auth/google/callback`
      )

      const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ]

      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
      })

      res.json({
        success: true,
        data: { url },
      })
    } catch (error) {
      logger.error('Google OAuth URL generation error:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to generate Google OAuth URL',
        code: 'OAUTH_002',
      })
    }
  },

  async handleGoogleCallback(req: Request, res: Response) {
    try {
      const { code } = req.body

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Authorization code required',
          code: 'OAUTH_003',
        })
      }

      if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
        return res.status(503).json({
          success: false,
          error: 'Google OAuth not configured',
          code: 'OAUTH_001',
        })
      }

      // Exchange code for tokens
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: config.oauth.google.clientId,
        client_secret: config.oauth.google.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${config.frontend.url}/auth/google/callback`,
      })

      const { access_token, refresh_token } = tokenResponse.data

      // Get user info
      const oauth2Client = new google.auth.OAuth2(
        config.oauth.google.clientId,
        config.oauth.google.clientSecret
      )

      oauth2Client.setCredentials({ access_token })

      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const userInfoResponse = await oauth2.userinfo.get()

      const userInfo = userInfoResponse.data
      if (!userInfo.email || !userInfo.name) {
        return res.status(400).json({
          success: false,
          error: 'Incomplete user information from Google',
          code: 'OAUTH_004',
        })
      }

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { email: userInfo.email! },
      })

      if (!user) {
        // Create new user
        const nameParts = userInfo.name!.split(' ')
        user = await prisma.user.create({
          data: {
            email: userInfo.email!,
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            avatarUrl: userInfo.picture,
            role: 'RESEARCHER',
          },
        })
      }

      // Check if Google OAuth account already exists
      let oauthAccount = await prisma.oAuthAccount.findUnique({
        where: {
          provider_userId: {
            provider: 'GOOGLE',
            userId: userInfo.id!,
          },
        },
      })

      if (!oauthAccount) {
        // Create OAuth account
        oauthAccount = await prisma.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: 'GOOGLE',
            providerId: userInfo.id!,
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: tokenResponse.data.expires_in
              ? new Date(Date.now() + tokenResponse.data.expires_in * 1000)
              : null,
          },
        })
      } else {
        // Update existing OAuth account
        await prisma.oAuthAccount.update({
          where: { id: oauthAccount.id },
          data: {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: tokenResponse.data.expires_in
              ? new Date(Date.now() + tokenResponse.data.expires_in * 1000)
              : null,
          },
        })
      }

      // Generate JWT tokens
      const accessToken = generateAccessToken(user)
      const refreshToken = generateRefreshToken()

      // Store refresh token session
      await prisma.userSession.create({
        data: {
          userId: user.id,
          tokenHash: require('bcrypt').hashSync(refreshToken, 12),
          refreshToken,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      })

      logger.logAuth('oauth_login', user.id, {
        provider: 'google',
        email: user.email,
      })

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            institution: user.institution,
            orcidId: user.orcidId,
            role: user.role,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
          },
          accessToken,
          refreshToken,
        },
        message: 'Google authentication successful',
      })
    } catch (error) {
      logger.error('Google OAuth callback error:', error)
      res.status(500).json({
        success: false,
        error: 'Google authentication failed',
        code: 'OAUTH_005',
      })
    }
  },

  // ORCID OAuth
  async getORCIDAuthUrl(req: Request, res: Response) {
    try {
      if (!config.oauth.orcid.clientId || !config.oauth.orcid.clientSecret) {
        return res.status(503).json({
          success: false,
          error: 'ORCID OAuth not configured',
          code: 'OAUTH_006',
        })
      }

      const scopes = ['/authenticate', '/read-public']
      const redirectUri = `${config.frontend.url}/auth/orcid/callback`

      const params = new URLSearchParams({
        client_id: config.oauth.orcid.clientId,
        response_type: 'code',
        scope: scopes.join(' '),
        redirect_uri: redirectUri,
      })

      const url = `https://orcid.org/oauth/authorize?${params.toString()}`

      res.json({
        success: true,
        data: { url },
      })
    } catch (error) {
      logger.error('ORCID OAuth URL generation error:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to generate ORCID OAuth URL',
        code: 'OAUTH_007',
      })
    }
  },

  async handleORCIDCallback(req: Request, res: Response) {
    try {
      const { code } = req.body

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Authorization code required',
          code: 'OAUTH_008',
        })
      }

      if (!config.oauth.orcid.clientId || !config.oauth.orcid.clientSecret) {
        return res.status(503).json({
          success: false,
          error: 'ORCID OAuth not configured',
          code: 'OAUTH_006',
        })
      }

      // Exchange code for tokens
      const tokenResponse = await axios.post('https://orcid.org/oauth/token', {
        client_id: config.oauth.orcid.clientId,
        client_secret: config.oauth.orcid.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${config.frontend.url}/auth/orcid/callback`,
      }, {
        headers: {
          'Accept': 'application/json',
        },
      })

      const { access_token, orcid } = tokenResponse.data

      if (!orcid) {
        return res.status(400).json({
          success: false,
          error: 'ORCID ID not received',
          code: 'OAUTH_009',
        })
      }

      // Get user info from ORCID
      const userResponse = await axios.get(`https://pub.orcid.org/v3.0/${orcid}/record`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${access_token}`,
        },
      })

      const person = userResponse.data.person
      const emails = person.emails?.email || []
      const primaryEmail = emails.find((email: any) => email.primary)?.email || emails[0]?.email

      if (!primaryEmail) {
        return res.status(400).json({
          success: false,
          error: 'No email found in ORCID profile',
          code: 'OAUTH_010',
        })
      }

      const names = person.name
      const firstName = names?.['given-names']?.value || ''
      const lastName = names?.['family-name']?.value || ''

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { email: primaryEmail },
      })

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: primaryEmail,
            firstName,
            lastName,
            orcidId: orcid,
            role: 'RESEARCHER',
          },
        })
      } else {
        // Update ORCID ID if not set
        if (!user.orcidId) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { orcidId: orcid },
          })
        }
      }

      // Check if ORCID OAuth account already exists
      let oauthAccount = await prisma.oAuthAccount.findUnique({
        where: {
          provider_userId: {
            provider: 'ORCID',
            userId: orcid,
          },
        },
      })

      if (!oauthAccount) {
        oauthAccount = await prisma.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: 'ORCID',
            providerId: orcid,
            accessToken: access_token,
            expiresAt: tokenResponse.data.expires_in
              ? new Date(Date.now() + tokenResponse.data.expires_in * 1000)
              : null,
          },
        })
      } else {
        await prisma.oAuthAccount.update({
          where: { id: oauthAccount.id },
          data: {
            accessToken: access_token,
            expiresAt: tokenResponse.data.expires_in
              ? new Date(Date.now() + tokenResponse.data.expires_in * 1000)
              : null,
          },
        })
      }

      // Generate JWT tokens
      const accessToken = generateAccessToken(user)
      const refreshToken = generateRefreshToken()

      // Store refresh token session
      await prisma.userSession.create({
        data: {
          userId: user.id,
          tokenHash: require('bcrypt').hashSync(refreshToken, 12),
          refreshToken,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      })

      logger.logAuth('oauth_login', user.id, {
        provider: 'orcid',
        email: user.email,
        orcidId: orcid,
      })

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            institution: user.institution,
            orcidId: user.orcidId,
            role: user.role,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
          },
          accessToken,
          refreshToken,
        },
        message: 'ORCID authentication successful',
      })
    } catch (error) {
      logger.error('ORCID OAuth callback error:', error)
      res.status(500).json({
        success: false,
        error: 'ORCID authentication failed',
        code: 'OAUTH_011',
      })
    }
  },

  // GitHub OAuth
  async getGitHubAuthUrl(req: Request, res: Response) {
    try {
      if (!config.oauth.github.clientId || !config.oauth.github.clientSecret) {
        return res.status(503).json({
          success: false,
          error: 'GitHub OAuth not configured',
          code: 'OAUTH_012',
        })
      }

      const scopes = ['user:email']
      const redirectUri = `${config.frontend.url}/auth/github/callback`

      const params = new URLSearchParams({
        client_id: config.oauth.github.clientId,
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
      })

      const url = `https://github.com/login/oauth/authorize?${params.toString()}`

      res.json({
        success: true,
        data: { url },
      })
    } catch (error) {
      logger.error('GitHub OAuth URL generation error:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to generate GitHub OAuth URL',
        code: 'OAUTH_013',
      })
    }
  },

  async handleGitHubCallback(req: Request, res: Response) {
    try {
      const { code } = req.body

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Authorization code required',
          code: 'OAUTH_014',
        })
      }

      if (!config.oauth.github.clientId || !config.oauth.github.clientSecret) {
        return res.status(503).json({
          success: false,
          error: 'GitHub OAuth not configured',
          code: 'OAUTH_012',
        })
      }

      // Exchange code for tokens
      const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: config.oauth.github.clientId,
        client_secret: config.oauth.github.clientSecret,
        code,
      }, {
        headers: {
          'Accept': 'application/json',
        },
      })

      const { access_token } = tokenResponse.data

      // Get user info
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${access_token}`,
          'User-Agent': 'eDNA-Platform',
        },
      })

      const userInfo = userResponse.data

      // Get user email (GitHub requires separate API call for private emails)
      const emailResponse = await axios.get('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `token ${access_token}`,
          'User-Agent': 'eDNA-Platform',
        },
      })

      const emails = emailResponse.data
      const primaryEmail = emails.find((email: any) => email.primary)?.email || emails[0]?.email

      if (!primaryEmail) {
        return res.status(400).json({
          success: false,
          error: 'No email found in GitHub profile',
          code: 'OAUTH_015',
        })
      }

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { email: primaryEmail },
      })

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: primaryEmail,
            firstName: userInfo.name?.split(' ')[0] || '',
            lastName: userInfo.name?.split(' ').slice(1).join(' ') || '',
            avatarUrl: userInfo.avatar_url,
            role: 'RESEARCHER',
          },
        })
      }

      // Check if GitHub OAuth account already exists
      let oauthAccount = await prisma.oAuthAccount.findUnique({
        where: {
          provider_userId: {
            provider: 'GITHUB',
            userId: userInfo.id.toString(),
          },
        },
      })

      if (!oauthAccount) {
        oauthAccount = await prisma.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: 'GITHUB',
            providerId: userInfo.id.toString(),
            accessToken: access_token,
          },
        })
      } else {
        await prisma.oAuthAccount.update({
          where: { id: oauthAccount.id },
          data: {
            accessToken: access_token,
          },
        })
      }

      // Generate JWT tokens
      const accessToken = generateAccessToken(user)
      const refreshToken = generateRefreshToken()

      // Store refresh token session
      await prisma.userSession.create({
        data: {
          userId: user.id,
          tokenHash: require('bcrypt').hashSync(refreshToken, 12),
          refreshToken,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      })

      logger.logAuth('oauth_login', user.id, {
        provider: 'github',
        email: user.email,
        githubId: userInfo.id,
      })

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            institution: user.institution,
            orcidId: user.orcidId,
            role: user.role,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
          },
          accessToken,
          refreshToken,
        },
        message: 'GitHub authentication successful',
      })
    } catch (error) {
      logger.error('GitHub OAuth callback error:', error)
      res.status(500).json({
        success: false,
        error: 'GitHub authentication failed',
        code: 'OAUTH_016',
      })
    }
  },
}