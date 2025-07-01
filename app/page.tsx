'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Play, Pause, Square, SkipBack, SkipForward } from 'lucide-react'
import TrackView from './components/TrackView'
import TrackContent from './components/TrackContent'
import SharedTimeline from './components/SharedTimeline'
import { useAudioEngine } from './hooks/useAudioEngine'
import { Track } from './types/track'
import { useTransport } from './state/transport'

export default function DAWInterface() {
  const { isInitialized, masterVolume, createTrack, getTrack, removeTrack: removeAudioTrack, setMasterVolume } = useAudioEngine()
  
  // Project settings
  const [projectName, setProjectName] = useState('Untitled')
  const [sampleRate, setSampleRate] = useState('44.1')
  
  // Real-time CPU usage
  const [cpuUsage, setCpuUsage] = useState(25)
  
  // Client-side flag
  const [isClient, setIsClient] = useState(false)
  
  const { isPlaying, currentTime, play: transportPlay, pause: transportPause, togglePlay, stop: transportStop, seek: seekTransport } = useTransport()
  const [isRecording, setIsRecording] = useState(false)
  const [isRecordingAutomation, setIsRecordingAutomation] = useState(false)
  const [isLoopEnabled, setIsLoopEnabled] = useState(false)
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false)
  const [isMonitoringEnabled, setIsMonitoringEnabled] = useState(false)
  const [isAutoscrollEnabled, setIsAutoscrollEnabled] = useState(true)
  const [loopStart, setLoopStart] = useState(0)
  const [loopEnd, setLoopEnd] = useState(8)
  const [bpm, setBpm] = useState(120)
  const [timeSignature, setTimeSignature] = useState({ numerator: 4, denominator: 4 })
  const [duration, setDuration] = useState(30) // 30 seconds

  const [tracks, setTracks] = useState<Track[]>([
    {
      id: '1',
      name: 'Track 1',
      type: 'audio',
      volume: 80,
      pan: 0,
      muted: false,
      solo: false,
      armed: true,
      color: '#ff6b35'
    }
  ])

  const timelineRef = useRef<HTMLDivElement>(null)

  // Client-side initialization
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Real-time CPU monitoring
  useEffect(() => {
    if (!isClient) return
    
    const updateCpuUsage = () => {
      // Simulate real CPU usage - in production, you might want to use performance.now()
      // or actual system monitoring if available through APIs
      const baseCpu = 15 + Math.random() * 10 // Base usage 15-25%
      const activityBoost = (isPlaying || isRecording) ? Math.random() * 20 : 0 // 0-20% boost when active
      const trackBoost = tracks.length * 2 // 2% per track
      
      const totalCpu = Math.min(baseCpu + activityBoost + trackBoost, 100)
      setCpuUsage(Math.round(totalCpu))
    }

    updateCpuUsage()
    const interval = setInterval(updateCpuUsage, 2000) // Update every 2 seconds
    
    return () => clearInterval(interval)
  }, [isClient, isPlaying, isRecording, tracks.length])

  // Recording logic unchanged

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      transportPause()
    } else {
      if (currentTime !== 0) {
        transportStop() // resets to 0
      }
      transportPlay()
    }
  }, [isPlaying, currentTime, transportPause, transportPlay, transportStop])

  const handleStop = useCallback(() => {
    transportStop()
    setIsRecording(false)
    setIsRecordingAutomation(false)
    // Stop recording on all tracks
    tracks.forEach(track => {
      if (track.armed) {
        const audioTrack = getTrack(track.id)
        audioTrack?.stopRecording()
      }
    })
    seekTransport(isLoopEnabled ? loopStart : 0)
  }, [tracks, getTrack, isLoopEnabled, loopStart, transportStop, seekTransport])

  const handleRecordAutomation = useCallback(() => {
    setIsRecordingAutomation(!isRecordingAutomation)
  }, [isRecordingAutomation])

  const recordAutoPlayRef = useRef(false)

  const handleRecord = useCallback(async (e?: React.MouseEvent) => {
    // 防止事件冒泡
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    console.log(`🎬 handleRecord called - isInitialized: ${isInitialized}, current isRecording: ${isRecording}`)
    
    // 临时测试：确认按钮点击被检测到
    console.log('🔴 Record button clicked! Time:', new Date().toLocaleTimeString())
    console.log('🔴 Audio engine functions available:', { createTrack: !!createTrack, getTrack: !!getTrack })
    
    if (!isInitialized) {
      console.log(`❌ Audio engine not initialized yet`)
      console.log('⏳ Waiting for audio engine to initialize...')
      return
    }
    
    try {
      console.log(`Armed tracks:`, tracks.filter(t => t.armed).map(t => ({ id: t.id, name: t.name, armed: t.armed })))
      
      if (isRecording) {
        // Stop recording on all armed tracks
        tracks.forEach(track => {
          if (track.armed) {
            const audioTrack = getTrack(track.id)
            audioTrack?.stopRecording()
            console.log(`⏹️ Stopping recording on track ${track.id}`)
          }
        })
        setIsRecording(false)
        console.log(`⏹️ Recording stopped globally`)
        // pause transport to keep currentTime where recording stopped
        transportPause()
      } else {
        // Start recording on all armed tracks
        const armedTracks = tracks.filter(t => t.armed)
        console.log(`🔴 Starting recording on ${armedTracks.length} armed tracks:`, armedTracks.map(t => t.id))
        
        if (armedTracks.length === 0) {
          console.log(`⚠️ No armed tracks found. Please arm at least one track by clicking the red record button on the track.`)
        }
        
        // Start recording on all armed tracks
        tracks.forEach(track => {
          if (track.armed) {
            let audioTrack = getTrack(track.id)
            if (!audioTrack) {
              const newTrack = createTrack(track.id)
              if (newTrack) {
                audioTrack = newTrack
              }
            }
            audioTrack?.startRecording()
            console.log(`🔴 Starting recording on track ${track.id}`)
          }
        })
        
        // start transport to advance timeline during recording
        if (!isPlaying) {
          transportPlay()
        }
        setIsRecording(true)
        console.log(`🔴 Recording started globally`)
      }
    } catch (error) {
      console.error(`❌ Error in handleRecord:`, error)
    }
  }, [isInitialized, isRecording, tracks, getTrack, createTrack])

  const toggleLoop = useCallback(() => {
    setIsLoopEnabled(!isLoopEnabled)
  }, [isLoopEnabled])

  const toggleMetronome = useCallback(() => {
    setIsMetronomeEnabled(!isMetronomeEnabled)
  }, [isMetronomeEnabled])

  const toggleMonitoring = useCallback(() => {
    setIsMonitoringEnabled(!isMonitoringEnabled)
  }, [isMonitoringEnabled])

  const toggleAutoscroll = useCallback(() => {
    setIsAutoscrollEnabled(!isAutoscrollEnabled)
  }, [isAutoscrollEnabled])

  const handleRewind = useCallback(() => {
    seekTransport(Math.max(0, currentTime - 5))
  }, [currentTime, seekTransport])

  const handleFastForward = useCallback(() => {
    seekTransport(Math.min(duration, currentTime + 5))
  }, [currentTime, duration, seekTransport])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isClient) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement) return
      
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          handlePlay()
          break
        case 'KeyR':
          if (e.ctrlKey) {
            e.preventDefault()
            handleRecord()
          }
          break
        case 'KeyL':
          if (e.ctrlKey) {
            e.preventDefault()
            toggleLoop()
          }
          break
        case 'Escape':
          e.preventDefault()
          handleStop()
          break
        case 'Home':
          e.preventDefault()
          seekTransport(isLoopEnabled ? loopStart : 0)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isClient, isLoopEnabled, loopStart, handlePlay, handleRecord, toggleLoop, handleStop])

  const addTrack = useCallback(() => {
    const newTrack: Track = {
      id: (tracks.length + 1).toString(),
      name: `Track ${tracks.length + 1}`,
      type: 'audio',
      volume: 80,
      pan: 0,
      muted: false,
      solo: false,
      armed: false,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`
    }
    setTracks(prev => [...prev, newTrack])
    
    // Create corresponding audio track
    if (isInitialized) {
      createTrack(newTrack.id)
    }
  }, [tracks.length, isInitialized, createTrack])

  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
    console.log(`🔧 updateTrack ${id} with updates:`, updates)
    
    setTracks(prev => prev.map(track => 
      track.id === id ? { ...track, ...updates } : track
    ))
    
    // Update corresponding audio track
    const audioTrack = getTrack(id)
    if (audioTrack) {
      if (updates.volume !== undefined) {
        audioTrack.setVolume(updates.volume)
      }
      if (updates.pan !== undefined) {
        audioTrack.setPan(updates.pan)
      }
      if (updates.muted !== undefined) {
        audioTrack.setMuted(updates.muted)
      }
      if (updates.solo !== undefined) {
        audioTrack.setSolo(updates.solo)
      }
    }
  }, [getTrack])

  const removeTrack = useCallback((id: string) => {
    // 允许删除所有轨道，包括最后一条
    setTracks(prev => prev.filter(track => track.id !== id))
    // Remove corresponding audio track  
    removeAudioTrack(id)
  }, [removeAudioTrack])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 优化轨道组件渲染 - 条件渲染防止hydration错误
  const trackViews = useMemo(() => {
    if (!isClient) return null
    return tracks.map((track) => (
      <TrackView
        key={track.id}
        track={track}
        onUpdate={(updates) => updateTrack(track.id, updates)}
        onRemove={() => removeTrack(track.id)}
      />
    ))
  }, [isClient, tracks, updateTrack, removeTrack])

  const trackContents = useMemo(() => {
    if (!isClient) return null
    
    console.log(`🎭 Rendering track contents:`, tracks.map(t => ({ 
      id: t.id, 
      armed: t.armed, 
      isRecording, 
      isPlaying 
    })))
    
    return tracks.map((track) => (
      <TrackContent
        key={track.id}
        track={track}
        trackId={track.id}
        duration={duration}
        height={108} // 匹配 TrackView 的新高度
        isPlaying={isPlaying}
        isRecording={isRecording}
        currentTime={currentTime}
        onTrackUpdate={(updates) => updateTrack(track.id, updates)}
      />
    ))
  }, [isClient, tracks, duration, isPlaying, isRecording, currentTime, updateTrack])

  // auto pause when end reached is disabled until clip re-enabled
  useEffect(() => {
    if (!isPlaying) return
    if (!isLoopEnabled && currentTime >= duration) {
      transportPause()
    }
  }, [isPlaying, currentTime, duration, isLoopEnabled, transportPause])

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col">
      {/* Audio Activation Banner - 只在客户端且音频引擎未激活时显示 */}
      {isClient && !isInitialized && (
        <div className="bg-orange-600 text-white px-4 py-2 text-center text-sm flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>🔊 Audio Engine Initializing... Click anywhere or press any key to activate audio</span>
          <button 
            onClick={() => window.location.reload()}
            className="ml-2 px-2 py-1 bg-orange-700 hover:bg-orange-800 rounded text-xs"
          >
            Reload
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-white">SyncDAW</h1>
            
            {/* Project Info */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <label className="text-slate-400">Project:</label>
                <input
                  type="text"
                  className="bg-slate-700 text-white px-2 py-0.5 rounded text-sm border-none outline-none focus:bg-slate-600"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project Name"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-400">Sample Rate:</label>
                <select
                  className="bg-slate-700 text-white px-2 py-0.5 rounded text-sm border-none outline-none focus:bg-slate-600 cursor-pointer"
                  value={sampleRate}
                  onChange={(e) => setSampleRate(e.target.value)}
                >
                  <option value="44.1">44.1 kHz</option>
                  <option value="48">48 kHz</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* CPU Usage - Real-time monitoring */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">CPU</span>
              <div className="w-12 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    cpuUsage > 80 ? 'bg-red-500' : 
                    cpuUsage > 60 ? 'bg-yellow-500' : 
                    'bg-green-500'
                  }`}
                  style={{ width: `${cpuUsage}%` }}
                ></div>
              </div>
              <span className="text-slate-300 text-xs">{cpuUsage}%</span>
            </div>

            {/* Add Track button */}
            <button
              onClick={addTrack}
              className="bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded text-sm font-medium text-white transition-colors duration-150"
            >
              + Add Track
            </button>
          </div>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="bg-slate-900 px-4 py-3 shadow-md relative z-20">
        <div className="flex items-center gap-1">
          {/* Transport Buttons */}
          <div className="flex items-center gap-1 mr-6 relative z-30">
            {/* Return to Zero */}
            <button
              onClick={() => seekTransport(isLoopEnabled ? loopStart : 0)}
              className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center text-slate-300 hover:text-white relative z-10 transition-colors duration-150"
              style={{ pointerEvents: 'all' }}
              title="Back to Start"
            >
              <SkipBack className="w-4 h-4 pointer-events-none" />
            </button>
            
            {/* Fast Rewind */}
            <button
              onClick={handleRewind}
              className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center text-slate-300 hover:text-white relative z-10 transition-colors duration-150"
              style={{ pointerEvents: 'all' }}
              title="Fast Rewind"
            >
              <div className="flex pointer-events-none">
                <div className="w-0 h-0 border-t-2 border-b-2 border-r-3 border-transparent border-r-current"></div>
                <div className="w-0 h-0 border-t-2 border-b-2 border-r-3 border-transparent border-r-current ml-0.5"></div>
              </div>
            </button>

            {/* Stop */}
            <button
              onClick={handleStop}
              className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center text-slate-300 hover:text-white relative z-10 transition-colors duration-150"
              style={{ pointerEvents: 'all' }}
              title="Stop"
            >
              <Square className="w-4 h-4 pointer-events-none" fill="currentColor" />
            </button>
            
            {/* Play/Pause (with spacebar shortcut) */}
            <button
              onClick={handlePlay}
              className="w-10 h-8 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center text-white font-bold relative z-10 transition-colors duration-150"
              style={{ pointerEvents: 'all' }}
              title={`${isPlaying ? "Pause" : "Play"} (Spacebar)`}
            >
              {isPlaying ? <Pause className="w-5 h-5 pointer-events-none" fill="currentColor" /> : <Play className="w-5 h-5 ml-0.5 pointer-events-none" fill="currentColor" />}
            </button>

            {/* Fast Forward */}
            <button
              onClick={handleFastForward}
              className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center text-slate-300 hover:text-white relative z-10 transition-colors duration-150"
              style={{ pointerEvents: 'all' }}
              title="Fast Forward"
            >
              <div className="flex pointer-events-none">
                <div className="w-0 h-0 border-t-2 border-b-2 border-l-3 border-transparent border-l-current"></div>
                <div className="w-0 h-0 border-t-2 border-b-2 border-l-3 border-transparent border-l-current ml-0.5"></div>
              </div>
            </button>

            {/* Record */}
            <button
              onClick={handleRecord}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              disabled={!isInitialized}
              className={`w-8 h-8 rounded flex items-center justify-center relative z-10 transition-colors duration-150 ${
                !isInitialized 
                  ? 'bg-slate-600 text-slate-500 cursor-not-allowed' 
                  : isRecording 
                    ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                    : 'bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white'
              }`}
              style={{ pointerEvents: 'all' }}
              title={!isInitialized ? "Audio Engine not ready - Click anywhere to activate" : "Record"}
            >
              <div className="w-4 h-4 bg-red-500 rounded-full pointer-events-none"></div>
            </button>

            {/* Record Automation */}
            <button
              onClick={handleRecordAutomation}
              className={`w-8 h-8 rounded flex items-center justify-center ${
                isRecordingAutomation 
                  ? 'bg-orange-600 hover:bg-orange-700' 
                  : 'bg-slate-700 hover:bg-orange-600 text-slate-300 hover:text-white'
              }`}
              title="Record Automation"
            >
              <div className="w-3 h-3 bg-orange-500 rounded-sm transform rotate-45"></div>
            </button>
          </div>

          {/* Time Display */}
          <div className="flex items-center gap-4 mr-6">
            <div className="bg-black px-3 py-1 rounded font-mono text-green-400 text-sm min-w-24 text-center">
              {formatTime(currentTime)}
            </div>
            <span className="text-slate-500 text-sm">/</span>
            <div className="bg-black px-3 py-1 rounded font-mono text-slate-400 text-sm min-w-24 text-center">
              {formatTime(duration)}
            </div>
            <div className="text-slate-400 text-sm ml-2">
              {isRecording ? 'REC' : isPlaying ? 'PLAY' : 'STOP'}
              {isRecordingAutomation && ' AUTO'}
            </div>
          </div>

          {/* BPM and Time Signature */}
          <div className="flex items-center gap-4 mr-6">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">BPM</span>
              <input
                type="number"
                min="60"
                max="200"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                className="bg-slate-700 px-2 py-1 rounded text-sm min-w-12 text-center border-none outline-none focus:bg-slate-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">TIME</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={timeSignature.numerator}
                  onChange={(e) => setTimeSignature(prev => ({ ...prev, numerator: parseInt(e.target.value) || 4 }))}
                  className="bg-slate-700 px-1 py-1 rounded text-sm w-8 text-center border-none outline-none focus:bg-slate-600"
                />
                <span className="text-slate-400 text-xs">/</span>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={timeSignature.denominator}
                  onChange={(e) => setTimeSignature(prev => ({ ...prev, denominator: parseInt(e.target.value) || 4 }))}
                  className="bg-slate-700 px-1 py-1 rounded text-sm w-8 text-center border-none outline-none focus:bg-slate-600"
                />
              </div>
            </div>
          </div>

          {/* Loop Section */}
          <div className="flex items-center gap-2 mr-6">
            <button 
              onClick={toggleLoop}
              className={`px-3 h-6 rounded text-xs font-bold ${
                isLoopEnabled 
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
              }`}
              title={`Loop ${isLoopEnabled ? 'On' : 'Off'} (Ctrl+L)`}
            >
              LOOP
            </button>
            
            {/* Loop Range */}
            {isLoopEnabled && (
              <div className="flex items-center gap-1 text-xs">
                <input
                  type="number"
                  min="0"
                  max={duration}
                  value={Math.floor(loopStart)}
                  onChange={(e) => setLoopStart(parseFloat(e.target.value) || 0)}
                  className="bg-slate-700 px-1 py-0.5 rounded w-12 text-center border-none outline-none focus:bg-slate-600"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="number"
                  min="0"
                  max={duration}
                  value={Math.floor(loopEnd)}
                  onChange={(e) => setLoopEnd(parseFloat(e.target.value) || 16)}
                  className="bg-slate-700 px-1 py-0.5 rounded w-12 text-center border-none outline-none focus:bg-slate-600"
                />
              </div>
            )}
          </div>

          {/* Metronome and Additional Controls */}
          <div className="flex items-center gap-2 mr-6">
            <button 
              onClick={toggleMetronome}
              className={`px-3 h-6 rounded text-xs font-bold ${
                isMetronomeEnabled 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
              }`}
              title="Metronome"
            >
              CLICK
            </button>
            
            <button 
              onClick={toggleMonitoring}
              className={`px-2 h-6 rounded text-xs font-bold ${
                isMonitoringEnabled 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
              }`}
              title="Input Monitoring"
            >
              MON
            </button>
            
            <button 
              onClick={toggleAutoscroll}
              className={`px-2 h-6 rounded text-xs font-bold ${
                isAutoscrollEnabled 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
              }`}
              title="Auto Scroll"
            >
              AUTO
            </button>
          </div>

          {/* Master Volume */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">Master</span>
            <input
              type="range"
              min="0"
              max="100"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseInt(e.target.value))}
              className="w-20 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-slate-300 text-xs w-8 text-right">{masterVolume}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Track Controls */}
        <div className="w-44 bg-slate-800 border-r border-slate-700 flex flex-col">
          {/* Header for track controls */}
          <div className="px-3 py-2 border-b border-slate-700 flex items-center" style={{ height: '40px' }}>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">TRACKS</h2>
          </div>
          
          {/* Track Control Panels */}
          <div className="flex-1 overflow-y-auto track-container">
            {isClient ? trackViews : (
              <div className="p-4 text-slate-400 text-sm">Loading tracks...</div>
            )}
          </div>
        </div>

        {/* Right Panel - Timeline and Track Content */}
        <div className="flex-1 flex flex-col">
          {/* Timeline Header */}
          <SharedTimeline
            duration={duration}
            currentTime={currentTime}
            onTimeChange={seekTransport}
            isLoopEnabled={isLoopEnabled}
            loopStart={loopStart}
            loopEnd={loopEnd}
            trackCount={tracks.length}
            isRecording={isRecording}
          />
          
          {/* Track Content Area */}
          <div className="flex-1 bg-slate-900 relative overflow-hidden">
            {isClient ? trackContents : (
              <div className="p-4 text-slate-400 text-sm">Loading track content...</div>
            )}
            

          </div>
        </div>
      </div>
    </div>
  )
}
