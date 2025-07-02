'use client'

import { useEffect, useRef, useState } from 'react'
import WaveformTrack from './WaveformTrack'
import { Track } from '../types/track'
import { useClips } from '../state/clips'

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
  shouldClearWaveformData?: boolean
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
  onTimeChange,
  shouldClearWaveformData = false
}: TrackContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  // Drag to scrub playhead
  const draggingRef = useRef(false)

  const clipsStore = useClips()
  const trackClips = clipsStore.getClipsByTrack(trackId)

  // Drag / resize refs
  const dragClipIdRef = useRef<string | null>(null)
  const resizeModeRef = useRef<'none' | 'left' | 'right'>('none')

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

  const handleMouseDownClip = (e: React.MouseEvent, clipId: string, mode: 'body' | 'left' | 'right') => {
    e.stopPropagation()
    dragClipIdRef.current = clipId
    resizeModeRef.current = mode === 'body' ? 'none' : mode
    document.addEventListener('mousemove', handleMouseMoveClip)
    document.addEventListener('mouseup', handleMouseUpClip)
  }

  const handleMouseMoveClip = (e: MouseEvent) => {
    if (!containerRef.current || !dragClipIdRef.current) return

    const clip = clipsStore.clips.find(c => c.id === dragClipIdRef.current)
    if (!clip) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    const time = viewportStart + percentage * viewportDuration

    if (resizeModeRef.current === 'none') {
      // move clip keeping relative offset
      const offset = clip.duration / 2
      const newStart = Math.max(0, time - offset)
      clipsStore.updateClip(clip.id, { start: newStart })
    } else if (resizeModeRef.current === 'left') {
      const newStart = Math.min(time, clip.start + clip.duration - 0.1)
      const newDuration = clip.duration + (clip.start - newStart)
      clipsStore.updateClip(clip.id, { start: newStart, duration: newDuration })
    } else if (resizeModeRef.current === 'right') {
      const newDuration = Math.max(0.1, time - clip.start)
      clipsStore.updateClip(clip.id, { duration: newDuration })
    }
  }

  const handleMouseUpClip = () => {
    dragClipIdRef.current = null
    resizeModeRef.current = 'none'
    document.removeEventListener('mousemove', handleMouseMoveClip)
    document.removeEventListener('mouseup', handleMouseUpClip)
  }

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
          shouldClearData={shouldClearWaveformData}
        />
      </div>
      
      {/* 录音状态指示器 */}
      {isRecording && track.armed && (
        <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold animate-pulse">
          ● REC
        </div>
      )}

      {/* Clips overlay */}
      {trackClips.map((clip) => {
        const leftPercent = ((clip.start - viewportStart) / viewportDuration) * 100
        const widthPercent = (clip.duration / viewportDuration) * 100
        return (
          <div
            key={clip.id}
            className="absolute top-0 h-full bg-blue-600 bg-opacity-40 border border-blue-400 cursor-pointer clip-item"
            style={{
              left: `${leftPercent}%`,
              width: `${widthPercent}%`
            }}
            onMouseDown={(e) => handleMouseDownClip(e, clip.id, 'body')}
          >
            {/* Resize handles */}
            <div
              className="absolute left-0 top-0 w-1 h-full bg-blue-300 cursor-ew-resize"
              onMouseDown={(e) => handleMouseDownClip(e, clip.id, 'left')}
            />
            <div
              className="absolute right-0 top-0 w-1 h-full bg-blue-300 cursor-ew-resize"
              onMouseDown={(e) => handleMouseDownClip(e, clip.id, 'right')}
            />
          </div>
        )
      })}
    </div>
  )
}
