'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Pause, Square, SkipBack, SkipForward } from 'lucide-react'
import TrackContent from './components/TrackContent'
import CompactTrackControlPanel from './components/CompactTrackControlPanel'
import { useDAW } from './hooks/useDAW'

interface Track {
  id: string
  name: string
  volume: number
  pan: number
  muted: boolean
  solo: boolean
  armed: boolean
  color: string
}

export default function Home() {
  const {
    tracks,
    isPlaying,
    isRecording,
    currentTime,
    masterVolume,
    isInitialized,
    addTrack,
    removeTrack,
    updateTrack,
    play,
    pause,
    stop,
    startRecording,
    stopRecording,
    setMasterVolume,
    getTotalDuration,
    audioContext,
    masterGain,
    seekTo
  } = useDAW()

  // DAW 配置
  const pixelsPerSecond = 100 // 每秒100像素，更高精度
  const timelineHeight = 60
  const menuBarHeight = 48
  const trackControlWidth = 200
  const trackHeight = 80
  const minTimelineWidth = 3000 // 最小时间轴宽度（30秒）

  // 滚动状态
  const [scrollX, setScrollX] = useState(0)
  const timelineRef = useRef<HTMLDivElement>(null)
  const tracksContainerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const totalDuration = Math.max(getTotalDuration(), 30) // 至少30秒
  const timelineWidth = Math.max(totalDuration * pixelsPerSecond, minTimelineWidth)

  // 处理时间轴点击
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return
    
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollX
    const newTime = (x / timelineWidth) * totalDuration
    
    if (seekTo) {
      seekTo(Math.max(0, Math.min(newTime, totalDuration)))
    }
  }, [scrollX, timelineWidth, totalDuration, seekTo])

  // 处理水平滚动
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollX = e.currentTarget.scrollLeft
    setScrollX(newScrollX)
    
    // 同步时间轴滚动
    if (timelineRef.current) {
      timelineRef.current.scrollLeft = newScrollX
    }
  }, [])

  // 自动滚动跟随播放头
  useEffect(() => {
    if (isPlaying && scrollContainerRef.current) {
      const playheadX = (currentTime / totalDuration) * timelineWidth
      const containerWidth = scrollContainerRef.current.clientWidth
      const currentScrollX = scrollContainerRef.current.scrollLeft
      
      // 如果播放头超出可视区域，自动滚动
      if (playheadX < currentScrollX || playheadX > currentScrollX + containerWidth - 100) {
        scrollContainerRef.current.scrollLeft = Math.max(0, playheadX - containerWidth / 2)
      }
    }
  }, [currentTime, isPlaying, timelineWidth, totalDuration])

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-700 p-4">
        <h1 className="text-2xl font-bold text-white">SyncDAW</h1>
      </header>

      {/* Menu Bar */}
      <div 
        className="bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4"
        style={{ height: `${menuBarHeight}px` }}
      >
        <div className="flex items-center space-x-4">
          {/* Transport Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={stop}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              title="Stop"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            </button>
            
            <button
              onClick={isPlaying ? pause : play}
              className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
              disabled={!isInitialized}
            >
              {isPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>
          </div>

          {/* Time Display */}
          <div className="font-mono text-green-400 text-sm">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </div>

          {/* Recording Status */}
          {isRecording && (
            <div className="flex items-center space-x-2 text-red-400">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm">REC</span>
            </div>
          )}

          {/* Initialization Status */}
          <div className="text-xs text-gray-400">
            {isInitialized ? 'Ready' : 'Initializing...'}
          </div>
        </div>

        {/* Add Track Button */}
        <button
          onClick={addTrack}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
          disabled={!isInitialized}
        >
          + Add Track
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex" style={{ height: `calc(100vh - 80px - ${menuBarHeight}px)` }}>
        {/* Left Column: Track Controls */}
        <div 
          className="bg-gray-900 border-r border-gray-700 flex flex-col"
          style={{ width: `${trackControlWidth}px`, minWidth: `${trackControlWidth}px` }}
        >
          {/* Timeline Label Area */}
          <div 
            className="bg-gray-800 border-b border-gray-700 flex items-center justify-center"
            style={{ height: `${timelineHeight}px` }}
          >
            <span className="text-xs text-gray-400 font-semibold">TRACK CONTROLS</span>
          </div>
          
          {/* Track Control Panels */}
          <div className="flex-1 overflow-y-auto">
            {tracks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No tracks yet</p>
                <p className="text-xs">Click "Add Track" to get started</p>
              </div>
            ) : (
              <div>
                {tracks.map((track) => (
                  <div 
                    key={track.id}
                    style={{ height: `${trackHeight}px` }}
                    className="border-b border-gray-700 flex-shrink-0"
                  >
                    <CompactTrackControlPanel
                      track={track}
                      onUpdate={(updates: Partial<Track>) => updateTrack(track.id, updates)}
                      onTrackUpdate={(updates: Partial<Track>) => updateTrack(track.id, updates)}
                      onStartRecording={startRecording}
                      onStopRecording={stopRecording}
                      onRemoveTrack={() => removeTrack(track.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Timeline and Track Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Fixed Timeline */}
          <div 
            className="bg-gray-800 border-b border-gray-700 relative overflow-x-auto overflow-y-hidden"
            style={{ height: `${timelineHeight}px` }}
            ref={timelineRef}
            onScroll={(e) => {
              const newScrollX = e.currentTarget.scrollLeft
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = newScrollX
              }
            }}
          >
            {/* Timeline Content */}
            <div 
              className="relative h-full cursor-pointer"
              style={{ width: `${timelineWidth}px` }}
              onClick={handleTimelineClick}
            >
              {/* Time Markers */}
              {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-gray-600"
                  style={{ left: `${(i / totalDuration) * timelineWidth}px` }}
                >
                  <div className="absolute top-1 left-1 text-xs text-gray-400">
                    {formatTime(i)}
                  </div>
                </div>
              ))}

              {/* Global Red Progress Line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                style={{ left: `${(currentTime / totalDuration) * timelineWidth}px` }}
              >
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full" />
              </div>
            </div>
          </div>

          {/* Scrollable Track Content Area */}
          <div 
            className="flex-1 overflow-auto"
            ref={scrollContainerRef}
            onScroll={handleScroll}
          >
            <div style={{ width: `${timelineWidth}px` }}>
              {tracks.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3-.895 3 2zM9 10l12-3" />
                    </svg>
                    <p className="text-lg">No tracks yet</p>
                    <p className="text-sm">Click "Add Track" to get started</p>
                  </div>
                </div>
              ) : (
                <div>
                  {tracks.map((track) => (
                    <div 
                      key={track.id}
                      style={{ height: `${trackHeight}px` }}
                      className="border-b border-gray-700 relative bg-gray-900"
                    >
                      {/* Vertical Grid Lines */}
                      {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-l border-gray-700 opacity-30"
                          style={{ left: `${(i / totalDuration) * timelineWidth}px` }}
                        />
                      ))}
                      
                      {/* Global Red Progress Line for this track */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 opacity-80"
                        style={{ left: `${(currentTime / totalDuration) * timelineWidth}px` }}
                      />

                      {/* Track Content */}
                      <div className="relative z-10 h-full">
                        <TrackContent
                          track={track}
                          trackId={track.id}
                          isPlaying={isPlaying}
                          currentTime={currentTime}
                          audioContext={audioContext}
                          masterGain={masterGain}
                          pixelsPerSecond={pixelsPerSecond}
                          totalDuration={totalDuration}
                          onTrackUpdate={(updates: Partial<Track>) => updateTrack(track.id, updates)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
