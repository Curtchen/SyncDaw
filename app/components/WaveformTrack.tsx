'use client'

import { useEffect, useRef } from 'react'

// 在props接口中添加可选的幅度缩放参数
interface WaveformTrackProps {
  isRecording: boolean
  isArmed: boolean
  trackId: string
  duration: number
  currentTime: number
  height: number
  width: number
  amplitudeScale?: number  // 波形幅度缩放，0-1之间
}

export default function WaveformTrack({ 
  trackId,
  isRecording, 
  isArmed,
  currentTime,
  duration,
  width,
  height,
  amplitudeScale = 1    // 默认100%灵敏度
}: WaveformTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const audioContextRef = useRef<AudioContext>()
  const analyserRef = useRef<AnalyserNode>()
  const microphoneRef = useRef<MediaStreamAudioSourceNode>()
  // 记录录音开始的时间（AudioContext.currentTime）
  const recordStartRef = useRef<number>(0)
  // 记录最后写入的像素位置
  const lastRecordedXRef = useRef<number>(-1)
  // per-pixel min/max data for waveform axis
  const minDataRef = useRef<number[]>([])
  const maxDataRef = useRef<number[]>([])
  // keep latest props for non-reactive loops
  const propsRef = useRef({ currentTime, duration, width })
  propsRef.current = { currentTime, duration, width }
   
  useEffect(() => {
    // reset data and start/stop audio capture
    if (isRecording && isArmed) {
      // initialize per-pixel storage only if not already done or width changed
      if (minDataRef.current.length !== width) {
        const oldMin = minDataRef.current
        const oldMax = maxDataRef.current
        minDataRef.current = new Array(width).fill(0)
        maxDataRef.current = new Array(width).fill(0)
        // copy old data if exists
        for (let i = 0; i < Math.min(oldMin.length, width); i++) {
          minDataRef.current[i] = oldMin[i] || 0
          maxDataRef.current[i] = oldMax[i] || 0
        }
        // Reset last recorded position when width changes
        lastRecordedXRef.current = -1
      }
      startRecording()
    } else {
      stopRecording()
    }

    return () => {
      stopRecording()
    }
  }, [isRecording, isArmed, width])

  useEffect(() => {
    // redraw whenever timeline updates
    drawWaveform()
  }, [currentTime, duration, width, height])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      // 记录开始时间
      recordStartRef.current = audioContextRef.current.currentTime
      analyserRef.current = audioContextRef.current.createAnalyser()
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current.fftSize = 2048
      analyserRef.current.smoothingTimeConstant = 0.2
      microphoneRef.current.connect(analyserRef.current)
      // start capturing per-pixel min/max
      captureAudio()
    } catch (err) {
      console.error('Error accessing microphone:', err)
    }
  }

  const stopRecording = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
     
    if (microphoneRef.current) microphoneRef.current.disconnect()
     
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close()
  }

  const captureAudio = () => {
    if (!analyserRef.current || !audioContextRef.current) return
    // get time-domain data
    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyserRef.current.getByteTimeDomainData(dataArray)
    // compute min/max sample
    let minSample = 1, maxSample = -1
    for (let i = 0; i < dataArray.length; i++) {
      const sample = (dataArray[i] - 128) / 128
      minSample = Math.min(minSample, sample)
      maxSample = Math.max(maxSample, sample)
    }
    // 计算录音进度对应的像素
    const { currentTime: curT, duration: dur, width: w } = propsRef.current
    const playheadX = Math.floor((curT / dur) * w)
    if (playheadX >= 0 && playheadX < w) {
      minDataRef.current[playheadX] = minSample
      maxDataRef.current[playheadX] = maxSample
      lastRecordedXRef.current = playheadX
    }
    drawWaveform()
    animationRef.current = requestAnimationFrame(captureAudio)
  }

  const drawWaveform = () => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    
    // Get actual rendered dimensions
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    
    // Set canvas size to match actual display size
    canvas.width = Math.floor(rect.width * dpr)
    canvas.height = Math.floor(rect.height * dpr)
    ctx.scale(dpr, dpr)
    
    // Use actual rendered dimensions for calculations
    const centerY = rect.height / 2
    const drawWidth = rect.width
    
    ctx.clearRect(0, 0, rect.width, rect.height)
    
    // Scale data to match current width if needed
    const dataScale = minDataRef.current.length / drawWidth
    
    const amp = (rect.height / 2) * amplitudeScale;
    const endX = Math.min(lastRecordedXRef.current / dataScale, drawWidth)
    
    if (endX < 0) return // No data to draw yet
    
    ctx.beginPath()
    // Top envelope (max) - sample data points based on scale
    let dataIndex = Math.floor(0 * dataScale)
    ctx.moveTo(0, centerY - (maxDataRef.current[dataIndex] || 0) * amp)
    
    for (let x = 1; x <= endX; x++) {
      dataIndex = Math.floor(x * dataScale)
      if (dataIndex < minDataRef.current.length) {
        ctx.lineTo(x, centerY - (maxDataRef.current[dataIndex] || 0) * amp)
      }
    }
    
    // Bottom envelope (min) in reverse
    for (let x = Math.floor(endX); x >= 0; x--) {
      dataIndex = Math.floor(x * dataScale)
      if (dataIndex < minDataRef.current.length) {
        ctx.lineTo(x, centerY - (minDataRef.current[dataIndex] || 0) * amp)
      }
    }
    
    ctx.closePath()
    ctx.fillStyle = 'rgba(59,130,246,0.6)'  // 半透明填充
    ctx.fill()
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ 
        width: '100%', 
        height: `${height}px`,
        imageRendering: 'pixelated'
      }}
    />
  )
}
