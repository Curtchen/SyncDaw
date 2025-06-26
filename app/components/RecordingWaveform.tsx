'use client'

import { useEffect, useRef, useCallback } from 'react'

interface WaveformBucket {
  min: number
  max: number
  rms: number
}

interface RecordingWaveformProps {
  isRecording: boolean
  isArmed: boolean
  trackId: string
  width: number
  height: number
  currentTime: number
  duration: number
}

export default function RecordingWaveform({
  isRecording,
  isArmed,
  trackId,
  width,
  height,
  currentTime,
  duration
}: RecordingWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  // 存储分桶后的波形数据：时间 -> 波形桶数组
  const waveformBucketsRef = useRef<Map<number, WaveformBucket[]>>(new Map())
  const recordingStartTimeRef = useRef<number>(0)
  // 当前实时音频数据
  const currentAudioDataRef = useRef<Float32Array>(new Float32Array(0))
  // 采样缓冲区
  const sampleBufferRef = useRef<Float32Array>(new Float32Array(0))

  // 创建波形桶
  const createWaveformBuckets = (audioData: Float32Array, bucketCount: number): WaveformBucket[] => {
    const buckets: WaveformBucket[] = []
    const samplesPerBucket = Math.floor(audioData.length / bucketCount)
    
    for (let i = 0; i < bucketCount; i++) {
      const start = i * samplesPerBucket
      const end = Math.min(start + samplesPerBucket, audioData.length)
      
      let min = 0, max = 0, sum = 0
      for (let j = start; j < end; j++) {
        const sample = audioData[j]
        min = Math.min(min, sample)
        max = Math.max(max, sample)
        sum += sample * sample
      }
      
      buckets.push({
        min,
        max,
        rms: Math.sqrt(sum / (end - start))
      })
    }
    
    return buckets
  }

  // 绘制波形
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 清空画布
    ctx.fillStyle = '#1e293b' // slate-800
    ctx.fillRect(0, 0, width, height)

    // 绘制网格线
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)' // slate-500 with opacity
    ctx.lineWidth = 1

    // 垂直网格线 (时间标记)
    const timeStep = Math.max(1, Math.floor(duration / 10)) // 10条线
    const pixelsPerSecond = width / Math.max(duration, 1)
    
    for (let i = 0; i <= duration; i += timeStep) {
      const x = i * pixelsPerSecond
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // 水平中心线
    const centerY = height / 2
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)'
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()

    // 绘制播放头位置
    if (currentTime >= 0) {
      const playheadX = (currentTime / Math.max(duration, 1)) * width
      ctx.strokeStyle = '#ef4444' // red-500
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, height)
      ctx.stroke()
    }

    // 如果正在录音且轨道已armed，绘制实时波形
    if (isRecording && isArmed && analyserRef.current) {
      drawRealtimeWaveform(ctx, pixelsPerSecond, centerY)
      
      // 添加调试信息
      ctx.fillStyle = '#22c55e'
      ctx.font = '10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('● LIVE', 5, 15)
    }

    // 绘制已录制的波形数据
    if (waveformBucketsRef.current.size > 0) {
      drawRecordedWaveform(ctx, pixelsPerSecond, centerY)
    }

    // 状态提示
    if (!isRecording && isArmed) {
      // 待机状态
      ctx.fillStyle = 'rgba(255, 165, 0, 0.5)' // orange
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('READY TO RECORD', width / 2, height / 2 - 10)
    } else if (!isArmed) {
      // 未armed状态
      ctx.fillStyle = 'rgba(100, 116, 139, 0.7)' // slate-500
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Track not armed for recording', width / 2, height / 2)
    }
  }, [width, height, currentTime, duration, isRecording, isArmed])

  // 绘制实时波形
  const drawRealtimeWaveform = (ctx: CanvasRenderingContext2D, pixelsPerSecond: number, centerY: number) => {
    if (!analyserRef.current) return

    const bufferLength = analyserRef.current.fftSize
    const dataArray = new Float32Array(bufferLength)
    analyserRef.current.getFloatTimeDomainData(dataArray)

    // 绘制完整的实时波形，占满整个画布宽度
    ctx.strokeStyle = '#22c55e' // green-500
    ctx.lineWidth = 2
    ctx.beginPath()

    const sliceWidth = width / bufferLength
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      const amplitude = dataArray[i]
      const y = centerY + (amplitude * (height * 0.8)) // 80% of height for better visibility
      
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
      x += sliceWidth
    }
    ctx.stroke()

    // 存储波形数据到历史记录
    const recordingTime = currentTime - recordingStartTimeRef.current
    if (recordingTime >= 0 && dataArray && dataArray.length > 0) {
      const timeKey = Math.floor(recordingTime * 10) / 10 // 0.1秒精度
      const buckets = createWaveformBuckets(dataArray, Math.floor(width / 4)) // 每4像素一个桶
      waveformBucketsRef.current.set(timeKey, buckets)
    }
  }

  // 绘制已录制的波形
  const drawRecordedWaveform = (ctx: CanvasRenderingContext2D, pixelsPerSecond: number, centerY: number) => {
    ctx.strokeStyle = '#22c55e' // green-500
    ctx.lineWidth = 1

    Array.from(waveformBucketsRef.current.entries()).forEach(([timeKey, buckets]) => {
      const startX = timeKey * pixelsPerSecond
      
      if (startX >= 0 && startX < width) {
        // 绘制波形桶
        ctx.beginPath()
        buckets.forEach((bucket, index) => {
          const x = startX + (index * 4) // 每4像素一个桶
          const minY = centerY - (bucket.min * (height * 0.4))
          const maxY = centerY - (bucket.max * (height * 0.4))
          
          if (index === 0) {
            ctx.moveTo(x, minY)
          } else {
            ctx.lineTo(x, minY)
          }
          ctx.lineTo(x, maxY)
        })
        ctx.stroke()
      }
    })
  }

  // 启动录音
  const startRecording = async () => {
    try {
      console.log('🎤 Starting audio recording for track:', trackId)
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      })

      streamRef.current = stream
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      
      analyserRef.current.fftSize = 2048  // 给我们1024个样本点
      analyserRef.current.smoothingTimeConstant = 0.1  // 轻微平滑

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      recordingStartTimeRef.current = currentTime
      waveformBucketsRef.current.clear()

      console.log('✅ Audio recording started successfully')
      
      // 开始持续的动画循环
      const animate = () => {
        drawWaveform()
        if (isRecording && isArmed && analyserRef.current) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }
      animationRef.current = requestAnimationFrame(animate)

    } catch (error) {
      console.error('❌ Error starting recording:', error)
      alert('无法访问麦克风。请检查权限设置。')
    }
  }

  // 停止录音
  const stopRecording = () => {
    console.log('🛑 Stopping audio recording for track:', trackId)
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    analyserRef.current = null
  }

  // 监听录音状态变化
  useEffect(() => {
    if (isRecording && isArmed) {
      startRecording()
    } else {
      stopRecording()
    }

    return () => stopRecording()
  }, [isRecording, isArmed, trackId])

  // 监听尺寸变化
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = width
      canvas.height = height
      drawWaveform()
    }
  }, [width, height, drawWaveform])

  // 监听时间变化，重绘播放头
  useEffect(() => {
    if (!isRecording) {
      drawWaveform()
    }
  }, [currentTime, drawWaveform])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full block"
      style={{ 
        width: `${width}px`, 
        height: `${height}px`,
        background: '#1e293b'
      }}
    />
  )
}
