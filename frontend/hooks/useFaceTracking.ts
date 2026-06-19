'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MotionData } from '@/lib/types'

// MediaPipe Face Mesh landmarks
const FACEMESH_LANDMARKS = {
  // Eye landmarks
  LEFT_EYE: [33, 133, 160, 159, 158, 157, 173, 246],
  RIGHT_EYE: [362, 263, 387, 386, 385, 384, 398, 466],
  LEFT_IRIS: [468, 469, 470, 471, 472],
  RIGHT_IRIS: [473, 474, 475, 476, 477],
  
  // Mouth landmarks
  MOUTH_OUTER: [61, 291, 62, 263, 267, 269, 268, 271],
  MOUTH_INNER: [13, 14, 17, 84, 85, 86, 315, 316, 317, 318, 191, 81],
  
  // Face contour
  FACE_OVAL: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  
  // Eyebrows
  LEFT_BROW: [336, 296, 334, 293, 300],
  RIGHT_BROW: [107, 66, 105, 63, 70],
  
  // Nose
  NOSE: [1, 2, 98, 327, 4, 168, 195, 5]
}

interface UseFaceTrackingOptions {
  videoElement?: HTMLVideoElement | null
  onMotionData?: (motion: MotionData) => void
  enabled?: boolean
  smoothingFactor?: number
}

interface UseFaceTrackingReturn {
  isTracking: boolean
  error: string | null
  motionData: MotionData
  startTracking: () => Promise<void>
  stopTracking: () => void
}

