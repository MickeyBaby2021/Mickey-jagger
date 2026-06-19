'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { AvatarWebSocket } from '@/lib/api'
import { MotionData, ConnectionStatus } from '@/lib/types'

interface UseAvatarWebSocketOptions {
  clientId?: string
  onFrame?: (frame: string, latency: number) => void
  enabled?: boolean
}

interface UseAvatarWebSocketReturn {
  status: ConnectionStatus
  latency: number
  connect: () => void
  disconnect: () => void
  sendMotion: (motion: MotionData) => void
}

export function useAvatarWebSocket({
  clientId,
  onFrame,
  enabled = true,
}: UseAvatarWebSocketOptions = {}): UseAvatarWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [latency, setLatency] = useState(0)
  const wsRef = useRef<AvatarWebSocket | null>(null)
  const clientIdRef = useRef(clientId || `client_${Date.now()}`)

  useEffect(() => {
    if (!enabled) {
      if (wsRef.current) {
        wsRef.current.disconnect()
        wsRef.current = null
      }
      return
    }

    // Create WebSocket connection
    const ws = new AvatarWebSocket(clientIdRef.current)
    wsRef.current = ws

    // Set up callbacks
    ws.onStatus((newStatus) => {
      switch (newStatus) {
        case 'connected':
          setStatus('connected')
          break
        case 'disconnected':
          setStatus('disconnected')
          break
        case 'error':
          setStatus('error')
          break
      }
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
    ws.connect()

    return () => {
      ws.disconnect()
      wsRef.current = null
    }
  }, [enabled, onFrame])

  const connect = useCallback(() => {
    if (wsRef.current && status === 'disconnected') {
      setStatus('connecting')
      wsRef.current.connect()
    }
  }, [status])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect()
      setStatus('disconnected')
    }
  }, [])

  const sendMotion = useCallback((motion: MotionData) => {
    if (wsRef.current?.isConnected()) {
      wsRef.current.sendMotion({
        pitch: motion.pitch,
        yaw: motion.yaw,
        roll: motion.roll,
        eye_blink_left: motion.eye_blink_left,
        eye_blink_right: motion.eye_blink_right,
        eye_look_x: motion.eye_look_x,
        eye_look_y: motion.eye_look_y,
        mouth_open: motion.mouth_open,
        mouth_smile: motion.mouth_smile,
        expression_happy: motion.expression_happy,
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
