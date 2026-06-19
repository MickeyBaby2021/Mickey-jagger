'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface PhoneFrameProps {
  children: ReactNode
  width?: number
  height?: number
  animated?: boolean
}

export function PhoneFrame({ children, width = 390, height = 844, animated = true }: PhoneFrameProps) {
  return (
    <motion.div
      initial={animated ? { opacity: 0, scale: 0.9 } : false}
      animate={animated ? { opacity: 1, scale: 1 } : false}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="phone-frame"
      style={{
        width: width,
        height: height,
        maxWidth: '100vw',
        maxHeight: '100vh',
      }}
    >
      {/* Notch */}
      <div className="phone-notch" />
      
      {/* Screen */}
      <div className="phone-screen">
        {children}
      </div>
      
      {/* Home indicator */}
      <div 
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '134px',
          height: '5px',
          background: '#666',
          borderRadius: '3px',
          zIndex: 101,
        }}
      />
    </motion.div>
  )
}
