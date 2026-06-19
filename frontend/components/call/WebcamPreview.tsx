'use client'

import { motion } from 'framer-motion'

interface WebcamPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isActive: boolean
  isMirrored?: boolean
  showFaceOutline?: boolean
}

export function WebcamPreview({ 
  videoRef, 
  isActive, 
  isMirrored = true,
  showFaceOutline = false 
}: WebcamPreviewProps) {
  if (!isActive) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="video-preview"
        style={{
          width: '120px',
          height: '160px',
          background: '#1a1a2e',
          border: '2px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="text-center">
          <svg 
            width="32" 
            height="32" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#666" 
            strokeWidth="2"
            className="mx-auto mb-2"
          >
            <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
          <p className="text-xs text-gray-500">Camera Off</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="video-preview"
      style={{
        width: '120px',
        height: '160px',
        border: '2px solid #4f46e5',
        boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: isMirrored ? 'scaleX(-1)' : 'none',
        }}
      />
      
      {/* Face outline overlay */}
      {showFaceOutline && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            border: '2px dashed rgba(99, 102, 241, 0.5)',
            borderRadius: '12px',
            margin: '8px',
          }}
        />
      )}
      
      {/* Recording indicator */}
      <div className="absolute top-2 left-2 flex items-center gap-1">
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="w-2 h-2 rounded-full bg-red-500"
        />
      </div>
    </motion.div>
  )
}
