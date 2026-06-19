'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface CallControlButtonProps {
  icon: ReactNode
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
  disabled?: boolean
}

function CallControlButton({ 
  icon, 
  label, 
  onClick, 
  active = false, 
  danger = false,
  disabled = false 
}: CallControlButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`call-control tooltip ${active ? 'active' : ''} ${danger ? 'danger' : ''}`}
      data-tooltip={label}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {icon}
    </motion.button>
  )
}

interface CallControlsProps {
  cameraEnabled: boolean
  micEnabled: boolean
  screenSharing: boolean
  obsMode: boolean
  onCameraToggle: () => void
  onMicToggle: () => void
  onScreenShare: () => void
  onOBSMode: () => void
  onSettings: () => void
  onEndCall: () => void
  onUploadAvatar: () => void
}

export function CallControls({
  cameraEnabled,
  micEnabled,
  screenSharing,
  obsMode,
  onCameraToggle,
  onMicToggle,
  onScreenShare,
  onOBSMode,
  onSettings,
  onEndCall,
  onUploadAvatar,
}: CallControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="glass-light rounded-3xl px-6 py-4 flex items-center justify-between gap-4"
      style={{
        position: 'absolute',
        bottom: '30px',
        left: '20px',
        right: '20px',
      }}
    >
      {/* Left side - Avatar upload */}
      <CallControlButton
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" />
          </svg>
        }
        label="Upload Avatar"
        onClick={onUploadAvatar}
      />

      {/* Center - Main controls */}
      <div className="flex items-center gap-3">
        <CallControlButton
          icon={
            micEnabled ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
                <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )
          }
          label={micEnabled ? 'Mute' : 'Unmute'}
          onClick={onMicToggle}
          active={!micEnabled}
        />

        <CallControlButton
          icon={
            cameraEnabled ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )
          }
          label={cameraEnabled ? 'Stop Camera' : 'Start Camera'}
          onClick={onCameraToggle}
          active={!cameraEnabled}
        />

        <CallControlButton
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          }
          label="Share Screen"
          onClick={onScreenShare}
          active={screenSharing}
        />

        <CallControlButton
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
          label="OBS Mode"
          onClick={onOBSMode}
          active={obsMode}
        />
      </div>

      {/* Right side - Settings and End Call */}
      <div className="flex items-center gap-3">
        <CallControlButton
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          }
          label="Settings"
          onClick={onSettings}
        />

        {/* End Call Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onEndCall}
          className="call-control danger"
          style={{
            width: '64px',
            height: '64px',
            background: '#ef4444',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  )
}
