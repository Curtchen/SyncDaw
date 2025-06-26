'use client'

import { useState } from 'react'
import TrackView from './components/TrackView'
import Timeline from './components/Timeline'
import TrackControlPanel from './components/TrackControlPanel'
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
    masterGain
  } = useDAW()

  // DAW 配置
  const pixelsPerSecond = 50 // 每秒50像素
  const timelineHeight = 40
  const menuBarHeight = 48
  const trackControlWidth = 240 // 轨道控制面板宽度

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const totalDuration = Math.max(getTotalDuration(), currentTime + 10) // 至少显示当前时间+10秒

  return (
    <div className="min-h-screen bg-black text-white">
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
            {formatTime(currentTime)}
          </div>

          {/* Recording Status */}
          {isRecording && (
            <div className="flex items-center space-x-2 text-red-400">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm">REC</span>
            </div>
          )}

          {/* Status */}
          <div className="text-xs text-gray-400">
            {isInitialized ? 'Ready' : 'Initializing...'}
          </div>
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

      {/* Main Content */}
      <div className="flex" style={{ height: `calc(100vh - 80px - ${menuBarHeight}px)` }}>
        {/* Track Controls Column */}
        <div 
          className="bg-gray-900 border-r border-gray-700 overflow-y-auto"
          style={{ width: `${trackControlWidth}px` }}
        >
          {/* Timeline spacer */}
          <div 
            className="bg-gray-800 border-b border-gray-700 flex items-center justify-center"
            style={{ height: `${timelineHeight}px` }}
          >
            <span className="text-xs text-gray-400">Controls</span>
          </div>
          
          {/* Track Control Panels */}
          <div className="p-2">
            {tracks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No tracks yet</p>
                <p className="text-xs">Click "Add Track" to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tracks.map((track) => (
                  <TrackControlPanel
                    key={track.id}
                    track={track}
                    onTrackUpdate={(updates) => updateTrack(track.id, updates)}
                    onStartRecording={startRecording}
                    onStopRecording={stopRecording}
                    onRemoveTrack={removeTrack}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Timeline and Tracks Area */}
        <div className="flex-1 overflow-hidden">
          {/* Timeline */}
          <div className="bg-gray-800 border-b border-gray-700" style={{ height: `${timelineHeight}px` }}>
            <Timeline
              currentTime={currentTime}
              duration={totalDuration}
              pixelsPerSecond={pixelsPerSecond}
              isPlaying={isPlaying}
            />
          </div>

          {/* Tracks Area */}
          <div className="flex-1 overflow-y-auto overflow-x-auto" style={{ height: `calc(100% - ${timelineHeight}px)` }}>
            <div className="p-2 min-w-full">
              {tracks.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <p className="text-lg">No tracks yet</p>
                  <p className="text-sm">Click "Add Track" to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tracks.map((track) => (
                    <TrackView
                      key={track.id}
                      track={track}
                      isPlaying={isPlaying}
                      currentTime={currentTime}
                      audioContext={audioContext}
                      masterGain={masterGain}
                      pixelsPerSecond={pixelsPerSecond}
                      onTrackUpdate={(updates) => updateTrack(track.id, updates)}
                      onStartRecording={startRecording}
                      onStopRecording={stopRecording}
                      onRemoveTrack={removeTrack}
                    />
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
