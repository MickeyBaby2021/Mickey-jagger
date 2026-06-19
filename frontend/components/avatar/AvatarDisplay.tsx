'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface AvatarDisplayProps {
  frameUrl: string | null
  isAnimating: boolean
  onUploadClick?: () => void
  isLoading?: boolean
}

export function AvatarDisplay({ 
  frameUrl, 
  isAnimating, 
  onUploadClick,
  isLoading = false 
}: AvatarDisplayProps) {
  const [currentFrame, setCurrentFrame] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (frameUrl && canvasRef.current) {
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            canvas.width = img.width
            canvas.height = img.height
            ctx.drawImage(img, 0, 0)
          }
        }
      }
      // Handle both with and without data URL prefix
      const src = frameUrl.startsWith('data:') ? frameUrl : `data:image/jpeg;base64,${frameUrl}`
      img.src = src
      setCurrentFrame(frameUrl)
    }
  }, [frameUrl])

  // No avatar loaded state
  if (!frameUrl && !isLoading) {
    return (
      <div className="avatar-container flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-8"
        >
          {/* Upload icon */}
          <div className="mb-6">
            <svg 
              width="80" 
              height="80" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5"
              className="mx-auto text-gray-500"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" />
            </svg>
          </div>
          
          <h3 className="text-xl font-semibold text-gray-300 mb-2">
            No Avatar Selected
          </h3>
          
          <p className="text-gray-500 mb-6 max-w-xs mx-auto">
            Upload a portrait image to create your AI avatar
          </p>
          
          {onUploadClick && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onUploadClick}
              className="px-8 py-3 rounded-full font-medium text-white"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              }}
            >
              Upload Portrait
            </motion.button>
          )}
        </motion.div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="avatar-container flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="loading-spinner mb-4"
          style={{ width: 60, height: 60 }}
        />
        <p className="text-gray-400">Loading avatar...</p>
      </div>
    )
  }

  // Avatar display with canvas
  return (
    <div className="avatar-container relative">
      <canvas 
        ref={canvasRef}
        className="w-full h-full"
        style={{ 
          objectFit: 'cover',
          transform: 'scaleX(-1)',
        }}
      />
      
      {/* Animating indicator */}
      {isAnimating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-4 right-4 glass-light rounded-full px-3 py-1 flex items-center gap-2"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-green-500"
          />
          <span className="text-xs text-gray-300">LIVE</span>
        </motion.div>
      )}
    </div>
  )
}
