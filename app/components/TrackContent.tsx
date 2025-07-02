'use client'

import { useEffect, useRef, useState } from 'react'
import WaveformTrack from './WaveformTrack'
import { Track } from '../types/track'

interface TrackContentProps {
  track: Track
  trackId: string
  duration: number
  viewportStart?: number
  viewportDuration?: number
  height: number
  isPlaying: boolean
  isRecording: boolean
  currentTime: number
  onTrackUpdate: (updates: Partial<Track>) => void
  onTimeChange: (time: number) => void
}

export default function TrackContent({
  track,
  trackId,
  duration,
  viewportStart = 0,
  viewportDuration = 30,
  height,
  isPlaying,
  isRecording,
  currentTime,
  onTrackUpdate,
  onTimeChange
}: TrackContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  // Drag to scrub playhead
  const draggingRef = useRef(false)

  const posToTime = (clientX: number) => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    return viewportStart + (percentage * viewportDuration)
  }

  // 监听容器尺寸变化
  useEffect(() => {
    if (!containerRef.current) return

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    // Use ResizeObserver for better tracking of size changes (including zoom)
    const resizeObserver = new ResizeObserver(() => {
      updateWidth()
    })

    resizeObserver.observe(containerRef.current)
    updateWidth() // Initial measurement

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div 
      ref={containerRef}
      className="relative bg-slate-900 border-b border-slate-700 overflow-hidden"
      style={{ height: `${height}px` }}
      onMouseDown={(e) => {
        const t = posToTime(e.clientX)
        onTimeChange(t)
        draggingRef.current = true
        e.preventDefault()
        e.stopPropagation()
      }}
      onMouseMove={(e) => {
        if (!draggingRef.current) return
        onTimeChange(posToTime(e.clientX))
        e.preventDefault()
        e.stopPropagation()
      }}
      onMouseUp={(e) => {
        if (draggingRef.current) {
          onTimeChange(posToTime(e.clientX))
          draggingRef.current = false
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    >
      {/* 波形显示 */}
      <div className="w-full h-full">
        <WaveformTrack
          trackId={trackId}
          isRecording={isRecording}
          isArmed={track.armed}
          currentTime={currentTime}
          duration={duration}
          viewportStart={viewportStart}
          viewportDuration={viewportDuration}
          width={containerWidth}
          height={height} // 填满整个轨道高度
        />
      </div>
      
      {/* 录音状态指示器 */}
      {isRecording && track.armed && (
        <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold animate-pulse">
          ● REC
        </div>
      )}
    </div>
  )
}
