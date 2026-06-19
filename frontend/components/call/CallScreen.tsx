'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PhoneFrame } from '../ui/PhoneFrame'
import { StatusBar } from '../ui/StatusBar'
import { CallControls } from './CallControls'
import { AvatarDisplay } from '../avatar/AvatarDisplay'
import { WebcamPreview } from './WebcamPreview'
import { useFaceTracking } from '@/hooks/useFaceTracking'
import { useAvatarWebSocket } from '@/hooks/useAvatarWebSocket'
import { useWebcam } from '@/hooks/useWebcam'
import { ConnectionStatus, MotionData } from '@/lib/types'
import { uploadPortrait, checkHealth } from '@/lib/api'

interface CallScreenProps {
  onEndCall?: () => void
}

export function CallScreen({ onEndCall }: CallScreenProps) {
  // Media state
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [micEnabled, setMicEnabled] = useState(true)
  const [screenSharing, setScreenSharing] = useState(false)
  const [obsMode, setObsMode] = useState(false)
  
  // Avatar state
  const [avatarFrame, setAvatarFrame] = useState<string | null>(null)
  const [portraitFile, setPortraitFile] = useState<File | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [latency, setLatency] = useState(0)
  const [callDuration, setCallDuration] = useState(0)
  const [callStartTime, setCallStartTime] = useState<number | null>(null)
  
  // UI state
  const [showSettings, setShowSettings] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [backendConnected, setBackendConnected] = useState(false)
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Webcam hook
  const { 
    videoRef, 
    stream, 
    isLoading: webcamLoading,
    error: webcamError,
    startCamera,
    stopCamera 
  } = useWebcam({ enabled: cameraEnabled })
  
  // Face tracking hook
  const { motionData, isTracking, error: trackingError } = useFaceTracking({
    videoElement: videoRef.current,
    enabled: cameraEnabled && !!stream,
    smoothingFactor: 0.3,
  })
  
  // WebSocket hook
  const { status, latency: wsLatency, sendMotion } = useAvatarWebSocket({
    sessionId: sessionId,
    enabled: backendConnected && !!sessionId,
    onFrame: (frame) => {
      setAvatarFrame(frame)
      setIsAnimating(true)
    },
  })
  
  // Update connection status
  useEffect(() => {
    setConnectionStatus(status)
    setLatency(wsLatency)
  }, [status, wsLatency])
  
  // Call duration timer
  useEffect(() => {
    if (callStartTime) {
      const interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [callStartTime])
  
  // Send motion data when tracking updates
  useEffect(() => {
    if (isTracking && connectionStatus === 'connected') {
      sendMotion(motionData)
    }
  }, [motionData, isTracking, connectionStatus, sendMotion])
  
  // Check backend connection on mount
  useEffect(() => {
    checkHealth().then((health) => {
      setBackendConnected(!!health)
    })
  }, [])
  
  // Start call timer when connected
  useEffect(() => {
    if (connectionStatus === 'connected' && !callStartTime) {
      setCallStartTime(Date.now())
    }
  }, [connectionStatus, callStartTime])
  
  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  // Handle portrait upload
  const handlePortraitUpload = async (file: File) => {
    try {
      const result = await uploadPortrait(file)
      if (result?.portrait_loaded) {
        setPortraitFile(file)
        setSessionId(result.session_id)
        setShowUpload(false)
      }
    } catch (error) {
      console.error('Failed to upload portrait:', error)
    }
  }
  
  // Toggle handlers
  const handleCameraToggle = useCallback(() => {
    setCameraEnabled(prev => !prev)
  }, [])
  
  const handleMicToggle = useCallback(() => {
    setMicEnabled(prev => !prev)
    // TODO: Mute audio stream
  }, [])
  
  const handleScreenShare = useCallback(() => {
    setScreenSharing(prev => !prev)
    // TODO: Implement screen sharing
  }, [])
  
  const handleOBSMode = useCallback(() => {
    setObsMode(prev => !prev)
    // TODO: Implement OBS mode
  }, [])
  
  const handleUploadAvatar = useCallback(() => {
    fileInputRef.current?.click()
  }, [])
  
  const handleEndCall = useCallback(() => {
    stopCamera()
    onEndCall?.()
  }, [stopCamera, onEndCall])
  
  // Connection status indicator
  const getConnectionIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return { color: 'bg-green-500', label: 'Connected' }
      case 'connecting':
        return { color: 'bg-yellow-500 animate-pulse', label: 'Connecting...' }
      case 'error':
        return { color: 'bg-red-500', label: 'Error' }
      default:
        return { color: 'bg-gray-500', label: 'Disconnected' }
    }
  }
  
  const indicator = getConnectionIndicator()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      {/* Phone Frame */}
      <PhoneFrame width={390} height={844}>
        <div className="flex flex-col h-full bg-black">
          {/* Status Bar */}
          <StatusBar />
          
          {/* Top Section with AI Status */}
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
              />
              <span className="text-sm font-medium text-gray-300">Mickey Jagger</span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${indicator.color}`} />
                <span className="text-xs text-gray-400">{indicator.label}</span>
              </div>
              
              {/* Latency */}
              {latency > 0 && (
                <span className="text-xs text-gray-500">{latency.toFixed(0)}ms</span>
              )}
            </div>
          </div>
          
          {/* Call Duration */}
          {callStartTime && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <span className="text-3xl font-light text-white tabular-nums">
                {formatDuration(callDuration)}
              </span>
            </motion.div>
          )}
          
          {/* Main Avatar Area */}
          <div className="flex-1 relative">
            <AvatarDisplay
              frameUrl={avatarFrame}
              isAnimating={isAnimating}
              isLoading={!portraitFile}
              onUploadClick={handleUploadAvatar}
            />
            
            {/* Webcam Preview Overlay */}
            <div className="absolute bottom-32 right-4">
              <WebcamPreview
                videoRef={videoRef}
                isActive={cameraEnabled && !!stream}
              />
            </div>
            
            {/* Backend Connection Warning */}
            {!backendConnected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute top-4 left-4 right-4 glass-light rounded-xl p-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="text-amber-400">
                    Backend not connected. Start the server to enable avatar animation.
                  </span>
                </div>
              </motion.div>
            )}
            
            {/* Error Messages */}
            {webcamError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute top-4 left-4 right-4 glass-light rounded-xl p-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span className="text-red-400">{webcamError}</span>
                </div>
              </motion.div>
            )}
          </div>
          
          {/* Call Controls */}
          <CallControls
            cameraEnabled={cameraEnabled}
            micEnabled={micEnabled}
            screenSharing={screenSharing}
            obsMode={obsMode}
            onCameraToggle={handleCameraToggle}
            onMicToggle={handleMicToggle}
            onScreenShare={handleScreenShare}
            onOBSMode={handleOBSMode}
            onSettings={() => setShowSettings(true)}
            onEndCall={handleEndCall}
            onUploadAvatar={handleUploadAvatar}
          />
        </div>
      </PhoneFrame>
      
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handlePortraitUpload(file)
        }}
      />
      
      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-backdrop"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="settings-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Settings</h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-2 rounded-lg hover:bg-gray-700"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                
                {/* Settings options */}
                <div className="space-y-6">
                  {/* Render Quality */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Render Quality
                    </label>
                    <select className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white">
                      <option value="low">Low (Faster)</option>
                      <option value="medium">Medium</option>
                      <option value="high">High (Slower)</option>
                    </select>
                  </div>
                  
                  {/* Motion Sensitivity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Motion Sensitivity
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      defaultValue="50"
                      className="w-full"
                    />
                  </div>
                  
                  {/* Background Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Background Mode
                    </label>
                    <select className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white">
                      <option value="none">None</option>
                      <option value="blur">Blur</option>
                      <option value="virtual">Virtual Background</option>
                    </select>
                  </div>
                  
                  {/* Language */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Language
                    </label>
                    <select className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white">
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="zh">Chinese</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
