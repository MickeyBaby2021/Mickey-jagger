'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { DeviceInfo } from '@/lib/types'

interface UseWebcamOptions {
  enabled?: boolean
  deviceId?: string | null
  width?: number
  height?: number
  facingMode?: 'user' | 'environment'
}

interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  stream: MediaStream | null
  devices: DeviceInfo[]
  isLoading: boolean
  error: string | null
  startCamera: (deviceId?: string) => Promise<void>
  stopCamera: () => void
  switchCamera: (deviceId: string) => Promise<void>
  refreshDevices: () => Promise<void>
}

export function useWebcam({
  enabled = true,
  deviceId = null,
  width = 640,
  height = 480,
  facingMode = 'user',
}: UseWebcamOptions = {}): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentDeviceRef = useRef<string | null>(deviceId)

  const refreshDevices = useCallback(async () => {
    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      
      const deviceList = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = deviceList
        .filter((device) => device.kind === 'videoinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
          kind: device.kind as 'videoinput',
        }))
      
      setDevices(videoDevices)
    } catch (err) {
      console.error('Failed to enumerate devices:', err)
      setError('Failed to access camera devices')
    }
  }, [])

  const startCamera = useCallback(async (newDeviceId?: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: width },
          height: { ideal: height },
          facingMode: facingMode,
          deviceId: newDeviceId ? { exact: newDeviceId } : undefined,
        },
        audio: false, // Audio handled separately
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)
      currentDeviceRef.current = newDeviceId || deviceId

      // Connect to video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play().catch(() => {
          // Video may already be playing
        })
      }

      // Refresh device list
      await refreshDevices()

      setIsLoading(false)
    } catch (err: any) {
      console.error('Failed to start camera:', err)
      
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permissions.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please connect a camera.')
      } else if (err.name === 'NotReadableError') {
        setError('Camera is already in use by another application.')
      } else {
        setError(`Camera error: ${err.message}`)
      }
      
      setIsLoading(false)
    }
  }, [stream, width, height, facingMode, deviceId, refreshDevices])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    
    currentDeviceRef.current = null
  }, [stream])

  const switchCamera = useCallback(async (newDeviceId: string) => {
    await startCamera(newDeviceId)
  }, [startCamera])

  // Auto-start camera when enabled
  useEffect(() => {
    if (enabled && !stream) {
      refreshDevices().then(() => {
        startCamera(deviceId || undefined)
      })
    } else if (!enabled && stream) {
      stopCamera()
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [enabled, deviceId, stream, refreshDevices, startCamera, stopCamera])

  return {
    videoRef,
    stream,
    devices,
    isLoading,
    error,
    startCamera,
    stopCamera,
    switchCamera,
    refreshDevices,
  }
}
