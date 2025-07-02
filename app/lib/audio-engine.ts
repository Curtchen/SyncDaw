'use client'

import { BrowserCompat } from './browser-compat'
// import { useClips } from '../state/clips'
import { useTransport } from '../state/transport'
import { AudioClip } from '../types/clip'

export class AudioEngine {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private tracks: Map<string, AudioTrack> = new Map()
  private isInitialized = false
  // Metronome related nodes/state
  private metronomeGain: GainNode | null = null
  private metronomeIntervalId: number | null = null
  private isMetronomeOn = false
  // Monitoring (live input passthrough) state
  private monitorStream: MediaStream | null = null
  private monitorSource: MediaStreamAudioSourceNode | null = null
  private isMonitoringOn = false

  async initialize() {
    if (this.isInitialized) return

    try {
      console.log('🔧 Initializing AudioEngine...')
      console.log('🌐 Browser:', BrowserCompat.isEdge() ? 'Edge' : BrowserCompat.isChrome() ? 'Chrome' : 'Other')
      
      // 使用浏览器兼容性工具创建AudioContext
      this.audioContext = await BrowserCompat.createAudioContext()
      
      if (!this.audioContext) {
        throw new Error('Failed to create AudioContext')
      }

      this.masterGain = this.audioContext.createGain()
      this.masterGain.connect(this.audioContext.destination)
      
      // Prepare metronome gain (default muted until enabled)
      this.metronomeGain = this.audioContext.createGain()
      this.metronomeGain.gain.value = 0 // start muted
      this.metronomeGain.connect(this.masterGain)
      
      this.isInitialized = true
      console.log('✅ AudioEngine initialized successfully')
      console.log('📊 AudioContext state:', this.audioContext.state)
      console.log('📊 Sample rate:', this.audioContext.sampleRate)
    } catch (error) {
      console.error('❌ AudioEngine initialization failed:', error)
      this.isInitialized = false
      throw error
    }
  }

  createTrack(id: string): AudioTrack {
    if (!this.audioContext || !this.masterGain) {
      throw new Error('AudioEngine not initialized')
    }

    const track = new AudioTrack(id, this.audioContext, this.masterGain)
    this.tracks.set(id, track)
    return track
  }

  getTrack(id: string): AudioTrack | undefined {
    return this.tracks.get(id)
  }

  removeTrack(id: string) {
    const track = this.tracks.get(id)
    if (track) {
      track.dispose()
      this.tracks.delete(id)
    }
  }

  setMasterVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = volume / 100
    }
  }

  getMaxTrackDuration(): number {
    let maxDuration = 0
    this.tracks.forEach(track => {
      const trackDuration = track.duration
      if (trackDuration > maxDuration) {
        maxDuration = trackDuration
      }
    })
    return maxDuration
  }

  getAllTrackDurations(): { [trackId: string]: number } {
    const durations: { [trackId: string]: number } = {}
    this.tracks.forEach((track, id) => {
      durations[id] = track.duration
    })
    return durations
  }

  dispose() {
    this.tracks.forEach(track => track.dispose())
    this.tracks.clear()
    
    if (this.audioContext) {
      this.audioContext.close()
    }
    
    this.isInitialized = false

    // Stop metronome if running
    this.stopMetronome()

    // Stop monitoring if enabled
    this.disableMonitoring()
  }

  /* ===================== Metronome ===================== */

  /**
   * Start the metronome. Will schedule clicks aligned to the given bpm.
   * @param bpm Beats per minute
   * @param volume 0‒100
   */
  startMetronome(bpm: number, volume: number = 50) {
    if (!this.audioContext || !this.metronomeGain) return

    // Ensure any previous interval is cleared
    this.stopMetronome()

    this.isMetronomeOn = true
    // set volume
    this.setMetronomeVolume(volume)

    const intervalMs = (60 / bpm) * 1000

    // Play initial click immediately
    this.playMetronomeClick()

    this.metronomeIntervalId = window.setInterval(() => {
      this.playMetronomeClick()
    }, intervalMs)
  }

  /** Stop the metronome */
  stopMetronome() {
    if (this.metronomeIntervalId !== null) {
      clearInterval(this.metronomeIntervalId)
      this.metronomeIntervalId = null
    }
    this.isMetronomeOn = false
    if (this.metronomeGain) {
      this.metronomeGain.gain.value = 0
    }
  }

  /** Toggle metronome on/off */
  toggleMetronome(bpm: number, volume: number = 50) {
    if (this.isMetronomeOn) {
      this.stopMetronome()
    } else {
      this.startMetronome(bpm, volume)
    }
  }

  /** Set metronome volume 0-100 */
  setMetronomeVolume(volume: number) {
    if (this.metronomeGain) {
      this.metronomeGain.gain.value = Math.max(0, Math.min(volume, 100)) / 100
    }
  }

  /** Play a single short click (2 ms ramp). */
  private playMetronomeClick() {
    if (!this.audioContext || !this.metronomeGain || !this.isMetronomeOn) return

    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()

    osc.type = 'square'
    osc.frequency.value = 1000

    gain.gain.setValueAtTime(1, this.audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05)

    osc.connect(gain)
    gain.connect(this.metronomeGain)

    osc.start()
    osc.stop(this.audioContext.currentTime + 0.06)
  }

  /* ===================== Monitoring ===================== */

  /** Enable input monitoring: routes microphone input directly to the master output. */
  async enableMonitoring() {
    if (this.isMonitoringOn) return
    if (!this.audioContext || !this.masterGain) return

    try {
      // For Edge browsers explicitly request permission first to avoid errors
      if (BrowserCompat.isEdge()) {
        const granted = await BrowserCompat.requestAudioPermission()
        if (!granted) throw new Error('Audio permission denied for monitoring')
      }

      // Reuse existing stream if any
      if (!this.monitorStream) {
        this.monitorStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        })
      }

      // Create a MediaStream source and connect to master
      this.monitorSource = this.audioContext.createMediaStreamSource(this.monitorStream)
      this.monitorSource.connect(this.masterGain)
      this.isMonitoringOn = true
      console.log('🎧 Monitoring enabled')
    } catch (error) {
      console.error('❌ Failed to enable monitoring:', error)
    }
  }

  /** Disable input monitoring */
  disableMonitoring() {
    if (!this.isMonitoringOn) return
    if (this.monitorSource) {
      try {
        this.monitorSource.disconnect()
      } catch (e) {
        // ignore
      }
      this.monitorSource = null
    }

    // Stop and release stream tracks
    if (this.monitorStream) {
      this.monitorStream.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch (e) {
          /* ignore */
        }
      })
      this.monitorStream = null
    }

    this.isMonitoringOn = false
    console.log('🎧 Monitoring disabled')
  }

  /** Toggle input monitoring on/off */
  async toggleMonitoring() {
    if (this.isMonitoringOn) {
      this.disableMonitoring()
    } else {
      await this.enableMonitoring()
    }
  }
}

