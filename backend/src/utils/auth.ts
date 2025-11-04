import jwt from 'jsonwebtoken'
import { config } from '@/config'

export interface TokenPayload {
  userId: string
  email: string
  role: string
}

export function generateAccessToken(user: TokenPayload): string {
  return jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  )
}

export function generateRefreshToken(): string {
  return jwt.sign(
    { type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  )
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.secret) as TokenPayload
}

export function verifyRefreshToken(token: string): { type: string } {
  return jwt.verify(token, config.jwt.refreshSecret) as { type: string }
}

export function generateRandomToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}