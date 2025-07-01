'use client'

import { useEffect, useRef, useState } from 'react'
import WaveformTrack from './WaveformTrack'
import { Track } from '../types/track'

interface TrackContentProps {
  track: Track
  trackId: string
  duration: number
  height: number
  isPlaying: boolean
  isRecording: boolean
  currentTime: number
  onTrackUpdate: (updates: Partial<Track>) => void
}

export default function TrackContent({
  track,
  trackId,
  duration,
  height,
  isPlaying,
  isRecording,
  currentTime,
  onTrackUpdate
}: TrackContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  // 监听容器尺寸变化
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  return (
    <div 
      ref={containerRef}
      className="relative bg-slate-900 border-b border-slate-700 overflow-hidden"
      style={{ height: `${height}px` }}
    >
      {/* 波形显示 */}
      <div className="w-full h-full">
        <WaveformTrack
          trackId={trackId}
          isRecording={isRecording}
          isArmed={track.armed}
          currentTime={currentTime}
          duration={duration}
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
