// API Client for Mickey Jagger Backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'

export { API_BASE_URL, WS_BASE_URL }

// Health check
export async function checkHealth(): Promise<{
  status: string
  engine_ready: boolean
  engine_name: string
  version: string
  active_connections: number
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
  created_at: number
} | null> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch(`${API_BASE_URL}/upload/portrait`, {
      method: 'POST',
      body: formData,
    })
    
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('Portrait upload failed:', error)
    return null
  }
}

// Animate frame
export async function animateFrame(motion: {
  pitch: number
  yaw: number
  roll: number
  eye_blink_left: number
  eye_blink_right: number
  eye_look_x: number
  eye_look_y: number
  mouth_open: number
  mouth_smile: number
  expression_happy: number
  timestamp?: number
}): Promise<{
  success: boolean
  frame: string | null
  latency_ms: number
  timestamp: number
} | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/animate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...motion,
        timestamp: motion.timestamp || Date.now(),
      }),
    })
    
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('Animation failed:', error)
    return null
  }
}

// Get preview
export async function getPreview(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/preview`)
    if (!response.ok) return null
    const data = await response.json()
    return data.frame || null
  } catch (error) {
    console.error('Preview fetch failed:', error)
    return null
  }
}

// WebSocket connection manager
export class AvatarWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private onFrameCallback: ((frame: string, latency: number) => void) | null = null
  private onStatusCallback: ((status: 'connected' | 'disconnected' | 'error') => void) | null = null
  private onErrorCallback: ((error: string) => void) | null = null

  constructor(private clientId: string) {}

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    const wsUrl = `${WS_BASE_URL}/ws/avatar/${this.clientId}`
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
    pitch: number
    yaw: number
    roll: number
    eye_blink_left: number
    eye_blink_right: number
    eye_look_x: number
    eye_look_y: number
    mouth_open: number
    mouth_smile: number
    expression_happy: number
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
      this.connect()
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