export function useFaceTracking({
  videoElement,
  onMotionData,
  enabled = true,
  smoothingFactor = 0.3,
}: UseFaceTrackingOptions = {}): UseFaceTrackingReturn {
  const [isTracking, setIsTracking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [motionData, setMotionData] = useState<MotionData>({
    pitch: 0.5,
    yaw: 0.5,
    roll: 0,
    eye_blink_left: 1,
    eye_blink_right: 1,
    eye_look_x: 0.5,
    eye_look_y: 0.5,
    mouth_open: 0,
    mouth_smile: 0,
    expression_happy: 0,
    timestamp: Date.now(),
  })

  const faceMeshRef = useRef<any>(null)
  const lastMotionRef = useRef<MotionData>(motionData)
  const animationFrameRef = useRef<number>(0)

  const calculateBlink = useCallback((landmarks: any, imageWidth: number, imageHeight: number): { left: number; right: number } => {
    // Eye aspect ratio for blink detection
    const leftEyeIndices = FACEMESH_LANDMARKS.LEFT_EYE
    const rightEyeIndices = FACEMESH_LANDMARKS.RIGHT_EYE
    
    // Get eye landmarks
    const leftEye = leftEyeIndices.map((i: number) => landmarks[i])
    const rightEye = rightEyeIndices.map((i: number) => landmarks[i])
    
    // Calculate eye aspect ratio (EAR)
    const calcEAR = (eye: any[]) => {
      // Vertical distances
      const v1 = Math.sqrt(
        Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2)
      )
      const v2 = Math.sqrt(
        Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2)
      )
      // Horizontal distance
      const h = Math.sqrt(
        Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2)
      )
      return (v1 + v2) / (2 * h)
    }
    
    const leftEAR = calcEAR(leftEye)
    const rightEAR = calcEAR(rightEye)
    
    // Normalize to 0-1 range (1 = open, 0 = closed)
    const EAR_OPEN = 0.35
    const EAR_CLOSED = 0.15
    
    return {
      left: Math.max(0, Math.min(1, (leftEAR - EAR_CLOSED) / (EAR_OPEN - EAR_CLOSED))),
      right: Math.max(0, Math.min(1, (rightEAR - EAR_CLOSED) / (EAR_OPEN - EAR_CLOSED))),
    }
  }, [])

  const calculateMouthOpen = useCallback((landmarks: any): number => {
    const mouth = FACEMESH_LANDMARKS.MOUTH_INNER
    const upperLip = landmarks[mouth[2]] // Upper inner lip
    const lowerLip = landmarks[mouth[8]] // Lower inner lip
    
    const verticalDist = Math.abs(upperLip.y - lowerLip.y)
    
    // Normalize (0-0.15 = closed, 0.15+ = open)
    return Math.max(0, Math.min(1, (verticalDist - 0.02) / 0.08))
  }, [])

  const calculateSmile = useCallback((landmarks: any): number => {
    const mouth = FACEMESH_LANDMARKS.MOUTH_OUTER
    const leftCorner = landmarks[mouth[0]]
    const rightCorner = landmarks[mouth[3]]
    
    const horizontalDist = Math.abs(rightCorner.x - leftCorner.x)
    
    // Normalize smile intensity
    return Math.max(0, Math.min(1, (horizontalDist - 0.2) / 0.15))
  }, [])

  const calculateEyeGaze = useCallback((landmarks: any): { x: number; y: number } => {
    // Use iris position relative to eye center
    const leftIris = FACEMESH_LANDMARKS.LEFT_IRIS
    const rightIris = FACEMESH_LANDMARKS.RIGHT_IRIS
    
    const leftIrisCenter = {
      x: (landmarks[leftIris[0]].x + landmarks[leftIris[1]].x + 
          landmarks[leftIris[2]].x + landmarks[leftIris[3]].x + 
          landmarks[leftIris[4]].x) / 5,
      y: (landmarks[leftIris[0]].y + landmarks[leftIris[1]].y + 
          landmarks[leftIris[2]].y + landmarks[leftIris[3]].y + 
          landmarks[leftIris[4]].y) / 5,
    }
    
    const leftEyeCenter = {
      x: (landmarks[FACEMESH_LANDMARKS.LEFT_EYE[0]].x + 
          landmarks[FACEMESH_LANDMARKS.LEFT_EYE[3]].x) / 2,
      y: (landmarks[FACEMESH_LANDMARKS.LEFT_EYE[1]].y + 
          landmarks[FACEMESH_LANDMARKS.LEFT_EYE[5]].y) / 2,
    }
    
    // Normalize relative position
    const offsetX = (leftIrisCenter.x - leftEyeCenter.x) * 5
    const offsetY = (leftIrisCenter.y - leftEyeCenter.y) * 5
    
    return {
      x: Math.max(0, Math.min(1, 0.5 + offsetX)),
      y: Math.max(0, Math.min(1, 0.5 - offsetY)),
    }
  }, [])

  const calculateHeadPose = useCallback((landmarks: any, imageWidth: number, imageHeight: number): { pitch: number; yaw: number; roll: number } => {
    // Simplified head pose estimation using face landmarks
    
    // Nose tip and chin for pitch/yaw estimation
    const noseTip = landmarks[1]
    const chin = landmarks[152]
    const leftCheek = landmarks[234]
    const rightCheek = landmarks[454]
    
    // Calculate center of face
    const faceCenterX = (leftCheek.x + rightCheek.x) / 2
    const faceCenterY = (leftCheek.y + rightCheek.y) / 2
    
    // Yaw (left-right rotation) based on nose position relative to face center
    const yaw = (noseTip.x - faceCenterX) * 3 + 0.5
    
    // Pitch (up-down rotation) based on nose-chin distance relative to face size
    const faceHeight = Math.abs(chin.y - (landmarks[10].y)) * 2
    const pitch = ((noseTip.y - chin.y) / faceHeight) * 2 + 0.5
    
    // Roll based on eye line angle
    const leftEye = landmarks[33]
    const rightEye = landmarks[263]
    const eyeAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x)
    const roll = eyeAngle * 2
    
    return {
      pitch: Math.max(0, Math.min(1, pitch)),
      yaw: Math.max(0, Math.min(1, yaw)),
      roll: Math.max(-0.5, Math.min(0.5, roll)),
    }
  }, [])

  const smoothMotion = useCallback((newMotion: MotionData, lastMotion: MotionData): MotionData => {
    return {
      ...newMotion,
      pitch: lastMotion.pitch * smoothingFactor + newMotion.pitch * (1 - smoothingFactor),
      yaw: lastMotion.yaw * smoothingFactor + newMotion.yaw * (1 - smoothingFactor),
      roll: lastMotion.roll * smoothingFactor + newMotion.roll * (1 - smoothingFactor),
      eye_blink_left: lastMotion.eye_blink_left * smoothingFactor + newMotion.eye_blink_left * (1 - smoothingFactor),
      eye_blink_right: lastMotion.eye_blink_right * smoothingFactor + newMotion.eye_blink_right * (1 - smoothingFactor),
      eye_look_x: lastMotion.eye_look_x * smoothingFactor + newMotion.eye_look_x * (1 - smoothingFactor),
      eye_look_y: lastMotion.eye_look_y * smoothingFactor + newMotion.eye_look_y * (1 - smoothingFactor),
      mouth_open: lastMotion.mouth_open * smoothingFactor + newMotion.mouth_open * (1 - smoothingFactor),
      mouth_smile: lastMotion.mouth_smile * smoothingFactor + newMotion.mouth_smile * (1 - smoothingFactor),
    }
  }, [smoothingFactor])

  const onResults = useCallback((results: any) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      // No face detected - use default/neutral values
      return
    }

    const landmarks = results.multiFaceLandmarks[0]
    const imageWidth = results.imageWidth || 640
    const imageHeight = results.imageHeight || 480

    // Calculate all motion parameters
    const blink = calculateBlink(landmarks, imageWidth, imageHeight)
    const mouthOpen = calculateMouthOpen(landmarks)
    const smile = calculateSmile(landmarks)
    const eyeGaze = calculateEyeGaze(landmarks)
    const headPose = calculateHeadPose(landmarks, imageWidth, imageHeight)

    // Build new motion data
    const newMotion: MotionData = {
      pitch: headPose.pitch,
      yaw: headPose.yaw,
      roll: headPose.roll,
      eye_blink_left: blink.left,
      eye_blink_right: blink.right,
      eye_look_x: eyeGaze.x,
      eye_look_y: eyeGaze.y,
      mouth_open: mouthOpen,
      mouth_smile: smile,
      expression_happy: smile * 0.8, // Smile correlates with happy expression
      timestamp: Date.now(),
    }

    // Apply smoothing
    const smoothedMotion = smoothMotion(newMotion, lastMotionRef.current)
    lastMotionRef.current = smoothedMotion

    // Update state
    setMotionData(smoothedMotion)
    
    // Call callback if provided
    onMotionData?.(smoothedMotion)
  }, [calculateBlink, calculateMouthOpen, calculateSmile, calculateEyeGaze, calculateHeadPose, smoothMotion, onMotionData])

  const startTracking = useCallback(async () => {
    if (!enabled || !videoElement) return

    try {
      // Dynamically import MediaPipe
      const { FaceMesh } = await import('@mediapipe/face_mesh')
      
      // Create face mesh detector
      faceMeshRef.current = new FaceMesh({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        }
      })

      faceMeshRef.current.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      faceMeshRef.current.onResults(onResults)

      // Start processing video frames
      const processFrame = async () => {
        if (!enabled || !videoElement || videoElement.readyState >= 2) {
          if (videoElement && faceMeshRef.current) {
            await faceMeshRef.current.send({ image: videoElement })
          }
        }
        animationFrameRef.current = requestAnimationFrame(processFrame)
      }

      setIsTracking(true)
      setError(null)
      processFrame()

    } catch (err) {
      console.error('Failed to start face tracking:', err)
      setError('Failed to initialize face tracking')
      setIsTracking(false)
    }
  }, [enabled, videoElement, onResults])

  const stopTracking = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (faceMeshRef.current) {
      faceMeshRef.current.close()
      faceMeshRef.current = null
    }
    setIsTracking(false)
  }, [])

  useEffect(() => {
    if (enabled && videoElement) {
      startTracking()
    } else {
      stopTracking()
    }

    return () => {
      stopTracking()
    }
  }, [enabled, videoElement, startTracking, stopTracking])

  return {
    isTracking,
    error,
    motionData,
    startTracking,
    stopTracking,
  }
}