export class AudioTrack {
  private id: string
  private audioContext: AudioContext
  private trackGain: GainNode
  private panNode: StereoPannerNode
  private recorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private audioBuffer: AudioBuffer | null = null
  private sourceNode: AudioBufferSourceNode | null = null
  private isRecording = false
  private isMuted = false
  private isSolo = false
  private volume = 80 // Store the actual volume (0-100)
  private recordStartTime: number = 0
  private recordedDuration: number | null = null
  private segmentStartPos: number = 0 // timeline position where current segment starts

  constructor(id: string, audioContext: AudioContext, destination: AudioNode) {
    this.id = id
    this.audioContext = audioContext
    
    this.trackGain = audioContext.createGain()
    this.panNode = audioContext.createStereoPanner()
    
    // 设置初始音量
    this.updateGain()
    
    this.trackGain.connect(this.panNode)
    this.panNode.connect(destination)
  }

  private updateGain() {
    // 计算最终的增益值：静音时为0，否则为实际音量
    const gainValue = this.isMuted ? 0 : (this.volume / 100)
    this.trackGain.gain.value = gainValue
    console.log(`🔊 Track ${this.id} gain updated: ${gainValue} (volume: ${this.volume}%, muted: ${this.isMuted})`)
  }

  async startRecording() {
    if (this.isRecording) return

    // mark segment start position for later merging
    this.segmentStartPos = useTransport.getState().currentTime

    try {
      console.log(`🎤 Starting recording for track ${this.id}`)
      
      // 在Edge中请求权限前先检查
      if (BrowserCompat.isEdge()) {
        console.log('🌐 Edge detected, using enhanced permission flow')
        const hasPermission = await BrowserCompat.requestAudioPermission()
        if (!hasPermission) {
          throw new Error('Audio permission denied in Edge')
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: this.audioContext.sampleRate,
          channelCount: 2
        }
      })
      
      // Prefer uncompressed PCM first, then WAV, then Opus
      let preferredMime = ''
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')) {
        preferredMime = 'audio/webm;codecs=pcm'
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        preferredMime = 'audio/wav'
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        preferredMime = 'audio/webm;codecs=opus'
      } else {
        preferredMime = '' // let browser choose
      }

      this.recorder = new MediaRecorder(stream, {
        mimeType: preferredMime,
        audioBitsPerSecond: 256000 // 256 kbps for better quality
      })
      
