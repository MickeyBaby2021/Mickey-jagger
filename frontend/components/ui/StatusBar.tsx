'use client'

import { motion } from 'framer-motion'

interface StatusBarProps {
  time?: string
  signalStrength?: number
  wifiStrength?: number
  batteryLevel?: number
}

export function StatusBar({ 
  time,
  signalStrength = 4,
  wifiStrength = 4,
  batteryLevel = 80
}: StatusBarProps) {
  const currentTime = time || new Date().toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  })

  return (
    <div className="status-bar">
      {/* Left side */}
      <div className="flex items-center gap-1">
        <span>{currentTime}</span>
      </div>
      
      {/* Right side */}
      <div className="status-bar-icons">
        {/* Signal bars */}
        <div className="signal-bars">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className="signal-bar"
              style={{
                opacity: level <= signalStrength ? 1 : 0.3,
                height: `${4 + level * 3}px`,
              }}
            />
          ))}
        </div>
        
        {/* WiFi */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 18c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0-6c3.03 0 5.78 1.23 7.76 3.22l-2.12 2.12C16.2 15.9 14.2 15 12 15s-4.2.9-5.64 2.34l-2.12-2.12C6.22 13.23 8.97 12 12 12zm0-6c4.69 0 8.93 1.9 12 5l-2.12 2.12C19.07 10.35 15.69 9 12 9s-7.07 1.35-9.88 3.22l-2.12-2.12C3.07 7.9 7.31 6 12 6z"/>
        </svg>
        
        {/* Battery */}
        <div className="flex items-center">
          <span className="text-xs mr-1">{batteryLevel}%</span>
          <div className="relative" style={{ width: '24px', height: '12px' }}>
            <div 
              className="absolute inset-0 rounded-sm"
              style={{ 
                background: '#444',
                border: '1px solid #666',
              }}
            />
            <div 
              className="absolute rounded-sm"
              style={{
                top: '1px',
                left: '1px',
                width: `${(batteryLevel / 100) * 20}px`,
                height: '8px',
                background: batteryLevel > 20 ? '#22c55e' : '#ef4444',
              }}
            />
            <div 
              className="absolute"
              style={{
                right: '-3px',
                top: '3px',
                width: '2px',
                height: '6px',
                background: '#666',
                borderRadius: '0 1px 1px 0',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
