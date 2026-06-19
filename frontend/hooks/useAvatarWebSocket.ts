'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { AvatarWebSocket } from '@/lib/api'
import { MotionData, ConnectionStatus } from '@/lib/types'

interface UseAvatarWebSocketOptions {
  sessionId: string | null
  onFrame?: (frame: string, latency: number) => void
  enabled?: boolean
}

interface UseAvatarWebSocketReturn {
  status: ConnectionStatus
  latency: number
  connect: (sessionId: string) => void
  disconnect: () => void
  sendMotion: (motion: Partial<MotionData>) => void
}

export function useAvatarWebSocket({
  sessionId,
  onFrame,
  enabled = true,
}: UseAvatarWebSocketOptions): UseAvatarWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [latency, setLatency] = useState(0)
  const wsRef = useRef<AvatarWebSocket | null>(null)
  const sessionIdRef = useRef(sessionId)

  // Update session ID ref when it changes
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    if (!enabled || !sessionId) {
      if (wsRef.current) {
        wsRef.current.disconnect()
        wsRef.current = null
      }
      return
    }

    // Create WebSocket connection
    const ws = new AvatarWebSocket(sessionId)
    wsRef.current = ws

    // Set up callbacks
    ws.onStatus((newStatus) => {
      setStatus(newStatus)
    })

    ws.onFrame((frame, wsLatency) => {
      setLatency(wsLatency)
      onFrame?.(frame, wsLatency)
    })

    ws.onError((error) => {
      console.error('WebSocket error:', error)
      setStatus('error')
    })

    // Connect
    setStatus('connecting')
    ws.connect(sessionId)

    return () => {
      ws.disconnect()
      wsRef.current = null
    }
  }, [enabled, sessionId, onFrame])

  const connect = useCallback((newSessionId: string) => {
    if (wsRef.current) {
      wsRef.current.disconnect()
    }
    const ws = new AvatarWebSocket(newSessionId)
    wsRef.current = ws
    
    ws.onStatus((newStatus) => {
      setStatus(newStatus)
    })
    ws.onFrame((frame, wsLatency) => {
      setLatency(wsLatency)
      onFrame?.(frame, wsLatency)
    })
    
    setStatus('connecting')
    ws.connect(newSessionId)
  }, [onFrame])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect()
      setStatus('disconnected')
    }
  }, [])

  const sendMotion = useCallback((motion: Partial<MotionData>) => {
    if (wsRef.current?.isConnected()) {
      wsRef.current.sendMotion({
        pitch: motion.pitch,
        yaw: motion.yaw,
        roll: motion.roll,
        eye_blink_left: motion.eye_blink_left,
        eye_blink_right: motion.eye_blink_right,
        mouth_open: motion.mouth_open,
        mouth_smile: motion.mouth_smile,
      })
    }
  }, [])

  return {
    status,
    latency,
    connect,
    disconnect,
    sendMotion,
  }
}
