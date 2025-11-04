import { io, Socket } from 'socket.io-client'
import { WebSocketMessage, WebSocketMessageType } from '@/types'

class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private listeners: Map<string, Set<(message: WebSocketMessage) => void>> = new Map()

  connect() {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      console.warn('No access token found, skipping WebSocket connection')
      return
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5000'

    this.socket = io(wsUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    })

    this.setupEventListeners()
  }

  private setupEventListeners() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      if (reason === 'io server disconnect') {
        // The disconnection was initiated by the server, reconnect manually
        this.connect()
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.reconnectAttempts++

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached')
        this.socket?.disconnect()
      }
    })

    this.socket.on('message', (message: WebSocketMessage) => {
      this.handleMessage(message)
    })

    // Specific event listeners
    this.socket.on('analysis_progress', (data) => {
      this.handleMessage({
        type: WebSocketMessageType.ANALYSIS_PROGRESS,
        payload: data,
        timestamp: new Date().toISOString(),
      })
    })

    this.socket.on('analysis_completed', (data) => {
      this.handleMessage({
        type: WebSocketMessageType.ANALYSIS_COMPLETED,
        payload: data,
        timestamp: new Date().toISOString(),
      })
    })

    this.socket.on('analysis_failed', (data) => {
      this.handleMessage({
        type: WebSocketMessageType.ANALYSIS_FAILED,
        payload: data,
        timestamp: new Date().toISOString(),
      })
    })

    this.socket.on('file_upload_progress', (data) => {
      this.handleMessage({
        type: WebSocketMessageType.FILE_UPLOAD_PROGRESS,
        payload: data,
        timestamp: new Date().toISOString(),
      })
    })

    this.socket.on('file_upload_completed', (data) => {
      this.handleMessage({
        type: WebSocketMessageType.FILE_UPLOAD_COMPLETED,
        payload: data,
        timestamp: new Date().toISOString(),
      })
    })

    this.socket.on('file_upload_failed', (data) => {
      this.handleMessage({
        type: WebSocketMessageType.FILE_UPLOAD_FAILED,
        payload: data,
        timestamp: new Date().toISOString(),
      })
    })
  }

  private handleMessage(message: WebSocketMessage) {
    const { type } = message
    const listeners = this.listeners.get(type)

    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(message)
        } catch (error) {
          console.error('Error in WebSocket listener:', error)
        }
      })
    }
  }

  subscribe(messageType: WebSocketMessageType, listener: (message: WebSocketMessage) => void) {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, new Set())
    }

    const listeners = this.listeners.get(messageType)!
    listeners.add(listener)

    // Return unsubscribe function
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.listeners.delete(messageType)
      }
    }
  }

  subscribeToAnalysis(analysisId: string, listener: (message: WebSocketMessage) => void) {
    if (!this.socket) {
      console.warn('WebSocket not connected')
      return () => {}
    }

    // Join analysis room
    this.socket.emit('join_analysis', { analysisId })

    // Subscribe to analysis-related events
    const unsubscribers = [
      this.subscribe(WebSocketMessageType.ANALYSIS_PROGRESS, listener),
      this.subscribe(WebSocketMessageType.ANALYSIS_COMPLETED, listener),
      this.subscribe(WebSocketMessageType.ANALYSIS_FAILED, listener),
    ]

    // Return unsubscribe function
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      this.socket?.emit('leave_analysis', { analysisId })
    }
  }

  subscribeToUpload(uploadId: string, listener: (message: WebSocketMessage) => void) {
    if (!this.socket) {
      console.warn('WebSocket not connected')
      return () => {}
    }

    // Join upload room
    this.socket.emit('join_upload', { uploadId })

    // Subscribe to upload-related events
    const unsubscribers = [
      this.subscribe(WebSocketMessageType.FILE_UPLOAD_PROGRESS, listener),
      this.subscribe(WebSocketMessageType.FILE_UPLOAD_COMPLETED, listener),
      this.subscribe(WebSocketMessageType.FILE_UPLOAD_FAILED, listener),
    ]

    // Return unsubscribe function
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      this.socket?.emit('leave_upload', { uploadId })
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.listeners.clear()
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }

  // Send message to server
  send(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn('WebSocket not connected, cannot send message:', event)
    }
  }
}

export const wsService = new WebSocketService()
export default wsService