      this.recordedChunks = []

      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.recorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/wav' })
        await this.loadAudioFromBlob(blob)
      }

      // Use audioContext clock for precise timing
      this.recordStartTime = this.audioContext.currentTime
      this.recorder.start(BrowserCompat.isEdge() ? 1000 : 100) // Edge needs larger chunks
      this.isRecording = true
      console.log(`✅ Recording started for track ${this.id}`)
    } catch (error) {
      console.error(`❌ Error starting recording for track ${this.id}:`, error)
      throw error
    }
  }

  stopRecording() {
    if (this.recorder && this.isRecording) {
      // Record exact duration at stop moment using transport time
      const transportTime = useTransport.getState().currentTime
      this.recordedDuration = transportTime
      console.log(`⏹️ Track ${this.id} stopping recording at transport time: ${transportTime}s`)
      this.recorder.stop()
      this.isRecording = false
    }
  }

  private async loadAudioFromBlob(blob: Blob) {
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const newBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

      const existingBuffer = this.audioBuffer

      if (existingBuffer) {
        const sampleRate = existingBuffer.sampleRate
        if (newBuffer.sampleRate !== sampleRate) {
          console.warn('Sample rate mismatch, cannot append. Overwriting existing recording.')
          this.audioBuffer = newBuffer
        } else {
          const offsetFrames = Math.round(this.segmentStartPos * sampleRate)
          const totalFrames = Math.max(existingBuffer.length, offsetFrames + newBuffer.length)
          const numChannels = Math.max(existingBuffer.numberOfChannels, newBuffer.numberOfChannels)

          const output = this.audioContext.createBuffer(numChannels, totalFrames, sampleRate)

          for (let ch = 0; ch < numChannels; ch++) {
            const out = output.getChannelData(ch)
            // copy existing
            if (ch < existingBuffer.numberOfChannels) {
              out.set(existingBuffer.getChannelData(ch))
            }
            // copy new segment at offset
            if (ch < newBuffer.numberOfChannels) {
              out.set(newBuffer.getChannelData(ch), offsetFrames)
            }
          }

          this.audioBuffer = output
        }
      } else {
        // first recording
        this.audioBuffer = newBuffer
      }
      
      console.log(`🎵 Track ${this.id} loaded audio blob, recorded duration: ${this.recordedDuration}s (from transport time)`)
    } catch (error) {
      console.error('Error loading audio:', error)
    }
  }

  play(startTime = 0) {
    console.log(`🎵 Track ${this.id} play() called - startTime: ${startTime}s`)
    console.log(`🎵 Track ${this.id} state - audioBuffer: ${!!this.audioBuffer}, muted: ${this.isMuted}, volume: ${this.volume}%`)
    
    if (!this.audioBuffer) {
      console.log(`❌ Track ${this.id} has no audio buffer to play`)
      return
    }
    
    if (this.isMuted) {
      console.log(`🔇 Track ${this.id} is muted, skipping playback`)
      return
    }

    this.stop() // Stop any currently playing audio

    this.sourceNode = this.audioContext.createBufferSource()
    this.sourceNode.buffer = this.audioBuffer
    this.sourceNode.connect(this.trackGain)
    
    console.log(`🎵 Track ${this.id} starting audio buffer playback from ${startTime}s`)
    this.sourceNode.start(0, startTime)
    
    // If we have a recorded duration, stop at that exact time
    if (this.recordedDuration != null) {
      const stopTime = this.audioContext.currentTime + (this.recordedDuration - startTime)
      console.log(`🎵 Track ${this.id} scheduled to stop at ${stopTime}s (recorded duration: ${this.recordedDuration}s)`)
      this.sourceNode.stop(stopTime)
    }
  }

  stop() {
    if (this.sourceNode) {
      try {
        // AudioScheduledSourceNode can only be stopped if it's been started
        // and hasn't already ended. Use try-catch to handle state errors safely.
        this.sourceNode.stop()
      } catch (error) {
        // This can happen if the node has already ended or was never started
        console.log(`🔇 Track ${this.id} sourceNode stop() failed (likely already ended):`, error instanceof Error ? error.message : String(error))
      }
      this.sourceNode = null
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(100, volume))
    this.updateGain()
  }

  setPan(pan: number) {
    this.panNode.pan.value = pan / 100
  }

  setMuted(muted: boolean) {
    this.isMuted = muted
    this.updateGain()
  }

  setSolo(solo: boolean) {
    this.isSolo = solo
    // Solo logic would be handled at the engine level
  }

  dispose() {
    this.stop()
    if (this.recorder) {
      this.recorder.stop()
    }
  }

  get duration(): number {
    // Return recorded duration if available, otherwise audioBuffer duration
    return this.recordedDuration != null ? this.recordedDuration : (this.audioBuffer ? this.audioBuffer.duration : 0)
  }

  get recordingState(): boolean {
    return this.isRecording
  }
}
