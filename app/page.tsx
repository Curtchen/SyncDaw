'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Play, Pause, Square, SkipBack, SkipForward } from 'lucide-react'
import TrackView from './components/TrackView'
import TrackContent from './components/TrackContent'
import SharedTimeline from './components/SharedTimeline'
import { useAudioEngine } from './hooks/useAudioEngine'
import { Track } from './types/track'
import { useTransport } from './state/transport'
import { useClips } from './state/clips'

export default function DAWInterface() {
  const {
    isInitialized,
    masterVolume,
    createTrack,
    getTrack,
    removeTrack: removeAudioTrack,
    setMasterVolume,
    getMaxTrackDuration,
    getAllTrackDurations,
    toggleMetronome: engineToggleMetronome,
    toggleMonitoring: engineToggleMonitoring
  } = useAudioEngine()
  
  // Project settings
  const [projectName, setProjectName] = useState('Untitled')
  const [sampleRate, setSampleRate] = useState('44.1')
  
  // Real-time CPU usage
  const [cpuUsage, setCpuUsage] = useState(25)
  
  // Client-side flag
  const [isClient, setIsClient] = useState(false)
  
  const { isPlaying, currentTime, play: transportPlay, pause: transportPause, togglePlay, stop: transportStop, seek: seekTransport, setLoop: transportSetLoop } = useTransport()
  const [isRecording, setIsRecording] = useState(false)
  const [isRecordingAutomation, setIsRecordingAutomation] = useState(false)
  const [isLoopEnabled, setIsLoopEnabled] = useState(false)
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false)
  const [isMonitoringEnabled, setIsMonitoringEnabled] = useState(false)
  const [isAutoscrollEnabled, setIsAutoscrollEnabled] = useState(false)
  const [loopStart, setLoopStart] = useState(0)
  const [loopEnd, setLoopEnd] = useState(8)
  const [bpm, setBpm] = useState(120)
  const [timeSignature, setTimeSignature] = useState({ numerator: 4, denominator: 4 })
  const [duration, setDuration] = useState(30) // 30 seconds
  // For editable length field
  const [lengthInput, setLengthInput] = useState('30')

  // Viewport scrolling for DAW-style recording
  const [viewportStart, setViewportStart] = useState(0) // Start time of viewport window
  const viewportDuration = 30 // Fixed 30s viewport
  const playheadFixedAt = 15 // Red line fixed at 15s mark when scrolling

  // 添加状态来跟踪是否应该清空波形数据（当按stop时）
  const [shouldClearWaveformData, setShouldClearWaveformData] = useState(false)

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
  const trackScrollRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)

  // Clip store for visualising recorded audio
  const clipsStore = useClips()

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
    // 清空波形数据
    setShouldClearWaveformData(true)
  }, [tracks, getTrack, isLoopEnabled, loopStart, transportStop, seekTransport])

  // 重置清空波形数据的标记
  useEffect(() => {
    if (shouldClearWaveformData) {
      // 短暂延迟后重置标记，让WaveformTrack有时间处理清空请求
      const timer = setTimeout(() => {
        setShouldClearWaveformData(false)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [shouldClearWaveformData])

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

            // ----- Create visual clip for this recording (placeholder buffer) -----
            try {
              const recDuration = currentTime // how long recorded
              if (recDuration > 0) {
                const sampleRate = 44100
                const buffer = new AudioBuffer({ length: Math.max(1, Math.floor(recDuration * sampleRate)), sampleRate })

                // Replace any existing clip on this track
                clipsStore.replaceClipForTrack(track.id, {
                  id: `${track.id}-${Date.now()}`,
                  trackId: track.id,
                  type: 'audio',
                  buffer,
                  start: 0,
                  duration: recDuration
                })
              }
            } catch (err) {
              console.warn('Failed to create placeholder clip', err)
            }
          }
        })
        setIsRecording(false)
        console.log(`⏹️ Recording stopped globally`)
        
        // Update project duration to match longest track
        setTimeout(() => {
          const maxDuration = getMaxTrackDuration()
          if (maxDuration > 0) {
            const newDuration = Math.max(maxDuration + 5, 30) // Add 5 seconds padding, minimum 30s
            setDuration(newDuration)
            console.log(`📏 Updated project duration to ${newDuration}s (max track: ${maxDuration}s)`)
          }
        }, 100) // Small delay to ensure audio processing is complete
        
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
  }, [isInitialized, isRecording, tracks, getTrack, createTrack, currentTime])

  const toggleLoop = useCallback(() => {
    setIsLoopEnabled(prev => !prev)
  }, [])

  const toggleMetronome = useCallback(() => {
    if (!isInitialized) return
    engineToggleMetronome(bpm, 50)
    setIsMetronomeEnabled(prev => !prev)
  }, [isInitialized, engineToggleMetronome, bpm])

  const toggleMonitoring = useCallback(() => {
    if (!isInitialized) return
    engineToggleMonitoring()
    setIsMonitoringEnabled(prev => !prev)
  }, [isInitialized, engineToggleMonitoring])

  const toggleAutoscroll = useCallback(() => {
    setIsAutoscrollEnabled(!isAutoscrollEnabled)
  }, [isAutoscrollEnabled])

  // Timeline loop selection handler
  const handleLoopChange = useCallback((start: number, end: number) => {
    setLoopStart(start)
    setLoopEnd(end)
  }, [])

  // Update viewport during recording to keep playhead centered after 15s
  useEffect(() => {
    if (isRecording && currentTime > playheadFixedAt) {
      const newViewportStart = currentTime - playheadFixedAt
      setViewportStart(newViewportStart)
    }
  }, [isRecording, currentTime, playheadFixedAt])

  // Handle manual viewport scrolling (when not recording)
  const handleViewportScroll = useCallback((newStart: number, allowExtend: boolean = true) => {
    if (!isRecording) {
      const maxTrackDuration = getMaxTrackDuration()
      const baseMaxStart = Math.max(0, maxTrackDuration - viewportDuration)

      // Optional auto-extend (wheel/keyboard). Skip when not allowed (e.g., dragging pager)
      if (allowExtend && newStart > baseMaxStart && !isPlaying && !isRecording) {
        setDuration(prev => Math.max(prev, newStart + viewportDuration))
      }

      const updatedMaxStart = Math.max(0, Math.max(getMaxTrackDuration(), duration) - viewportDuration)
      setViewportStart(Math.max(0, Math.min(updatedMaxStart, newStart)))
    }
  }, [isRecording, isPlaying, getMaxTrackDuration, viewportDuration, duration])

  // Calculate relative playhead position within viewport
  const getPlayheadPosition = useCallback(() => {
    if (isRecording && currentTime > playheadFixedAt) {
      return playheadFixedAt // Fixed at center during recording
    }
    return Math.max(0, Math.min(viewportDuration, currentTime - viewportStart))
  }, [isRecording, currentTime, playheadFixedAt, viewportStart, viewportDuration])

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
        case 'ArrowLeft':
          if (e.ctrlKey) {
            e.preventDefault()
            handleViewportScroll(viewportStart - 5)
          }
          break
        case 'ArrowRight':
          if (e.ctrlKey) {
            e.preventDefault()
            handleViewportScroll(viewportStart + 5)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isClient, isLoopEnabled, loopStart, handlePlay, handleRecord, toggleLoop, handleStop, handleViewportScroll, viewportStart])

  // Scroll wheel navigation for timeline
  useEffect(() => {
    if (!isClient) return

    const handleWheel = (e: WheelEvent) => {
      // Only handle wheel events on timeline/track areas
      const target = e.target as HTMLElement
      if (target.closest('.timeline-scroll-area')) {
        e.preventDefault()
        const scrollAmount = e.deltaY > 0 ? 2 : -2 // 2 seconds per scroll
        handleViewportScroll(viewportStart + scrollAmount)
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [isClient, handleViewportScroll, viewportStart])

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
    const milliseconds = Math.floor((seconds % 1) * 1000)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${milliseconds.toString().padStart(3, '0')}`
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
        onTimeChange={seekTransport}
        viewportStart={viewportStart}
        viewportDuration={viewportDuration}
        shouldClearWaveformData={shouldClearWaveformData}
      />
    ))
  }, [isClient, tracks, duration, isPlaying, isRecording, currentTime, updateTrack, seekTransport, viewportStart, viewportDuration, shouldClearWaveformData])

  // Auto pause when playback reaches the end of the longest recorded track
  useEffect(() => {
    if (!isPlaying) return

    // 录音过程中不要触发自动暂停，否则会中断录音
    if (isRecording) return

    // Get the current max track duration
    const maxTrackDuration = getMaxTrackDuration()
    const effectiveDuration = maxTrackDuration > 0 ? maxTrackDuration : duration

    if (!isLoopEnabled && currentTime >= effectiveDuration) {
      // 将播放头固定在最长轨道时长处，再暂停
      seekTransport(effectiveDuration)
      transportPause()
      console.log(`⏸️ Auto-paused at end of longest track (${effectiveDuration}s)`) 
    }
  }, [isPlaying, isRecording, currentTime, duration, isLoopEnabled, transportPause, getMaxTrackDuration, seekTransport])

  // 同步音轨播放状态与transport状态
  useEffect(() => {
    if (!isInitialized) return

    tracks.forEach(track => {
      const audioTrack = getTrack(track.id)
      if (audioTrack) {
        if (isPlaying && !isRecording) {
          // 开始播放音轨，从当前时间开始
          const playTime = useTransport.getState().currentTime
          audioTrack.play(playTime)
          console.log(`🎵 Starting playback for track ${track.id} at ${playTime}s`)
        } else {
          // 停止播放音轨
          audioTrack.stop()
          console.log(`⏹️ Stopping playback for track ${track.id}`)
        }
      }
    })
  }, [isPlaying, isRecording, tracks, getTrack, isInitialized])

  // 同步轨道控制面板和内容区域的垂直滚动
  const handleTrackScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (contentScrollRef.current && trackScrollRef.current) {
      contentScrollRef.current.scrollTop = trackScrollRef.current.scrollTop
    }
  }, [])

  const handleContentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (trackScrollRef.current && contentScrollRef.current) {
      trackScrollRef.current.scrollTop = contentScrollRef.current.scrollTop
    }
  }, [])

  // Sync loop settings with transport whenever they change
  useEffect(() => {
    transportSetLoop(isLoopEnabled, loopStart, loopEnd)
  }, [isLoopEnabled, loopStart, loopEnd, transportSetLoop])

  // Keep input synced when duration changes externally
  useEffect(() => {
    setLengthInput(Math.floor(duration).toString())
  }, [duration])

  const commitNewLength = useCallback((value: string) => {
    const parsed = parseFloat(value)
    if (!isNaN(parsed) && parsed > 0) {
      setDuration(parsed)
      // Ensure viewport inside new range
      setViewportStart(prev => Math.min(prev, Math.max(0, parsed - viewportDuration)))
    }
  }, [viewportDuration])

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-x-hidden">
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
            <input
              type="number"
              min="1"
              value={lengthInput}
              onChange={(e) => setLengthInput(e.target.value)}
              onBlur={(e) => commitNewLength(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitNewLength((e.target as HTMLInputElement).value)
                }
              }}
              className="bg-black px-2 py-1 rounded font-mono text-slate-400 text-sm w-24 text-center border border-slate-600 focus:outline-none focus:border-blue-500"
              title="Set total timeline length (seconds) and press Enter"
            />
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
          <div 
            ref={trackScrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden track-container"
            onScroll={handleTrackScroll}
          >
            {isClient ? trackViews : (
              <div className="p-4 text-slate-400 text-sm">Loading tracks...</div>
            )}
          </div>
        </div>

        {/* Right Panel - Timeline and Track Content */}
        <div className="flex-1 flex flex-col timeline-scroll-area">
          {/* Timeline Header */}
          <SharedTimeline
            duration={duration}
            viewportStart={viewportStart}
            viewportDuration={viewportDuration}
            playheadPosition={getPlayheadPosition()}
            currentTime={currentTime}
            onTimeChange={seekTransport}
            onViewportScroll={handleViewportScroll}
            isLoopEnabled={isLoopEnabled}
            loopStart={loopStart}
            loopEnd={loopEnd}
            onLoopChange={handleLoopChange}
            trackCount={tracks.length}
            isRecording={isRecording}
            maxTrackDuration={getMaxTrackDuration()}
          />
          
          {/* Track Content Area */}
          <div 
            ref={contentScrollRef}
            className="flex-1 bg-slate-900 relative overflow-y-auto overflow-x-hidden"
            onScroll={handleContentScroll}
          >
            {isClient ? trackContents : (
              <div className="p-4 text-slate-400 text-sm">Loading track content...</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Progress Bar (Pager) - Show when content exceeds viewport */}
      {Math.max(getMaxTrackDuration(), duration) > viewportDuration && (
        <div className="bg-slate-800 border-t border-slate-600 px-4 py-2">
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-xs">Timeline:</span>
            
            {/* Progress bar track */}
            <div className="flex-1 h-2 bg-slate-700 rounded-full relative">
              {/* Total duration background */}
              <div className="w-full h-full bg-slate-600 rounded-full"></div>
              
              {/* Viewport indicator */}
              <div 
                className="absolute top-0 h-full bg-blue-500 rounded-full opacity-70 cursor-pointer"
                style={{
                  left: `${(viewportStart / Math.max(getMaxTrackDuration(), duration)) * 100}%`,
                  width: `${(viewportDuration / Math.max(getMaxTrackDuration(), duration)) * 100}%`
                }}
                onMouseDown={(e) => {
                  // Capture parent element outside of subsequent callbacks to avoid React synthetic event pooling issues
                  const parentElement = (e.currentTarget as HTMLElement).parentElement
                  if (!parentElement) return

                  const startDrag = (clientX: number) => {
                    const rect = parentElement.getBoundingClientRect()
                    const x = clientX - rect.left
                    const percentage = Math.max(0, Math.min(1, x / rect.width))
                    const newStart = percentage * Math.max(getMaxTrackDuration(), duration) - viewportDuration / 2
                    handleViewportScroll(newStart, false)
                  }

                  startDrag(e.clientX)

                  const handleMouseMove = (ev: MouseEvent) => startDrag(ev.clientX)
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }

                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                  e.preventDefault()
                }}
              />
              
              {/* Current playhead position indicator */}
              <div 
                className="absolute top-0 w-0.5 h-full bg-red-500 pointer-events-none"
                style={{
                  left: `${(currentTime / Math.max(getMaxTrackDuration(), duration)) * 100}%`
                }}
              />
            </div>
            
            {/* Time info */}
            <div className="text-slate-400 text-xs whitespace-nowrap">
              {Math.floor(viewportStart)}s - {Math.floor(viewportStart + viewportDuration)}s / {Math.floor(Math.max(getMaxTrackDuration(), duration))}s
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
