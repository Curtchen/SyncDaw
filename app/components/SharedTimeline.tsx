'use client'

import { useRef, useCallback } from 'react'

interface SharedTimelineProps {
  duration: number
  viewportStart?: number
  viewportDuration?: number
  playheadPosition?: number
  currentTime: number
  onTimeChange: (time: number) => void
  onViewportScroll?: (newStart: number) => void
  isLoopEnabled?: boolean
  loopStart?: number
  loopEnd?: number
  onLoopChange?: (start: number, end: number) => void
  trackCount?: number
  isRecording?: boolean
  maxTrackDuration?: number
}

export default function SharedTimeline({ 
  duration, 
  viewportStart = 0,
  viewportDuration = 30,
  playheadPosition,
  currentTime, 
  onTimeChange, 
  onViewportScroll,
  isLoopEnabled = false, 
  loopStart = 0, 
  loopEnd = 16,
  onLoopChange,
  trackCount = 0,
  isRecording = false,
  maxTrackDuration = 0
}: SharedTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)

  // Use viewport duration for timeline calculations
  const effectiveDuration = viewportDuration
  const totalDuration = Math.max(maxTrackDuration || 0, duration)
  const viewportEnd = viewportStart + viewportDuration

  // Drag-to-select state for loop region
  const selectingRef = useRef(false)
  const anchorTimeRef = useRef(0)
  const draggedRef = useRef(false)
  const dragModeRef = useRef<'none' | 'playhead' | 'loopRange' | 'loopLeft' | 'loopRight'>('none')

  const posToTime = useCallback(
    (clientX: number) => {
      if (!timelineRef.current) return 0
      const rect = timelineRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const percentage = Math.max(0, Math.min(1, x / rect.width))
      return viewportStart + (percentage * viewportDuration)
    },
    [viewportStart, viewportDuration]
  )

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (draggedRef.current) {
      // It was a drag selection, ignore click
      draggedRef.current = false
      return
    }
    if (timelineRef.current) {
      const clickTime = posToTime(e.clientX)
      onTimeChange(clickTime)
    }
  }, [posToTime, onTimeChange])

  // Handlers for drag interactions (playhead or loop)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const clickTime = posToTime(e.clientX)

      const rect = timelineRef.current?.getBoundingClientRect()
      const displayPlayheadPos = playheadPosition !== undefined ? playheadPosition : (currentTime - viewportStart)
      const playheadX = (displayPlayheadPos / viewportDuration) * (rect?.width || 1)
      const clickX = e.clientX - (rect?.left || 0)

      // Decide mode
      if (Math.abs(clickX - playheadX) <= 5) {
        // Dragging playhead directly
        dragModeRef.current = 'playhead'
        onTimeChange(clickTime)
      } else if (isLoopEnabled && onLoopChange) {
        // Check if clicking on loop boundaries
        const loopStartX = ((loopStart - viewportStart) / viewportDuration) * (rect?.width || 1)
        const loopEndX = ((loopEnd - viewportStart) / viewportDuration) * (rect?.width || 1)

        const boundaryTolerance = 6
        if (Math.abs(clickX - loopStartX) <= boundaryTolerance) {
          dragModeRef.current = 'loopLeft'
        } else if (Math.abs(clickX - loopEndX) <= boundaryTolerance) {
          dragModeRef.current = 'loopRight'
        } else if (loopEnd - loopStart < 0.11) {
          // Only if no meaningful loop set yet, start creating new range
          dragModeRef.current = 'loopRange'
          selectingRef.current = true
          anchorTimeRef.current = clickTime
        } else {
          // Default: drag playhead anywhere else
          dragModeRef.current = 'playhead'
          onTimeChange(clickTime)
        }
      } else {
        // Default: drag playhead anywhere else
        dragModeRef.current = 'playhead'
        onTimeChange(clickTime)
      }

      draggedRef.current = false
      e.preventDefault()
      e.stopPropagation()
    },
    [currentTime, playheadPosition, viewportStart, viewportDuration, isLoopEnabled, loopStart, loopEnd, onLoopChange, onTimeChange, posToTime]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragModeRef.current === 'playhead') {
        onTimeChange(posToTime(e.clientX))
        draggedRef.current = true
      } else if (dragModeRef.current === 'loopLeft' && onLoopChange) {
        const newStart = Math.min(posToTime(e.clientX), loopEnd - 0.1)
        onLoopChange(newStart, loopEnd)
        draggedRef.current = true
      } else if (dragModeRef.current === 'loopRight' && onLoopChange) {
        const newEnd = Math.max(posToTime(e.clientX), loopStart + 0.1)
        onLoopChange(loopStart, newEnd)
        draggedRef.current = true
      } else if (dragModeRef.current === 'loopRange' && selectingRef.current && onLoopChange) {
        const current = posToTime(e.clientX)
        const start = Math.min(anchorTimeRef.current, current)
        const end = Math.max(anchorTimeRef.current, current)
        onLoopChange(start, Math.max(start + 0.1, end))
        draggedRef.current = true
      }
      e.preventDefault()
      e.stopPropagation()
    },
    [loopStart, loopEnd, onLoopChange, onTimeChange, posToTime]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragModeRef.current === 'playhead') {
        onTimeChange(posToTime(e.clientX))
      } else if (dragModeRef.current === 'loopLeft' || dragModeRef.current === 'loopRight') {
        // Already updated during move; nothing extra
      } else if (dragModeRef.current === 'loopRange' && onLoopChange) {
        selectingRef.current = false
        const endTime = posToTime(e.clientX)
        const start = Math.min(anchorTimeRef.current, endTime)
        const end = Math.max(anchorTimeRef.current, endTime)
        onLoopChange(start, Math.max(start + 0.1, end))
      }
      dragModeRef.current = 'none'
      e.preventDefault()
      e.stopPropagation()
    },
    [loopStart, loopEnd, onLoopChange, onTimeChange, posToTime]
  )

  const formatTime = (seconds: number) => {
    // 简单显示秒数，如 1, 2, 3...
    return Math.floor(seconds).toString()
  }

  // Generate time markers - adjust interval based on duration for precise timing
  const markers = []
  const interval = 1 // 每秒一个刻度
  const subMarkers = [] // 子刻度（0.5秒等）
  
  for (let i = Math.floor(viewportStart); i <= viewportEnd; i += interval) {
    if (i >= viewportStart && i <= viewportEnd) {
      markers.push(i)
    }
  }
  
  // 添加0.5秒的子刻度，让时间轴更精细
  for (let i = Math.floor(viewportStart) + 0.5; i <= viewportEnd; i += 1) {
    if (i >= viewportStart && i <= viewportEnd) {
      subMarkers.push(i)
    }
  }

  return (
    <div className="bg-slate-800 border-b border-slate-600 relative">
      <div 
        ref={timelineRef}
        className="relative cursor-pointer select-none bg-gradient-to-b from-slate-800 to-slate-900"
        style={{ height: '40px' }}
        onClick={handleTimelineClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Background grid */}
        <div className="absolute inset-0 opacity-20">
          {markers.map((time) => (
            <div
              key={`grid-${time}`}
              className="absolute top-0 bottom-0 w-px bg-slate-500"
              style={{ left: `${((time - viewportStart) / viewportDuration) * 100}%` }}
            />
          ))}
        </div>
        
        {/* Sub markers (0.5 second marks) */}
        <div className="absolute inset-0">
          {subMarkers.map((time) => (
            <div
              key={`sub-${time}`}
              className="absolute top-6 w-px h-2 bg-slate-600 opacity-60"
              style={{ left: `${((time - viewportStart) / viewportDuration) * 100}%` }}
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
                left: `${((time - viewportStart) / viewportDuration) * 100}%`,
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

        {/* Loop region - only show if within viewport */}
        {isLoopEnabled && loopEnd > viewportStart && loopStart < viewportEnd && (
          <>
            {/* Loop region background */}
            <div
              className="absolute top-0 bottom-0 bg-yellow-500 bg-opacity-10 border-l-2 border-r-2 border-yellow-500 pointer-events-none"
              style={{
                left: `${Math.max(0, (loopStart - viewportStart) / viewportDuration) * 100}%`,
                width: `${Math.min(100, ((Math.min(loopEnd, viewportEnd) - Math.max(loopStart, viewportStart)) / viewportDuration) * 100)}%`
              }}
            />
            
            {/* Loop start marker */}
            {loopStart >= viewportStart && loopStart <= viewportEnd && (<div
              className="absolute top-0 bottom-0 w-1 bg-yellow-500 pointer-events-none z-20"
              style={{
                left: `${((loopStart - viewportStart) / viewportDuration) * 100}%`
              }}
            >
              <div className="absolute -top-1 left-0 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-yellow-500"></div>
            </div>)}
            
            {/* Loop end marker */}
            {loopEnd >= viewportStart && loopEnd <= viewportEnd && (<div
              className="absolute top-0 bottom-0 w-1 bg-yellow-500 pointer-events-none z-20"
              style={{
                left: `${((loopEnd - viewportStart) / viewportDuration) * 100}%`
              }}
            >
              <div className="absolute -top-1 right-0 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-yellow-500"></div>
            </div>)}
          </>
        )}

        {/* Playhead - extends to cover all tracks */}
        {(() => {
          const displayPosition = playheadPosition !== undefined ? playheadPosition : (currentTime - viewportStart)
          if (displayPosition < 0 || displayPosition > viewportDuration) return null
          
          return (
            <div
              className={`absolute z-30 pointer-events-none ${
                isRecording ? 'w-1 bg-red-600' : 'w-0.5 bg-red-500'
              }`}
              style={{
                left: `${(displayPosition / viewportDuration) * 100}%`,
                top: 0,
                height: trackCount > 0 ? `${40 + trackCount * 108}px` : '40px' // 40px for timeline + 108px per track
              }}
            >
              {/* Playhead triangle */}
              <div className="absolute -top-2 -left-1 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-red-500"></div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
