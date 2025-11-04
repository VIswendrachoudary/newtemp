import axios, { AxiosInstance, AxiosResponse } from 'axios'
import {
  User,
  LoginCredentials,
  RegisterData,
  AuthResponse,
  Project,
  CreateProjectData,
  UploadedFile,
  AnalysisJob,
  AnalysisParameters,
  AnalysisResults,
  ApiResponse,
  PaginatedResponse,
  ExportOptions,
} from '@/types'

class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor to handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            const refreshToken = localStorage.getItem('refreshToken')
            if (refreshToken) {
              const response = await this.client.post('/auth/refresh', {
                refreshToken,
              })

              const { accessToken } = response.data.data
              localStorage.setItem('accessToken', accessToken)

              // Retry the original request
              originalRequest.headers.Authorization = `Bearer ${accessToken}`
              return this.client(originalRequest)
            }
          } catch (refreshError) {
            // Refresh token failed, logout user
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            window.location.href = '/login'
            return Promise.reject(refreshError)
          }
        }

        return Promise.reject(error)
      }
    )
  }

  // Generic request method
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any,
    config?: any
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.request({
        method,
        url,
        data,
        ...config,
      })

      return response.data
    } catch (error: any) {
      throw {
        success: false,
        error: error.response?.data?.error || error.message || 'Request failed',
        status: error.response?.status,
      }
    }
  }

  // Authentication endpoints
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
    return this.request('POST', '/auth/login', credentials)
  }

  async register(userData: RegisterData): Promise<ApiResponse<AuthResponse>> {
    return this.request('POST', '/auth/register', userData)
  }

  async logout(): Promise<ApiResponse> {
    return this.request('POST', '/auth/logout')
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ accessToken: string }>> {
    return this.request('POST', '/auth/refresh', { refreshToken })
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request('GET', '/auth/me')
  }

  async updateProfile(userData: Partial<User>): Promise<ApiResponse<User>> {
    return this.request('PUT', '/auth/profile', userData)
  }

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<ApiResponse> {
    return this.request('POST', '/auth/change-password', data)
  }

  // OAuth endpoints
  async getGoogleOAuthUrl(): Promise<ApiResponse<{ url: string }>> {
    return this.request('GET', '/auth/oauth/google/url')
  }

  async handleGoogleCallback(code: string): Promise<ApiResponse<AuthResponse>> {
    return this.request('POST', '/auth/oauth/google', { code })
  }

  async getORCIDOAuthUrl(): Promise<ApiResponse<{ url: string }>> {
    return this.request('GET', '/auth/oauth/orcid/url')
  }

  async handleORCIDCallback(code: string): Promise<ApiResponse<AuthResponse>> {
    return this.request('POST', '/auth/oauth/orcid', { code })
  }

  // Project endpoints
  async getProjects(params?: {
    page?: number
    limit?: number
    search?: string
    visibility?: string
  }): Promise<ApiResponse<PaginatedResponse<Project>>> {
    const queryParams = new URLSearchParams(params as any).toString()
    return this.request('GET', `/projects?${queryParams}`)
  }

  async getProject(id: string): Promise<ApiResponse<Project>> {
    return this.request('GET', `/projects/${id}`)
  }

  async createProject(data: CreateProjectData): Promise<ApiResponse<Project>> {
    return this.request('POST', '/projects', data)
  }

  async updateProject(id: string, data: Partial<Project>): Promise<ApiResponse<Project>> {
    return this.request('PUT', `/projects/${id}`, data)
  }

  async deleteProject(id: string): Promise<ApiResponse> {
    return this.request('DELETE', `/projects/${id}`)
  }

  async shareProject(id: string, emails: string[]): Promise<ApiResponse> {
    return this.request('POST', `/projects/${id}/share`, { emails })
  }

  async getProjectFiles(id: string): Promise<ApiResponse<UploadedFile[]>> {
    return this.request('GET', `/projects/${id}/files`)
  }

  async getProjectAnalyses(id: string): Promise<ApiResponse<AnalysisJob[]>> {
    return this.request('GET', `/projects/${id}/analyses`)
  }

  // File endpoints
  async uploadFile(projectId: string, file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<UploadedFile>> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectId', projectId)

    return new Promise((resolve, reject) => {
      this.client
        .post('/files/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              onProgress(progress)
            }
          },
        })
        .then((response) => {
          resolve(response.data)
        })
        .catch((error) => {
          reject({
            success: false,
            error: error.response?.data?.error || error.message || 'Upload failed',
            status: error.response?.status,
          })
        })
    })
  }

  async getFile(id: string): Promise<ApiResponse<UploadedFile>> {
    return this.request('GET', `/files/${id}`)
  }

  async downloadFile(id: string): Promise<Blob> {
    const response = await this.client.get(`/files/${id}/download`, {
      responseType: 'blob',
    })
    return response.data
  }

  async deleteFile(id: string): Promise<ApiResponse> {
    return this.request('DELETE', `/files/${id}`)
  }

  async validateFile(file: File): Promise<ApiResponse<{ isValid: boolean; errors?: string[] }>> {
    const formData = new FormData()
    formData.append('file', file)

    return this.request('POST', '/files/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  // Analysis endpoints
  async startAnalysis(projectId: string, parameters: AnalysisParameters, fileIds?: string[]): Promise<ApiResponse<AnalysisJob>> {
    return this.request('POST', '/analysis/start', {
      projectId,
      parameters,
      fileIds,
    })
  }

  async getAnalysis(id: string): Promise<ApiResponse<AnalysisJob>> {
    return this.request('GET', `/analysis/${id}`)
  }

  async getAnalysisResults(id: string): Promise<ApiResponse<AnalysisResults>> {
    return this.request('GET', `/analysis/${id}/results`)
  }

  async cancelAnalysis(id: string): Promise<ApiResponse> {
    return this.request('POST', `/analysis/${id}/cancel`)
  }

  async getAnalysisLogs(id: string): Promise<ApiResponse<{ logs: string[] }>> {
    return this.request('GET', `/analysis/${id}/logs`)
  }

  async getAnalyses(params?: {
    page?: number
    limit?: number
    projectId?: string
    status?: string
  }): Promise<ApiResponse<PaginatedResponse<AnalysisJob>>> {
    const queryParams = new URLSearchParams(params as any).toString()
    return this.request('GET', `/analysis?${queryParams}`)
  }

  // Results and export endpoints
  async getResults(id: string): Promise<ApiResponse<AnalysisResults>> {
    return this.request('GET', `/results/${id}`)
  }

  async exportResults(id: string, options: ExportOptions): Promise<Blob> {
    const response = await this.client.get(`/results/${id}/export/${options.format}`, {
      params: options,
      responseType: 'blob',
    })
    return response.data
  }

  async shareResults(id: string, emails: string[]): Promise<ApiResponse<{ shareUrl: string }>> {
    return this.request('POST', `/results/${id}/share`, { emails })
  }

  async getVisualizationData(id: string, vizId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/results/${id}/visualizations/${vizId}`)
  }

  // Utility endpoints
  async getSystemStatus(): Promise<ApiResponse<{
    status: string
    version: string
    services: Array<{ name: string; status: string }>
  }>> {
    return this.request('GET', '/system/status')
  }

  async getStatistics(): Promise<ApiResponse<{
    totalUsers: number
    totalProjects: number
    totalAnalyses: number
    totalSequences: number
  }>> {
    return this.request('GET', '/system/statistics')
  }
}

export const apiService = new ApiService()
export default apiService