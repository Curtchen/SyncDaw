'use client'

import { useRef, useCallback } from 'react'

interface SharedTimelineProps {
  duration: number
  currentTime: number
  onTimeChange: (time: number) => void
  isLoopEnabled?: boolean
  loopStart?: number
  loopEnd?: number
  trackCount?: number
  isRecording?: boolean
  maxTrackDuration?: number
}

export default function SharedTimeline({ 
  duration, 
  currentTime, 
  onTimeChange, 
  isLoopEnabled = false, 
  loopStart = 0, 
  loopEnd = 16,
  trackCount = 0,
  isRecording = false,
  maxTrackDuration = 0
}: SharedTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)

  // Use effective duration for timeline calculations
  // If we have recorded tracks, use max track duration + some padding
  // If no recorded tracks yet, use a smaller timeline for better precision during recording
  const hasRecordings = (maxTrackDuration || 0) > 0
  const effectiveDuration = hasRecordings 
    ? Math.max(maxTrackDuration || 0, duration)
    : Math.max(currentTime + 10, 10) // Show at least 10 seconds ahead of current time
  
  // Debug: log values to help troubleshoot
  if (currentTime > 0) {
    console.log(`📍 Timeline: currentTime=${currentTime}, duration=${duration}, maxTrackDuration=${maxTrackDuration}, effectiveDuration=${effectiveDuration}, hasRecordings=${hasRecordings}, playheadPos=${(currentTime / effectiveDuration * 100).toFixed(2)}%`)
  }
  
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = x / rect.width
      const newTime = Math.max(0, Math.min(effectiveDuration, percentage * effectiveDuration))
      onTimeChange(newTime)
    }
  }, [effectiveDuration, onTimeChange])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const milliseconds = Math.floor((seconds % 1) * 1000)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${milliseconds.toString().padStart(3, '0')}`
  }

  // Generate time markers - adjust interval based on duration for precise timing
  const markers = []
  const interval = effectiveDuration <= 10 ? 1 : effectiveDuration <= 30 ? 2 : 5 // More granular for short durations
  for (let i = 0; i <= effectiveDuration; i += interval) {
    markers.push(i)
  }

  return (
    <div className="bg-slate-900 border-b border-slate-700">
      <div 
        ref={timelineRef}
        className="relative cursor-pointer select-none"
        style={{ height: '40px' }}
        onClick={handleTimelineClick}
      >
        {/* Time markers */}
        <div className="absolute inset-0 flex">
          {markers.map((time) => (
            <div
              key={time}
              className="flex-none relative"
              style={{ 
                left: `${(time / effectiveDuration) * 100}%`,
                width: '1px'
              }}
            >
              <div className="absolute top-0 w-px h-full bg-slate-600" />
              <div className="absolute top-1 left-1 text-xs text-slate-400 whitespace-nowrap">
                {formatTime(time)}
              </div>
            </div>
          ))}
        </div>

        {/* Loop region */}
        {isLoopEnabled && (
          <>
            {/* Loop region background */}
            <div
              className="absolute top-0 bottom-0 bg-yellow-500 bg-opacity-10 border-l-2 border-r-2 border-yellow-500 pointer-events-none"
              style={{
                left: `${(loopStart / effectiveDuration) * 100}%`,
                width: `${((loopEnd - loopStart) / effectiveDuration) * 100}%`
              }}
            />
            
            {/* Loop markers */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-yellow-500 pointer-events-none z-20"
              style={{
                left: `${(loopStart / effectiveDuration) * 100}%`
              }}
            >
              <div className="absolute -top-1 left-0 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-yellow-500"></div>
            </div>
            
            <div
              className="absolute top-0 bottom-0 w-1 bg-yellow-500 pointer-events-none z-20"
              style={{
                left: `${(loopEnd / effectiveDuration) * 100}%`
              }}
            >
              <div className="absolute -top-1 right-0 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-yellow-500"></div>
            </div>
          </>
        )}

        {/* Playhead - extends to cover all tracks */}
        <div
          className={`absolute z-30 pointer-events-none ${
            isRecording ? 'w-1 bg-red-600' : 'w-0.5 bg-red-500'
          }`}
          style={{
            left: `${(currentTime / effectiveDuration) * 100}%`,
            top: 0,
            height: trackCount > 0 ? `${40 + trackCount * 108}px` : '40px' // 40px for timeline + 108px per track
          }}
        >
          {/* Playhead triangle */}
          <div className="absolute -top-2 -left-1 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-red-500"></div>
        </div>
      </div>
    </div>
  )
}
