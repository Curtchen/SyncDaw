'use client'

import { BrowserCompat } from './browser-compat'

export class AudioEngine {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private tracks: Map<string, AudioTrack> = new Map()
  private isInitialized = false

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

  dispose() {
    this.tracks.forEach(track => track.dispose())
    this.tracks.clear()
    
    if (this.audioContext) {
      this.audioContext.close()
    }
    
    this.isInitialized = false
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

  constructor(id: string, audioContext: AudioContext, destination: AudioNode) {
    this.id = id
    this.audioContext = audioContext
    
    this.trackGain = audioContext.createGain()
    this.panNode = audioContext.createStereoPanner()
    
    this.trackGain.connect(this.panNode)
    this.panNode.connect(destination)
  }

  async startRecording() {
    if (this.isRecording) return

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
          autoGainControl: false
        }
      })
      
      this.recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/wav'
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
      this.recorder.stop()
      this.isRecording = false
    }
  }

  private async loadAudioFromBlob(blob: Blob) {
    try {
      const arrayBuffer = await blob.arrayBuffer()
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
    } catch (error) {
      console.error('Error loading audio:', error)
    }
  }

  play(startTime = 0) {
    if (!this.audioBuffer || this.isMuted) return

    this.stop() // Stop any currently playing audio

    this.sourceNode = this.audioContext.createBufferSource()
    this.sourceNode.buffer = this.audioBuffer
    this.sourceNode.connect(this.trackGain)
    this.sourceNode.start(0, startTime)
  }

  stop() {
    if (this.sourceNode) {
      this.sourceNode.stop()
      this.sourceNode = null
    }
  }

  setVolume(volume: number) {
    this.trackGain.gain.value = volume / 100
  }

  setPan(pan: number) {
    this.panNode.pan.value = pan / 100
  }

  setMuted(muted: boolean) {
    this.isMuted = muted
    this.trackGain.gain.value = muted ? 0 : 1
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
    return this.audioBuffer ? this.audioBuffer.duration : 0
  }

  get recordingState(): boolean {
    return this.isRecording
  }
}
