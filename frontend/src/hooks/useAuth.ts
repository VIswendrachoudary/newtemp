import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { User, LoginCredentials, RegisterData, AuthResponse, AuthState } from '@/types'
import { apiService } from '@/services/api'

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>
  register: (userData: RegisterData) => Promise<void>
  logout: () => Promise<void>
  updateUser: (userData: Partial<User>) => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  })

  const navigate = useNavigate()
  const location = useLocation()

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken')

      if (token) {
        try {
          const response = await apiService.getCurrentUser()
          if (response.success && response.data) {
            setAuthState({
              user: response.data,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            })
          } else {
            // Token invalid, clear it
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            setAuthState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            })
          }
        } catch (error) {
          console.error('Failed to initialize auth:', error)
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          })
        }
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
      }
    }

    initAuth()
  }, [])

  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

      const response = await apiService.login(credentials)

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data

        // Store tokens
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)

        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })

        toast.success(`Welcome back, ${user.firstName}!`)

        // Redirect to intended page or dashboard
        const intendedPath = location.state?.from?.pathname || '/dashboard'
        navigate(intendedPath, { replace: true })
      } else {
        throw new Error(response.error || 'Login failed')
      }
    } catch (error: any) {
      const errorMessage = error.error || 'Login failed. Please check your credentials.'
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      toast.error(errorMessage)
      throw error
    }
  }

  const register = async (userData: RegisterData): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

      const response = await apiService.register(userData)

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data

        // Store tokens
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)

        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })

        toast.success(`Welcome to eDNA Platform, ${user.firstName}!`)

        // Redirect to dashboard
        navigate('/dashboard', { replace: true })
      } else {
        throw new Error(response.error || 'Registration failed')
      }
    } catch (error: any) {
      const errorMessage = error.error || 'Registration failed. Please try again.'
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      toast.error(errorMessage)
      throw error
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await apiService.logout()
    } catch (error) {
      console.error('Logout API call failed:', error)
    } finally {
      // Clear tokens and state
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')

      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })

      toast.success('You have been logged out.')
      navigate('/', { replace: true })
    }
  }

  const updateUser = async (userData: Partial<User>): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))

      const response = await apiService.updateProfile(userData)

      if (response.success && response.data) {
        setAuthState(prev => ({
          ...prev,
          user: response.data,
          isLoading: false,
          error: null,
        }))

        toast.success('Profile updated successfully!')
      } else {
        throw new Error(response.error || 'Profile update failed')
      }
    } catch (error: any) {
      const errorMessage = error.error || 'Profile update failed.'
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      toast.error(errorMessage)
      throw error
    }
  }

  const refreshAuth = async (): Promise<void> => {
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        throw new Error('No refresh token available')
      }

      const response = await apiService.refreshToken(refreshToken)

      if (response.success && response.data) {
        const { accessToken } = response.data
        localStorage.setItem('accessToken', accessToken)
      } else {
        throw new Error(response.error || 'Token refresh failed')
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      // Clear tokens and force logout
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
      navigate('/login', { replace: true })
    }
  }

  const value: AuthContextType = {
    ...authState,
    login,
    register,
    logout,
    updateUser,
    refreshAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}