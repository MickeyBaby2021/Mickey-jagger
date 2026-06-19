// Motion data from face tracking
export interface MotionData {
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
  timestamp: number
}

// WebSocket message types
export interface WSMessage {
  type: 'connected' | 'frame' | 'error' | 'motion'
  frame?: string
  latency_ms?: number
  timestamp?: number
  message?: string
  client_id?: string
  engine?: string
}

// Connection status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// Avatar state
export interface AvatarState {
  portraitLoaded: boolean
  portraitUrl: string | null
  animatedFrame: string | null
  isAnimating: boolean
}

// Camera/Mic state
export interface MediaState {
  cameraEnabled: boolean
  micEnabled: boolean
  screenSharing: boolean
  cameraId: string | null
  micId: string | null
}

// App settings
export interface AppSettings {
  renderQuality: 'low' | 'medium' | 'high'
  motionSensitivity: number
  backgroundMode: 'none' | 'blur' | 'virtual'
  language: string
  obsMode: boolean
}

// Call state
export interface CallState {
  isInCall: boolean
  callStartTime: number | null
  connectionStatus: ConnectionStatus
  latency: number
}

// Device info
export interface DeviceInfo {
  deviceId: string
  label: string
  kind: 'videoinput' | 'audioinput' | 'audiooutput'
}

// API response types
export interface SessionResponse {
  session_id: string
  portrait_loaded: boolean
  image_size: [number, number]
  engine: string
}

export interface AnimationResponse {
  success: boolean
  frame: string | null
  latency_ms: number
  timestamp: string
  frame_count: number
}

export interface HealthResponse {
  status: string
  models_loaded: boolean
  engine: string
  active_sessions: number
}
