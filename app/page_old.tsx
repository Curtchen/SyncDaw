'use client'

import { useState, useRef, useCallback } from 'react'
import TrackContent from './components/TrackContent'
import Timeline from './components/Timeline'
import CompactTrackControlPanel from './components/CompactTrackControlPanel'
import { useDAW } from './hooks/useDAW'

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
  const pixelsPerSecond = 50 // 每秒50像素
  const timelineHeight = 60
  const menuBarHeight = 48
  const trackControlWidth = 200 // 轨道控制面板宽度
  const trackHeight = 80 // 每个轨道的高度

  const timelineRef = useRef<HTMLDivElement>(null)
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const totalDuration = Math.max(getTotalDuration(), currentTime + 10) // 至少显示当前时间+10秒

  // 处理时间轴点击和拖动
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return
    
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const newTime = (x / rect.width) * totalDuration
    
    if (seekTo) {
      seekTo(Math.max(0, Math.min(newTime, totalDuration)))
    }
  }, [totalDuration, seekTo])

  const handleTimelineMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDraggingTimeline(true)
    handleTimelineClick(e)
  }, [handleTimelineClick])

  const handleTimelineMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingTimeline) {
      handleTimelineClick(e)
    }
  }, [isDraggingTimeline, handleTimelineClick])

  const handleTimelineMouseUp = useCallback(() => {
    setIsDraggingTimeline(false)
  }, [])

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-700 p-4">
        <h1 className="text-2xl font-bold text-white">SyncDAW</h1>
      </header>

      {/* Narrow Menu Bar */}
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
        </div>

        {/* Add Track Button - positioned at the right */}
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
          
          {/* Track Control Panels - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            {tracks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No tracks yet</p>
                <p className="text-xs">Click "Add Track" to get started</p>
              </div>
            ) : (
              <div className="space-y-0">
                {tracks.map((track) => (
                  <div 
                    key={track.id}
                    style={{ height: `${trackHeight}px` }}
                    className="border-b border-gray-700"
                  >
                    <CompactTrackControlPanel
                      track={track}
                      onTrackUpdate={(updates) => updateTrack(track.id, updates)}
                      onStartRecording={startRecording}
                      onStopRecording={stopRecording}
                      onRemoveTrack={removeTrack}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Timeline and Track Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline with Draggable Progress Line */}
          <div 
            className="bg-gray-800 border-b border-gray-700 relative cursor-pointer select-none"
            style={{ height: `${timelineHeight}px` }}
            ref={timelineRef}
            onMouseDown={handleTimelineMouseDown}
            onMouseMove={handleTimelineMouseMove}
            onMouseUp={handleTimelineMouseUp}
            onMouseLeave={handleTimelineMouseUp}
          >
            {/* Timeline Background */}
            <div className="absolute inset-0">
              {/* Time Markers */}
              {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-gray-600"
                  style={{ left: `${(i / totalDuration) * 100}%` }}
                >
                  <div className="absolute top-1 left-1 text-xs text-gray-400">
                    {formatTime(i)}
                  </div>
                </div>
              ))}
            </div>

            {/* Global Red Progress Line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
              style={{ left: `${(currentTime / totalDuration) * 100}%` }}
            >
              {/* Progress Line Handle */}
              <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full pointer-events-auto cursor-grab" />
            </div>

            {/* Time Labels */}
            <div className="absolute bottom-1 left-2 text-xs text-gray-300">
              Current: {formatTime(currentTime)}
            </div>
            <div className="absolute bottom-1 right-2 text-xs text-gray-300">
              Total: {formatTime(totalDuration)}
            </div>
          </div>

          {/* Track Content Area - Scrollable */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {tracks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
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
                    className="border-b border-gray-700 relative"
                  >
                    {/* Track Background with Time Grid */}
                    <div className="absolute inset-0 bg-gray-900">
                      {/* Vertical Grid Lines */}
                      {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-l border-gray-700 opacity-30"
                          style={{ left: `${(i / totalDuration) * 100}%` }}
                        />
                      ))}
                      
                      {/* Global Red Progress Line for this track */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 opacity-80"
                        style={{ left: `${(currentTime / totalDuration) * 100}%` }}
                      />
                    </div>

                    {/* Track Content */}
                    <div className="relative z-10 h-full">
                      <TrackContent
                        track={track}
                        isPlaying={isPlaying}
                        currentTime={currentTime}
                        audioContext={audioContext}
                        masterGain={masterGain}
                        pixelsPerSecond={pixelsPerSecond}
                        totalDuration={totalDuration}
                        onTrackUpdate={(updates) => updateTrack(track.id, updates)}
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
  )
}
