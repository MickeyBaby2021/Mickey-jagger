// API Client for Mickey Jagger Backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'

export { API_BASE_URL, WS_BASE_URL }

// Health check
export async function checkHealth(): Promise<{
  status: string
  models_loaded: boolean
  engine: string
  active_sessions: number
} | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`)
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('Health check failed:', error)
    return null
  }
}

// Upload portrait
export async function uploadPortrait(file: File): Promise<{
  session_id: string
  portrait_loaded: boolean
  image_size: [number, number]
  engine: string
} | null> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch(`${API_BASE_URL}/upload/portrait`, {
      method: 'POST',
      body: formData,
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Upload failed')
    }
    return await response.json()
  } catch (error) {
    console.error('Portrait upload failed:', error)
    return null
  }
}

// Animate frame with session_id as query param
export async function animateFrame(
  sessionId: string,
  motion: {
    pitch?: number
    yaw?: number
    roll?: number
    eye_blink_left?: number
    eye_blink_right?: number
    mouth_open?: number
    mouth_smile?: number
  }
): Promise<{
  success: boolean
  frame: string | null
  latency_ms: number
  timestamp: string
  frame_count: number
} | null> {
  try {
    // Build query params
    const params = new URLSearchParams()
    params.append('session_id', sessionId)
    if (motion.pitch !== undefined) params.append('pitch', motion.pitch.toString())
    if (motion.yaw !== undefined) params.append('yaw', motion.yaw.toString())
    if (motion.roll !== undefined) params.append('roll', motion.roll.toString())
    if (motion.eye_blink_left !== undefined) params.append('eye_blink_left', motion.eye_blink_left.toString())
    if (motion.eye_blink_right !== undefined) params.append('eye_blink_right', motion.eye_blink_right.toString())
    if (motion.mouth_open !== undefined) params.append('mouth_open', motion.mouth_open.toString())
    if (motion.mouth_smile !== undefined) params.append('mouth_smile', motion.mouth_smile.toString())

    const response = await fetch(`${API_BASE_URL}/animate?${params.toString()}`, {
      method: 'POST',
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Animation failed')
    }
    return await response.json()
  } catch (error) {
    console.error('Animation failed:', error)
    return null
  }
}

// WebSocket connection manager
export class AvatarWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private sessionId: string | null = null
  private onFrameCallback: ((frame: string, latency: number) => void) | null = null
  private onStatusCallback: ((status: 'connected' | 'disconnected' | 'error') => void) | null = null
  private onErrorCallback: ((error: string) => void) | null = null

  constructor(private clientId: string) {}

  connect(sessionId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return
    
    this.sessionId = sessionId

    const wsUrl = `${WS_BASE_URL}/ws/avatar/${sessionId}`
    console.log('Connecting to WebSocket:', wsUrl)
    
    this.ws = new WebSocket(wsUrl)
    
    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      this.onStatusCallback?.('connected')
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'frame' && data.frame) {
          this.onFrameCallback?.(data.frame, data.latency_ms || 0)
        } else if (data.type === 'connected') {
          console.log('WebSocket session started:', data)
        } else if (data.type === 'error') {
          console.error('WebSocket error:', data.message)
          this.onErrorCallback?.(data.message || 'Unknown error')
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    this.ws.onclose = () => {
      console.log('WebSocket disconnected')
      this.onStatusCallback?.('disconnected')
      this.attemptReconnect()
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.onStatusCallback?.('error')
    }
  }

  sendMotion(motion: {
    pitch?: number
    yaw?: number
    roll?: number
    eye_blink_left?: number
    eye_blink_right?: number
    mouth_open?: number
    mouth_smile?: number
  }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...motion,
        timestamp: Date.now(),
      }))
    }
  }

  onFrame(callback: (frame: string, latency: number) => void) {
    this.onFrameCallback = callback
  }

  onStatus(callback: (status: 'connected' | 'disconnected' | 'error') => void) {
    this.onStatusCallback = callback
  }

  onError(callback: (error: string) => void) {
    this.onErrorCallback = callback
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    setTimeout(() => {
      if (this.sessionId) {
        this.connect(this.sessionId)
      }
    }, delay)
  }

  disconnect() {
    this.maxReconnectAttempts = 0 // Prevent auto-reconnect
    this.ws?.close()
    this.ws = null
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
