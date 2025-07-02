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
  const effectiveDuration = Math.max(maxTrackDuration || 0, duration)

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
    // 简单显示秒数，如 1, 2, 3...
    return Math.floor(seconds).toString()
  }

  // Generate time markers - adjust interval based on duration for precise timing
  const markers = []
  const interval = 1 // 每秒一个刻度
  const subMarkers = [] // 子刻度（0.5秒等）
  
  for (let i = 0; i <= effectiveDuration; i += interval) {
    markers.push(i)
  }
  
  // 添加0.5秒的子刻度，让时间轴更精细
  for (let i = 0.5; i <= effectiveDuration; i += 1) {
    subMarkers.push(i)
  }

  return (
    <div className="bg-slate-800 border-b border-slate-600 relative">
      <div 
        ref={timelineRef}
        className="relative cursor-pointer select-none bg-gradient-to-b from-slate-800 to-slate-900"
        style={{ height: '40px' }}
        onClick={handleTimelineClick}
      >
        {/* Background grid */}
        <div className="absolute inset-0 opacity-20">
          {markers.map((time) => (
            <div
              key={`grid-${time}`}
              className="absolute top-0 bottom-0 w-px bg-slate-500"
              style={{ left: `${(time / effectiveDuration) * 100}%` }}
            />
          ))}
        </div>
        
        {/* Sub markers (0.5 second marks) */}
        <div className="absolute inset-0">
          {subMarkers.map((time) => (
            <div
              key={`sub-${time}`}
              className="absolute top-6 w-px h-2 bg-slate-600 opacity-60"
              style={{ left: `${(time / effectiveDuration) * 100}%` }}
            />
          ))}
        </div>

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
              <div className="absolute top-0 w-px h-4 bg-slate-400" />
              <div className="absolute top-5 left-1 text-xs text-slate-300 font-medium whitespace-nowrap">
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
