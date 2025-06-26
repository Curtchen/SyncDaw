'use client'

import { useEffect, useRef, useCallback } from 'react'

interface WaveformBucket {
  min: number
  max: number
  rms: number
}

interface RealtimeWaveformProps {
  isRecording: boolean
  isArmed: boolean
  trackId: string
  width: number
  height: number
  currentTime: number
  duration: number
}

export default function RealtimeWaveform({
  isRecording,
  isArmed,
  trackId,
  width,
  height,
  currentTime,
  duration
}: RealtimeWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  // 存储分桶后的波形数据：时间戳 -> 波形桶数组
  const waveformBucketsRef = useRef<Map<number, WaveformBucket[]>>(new Map())
  const recordingStartTimeRef = useRef<number>(0)
  // 当前实时音频数据缓冲区
  const audioBufferRef = useRef<Float32Array>(new Float32Array(2048))

  // 将音频样本分桶，提取峰值
  const createWaveformBuckets = (audioData: Float32Array, bucketsCount: number): WaveformBucket[] => {
    const buckets: WaveformBucket[] = []
    const samplesPerBucket = Math.floor(audioData.length / bucketsCount)
    
    for (let i = 0; i < bucketsCount; i++) {
      const start = i * samplesPerBucket
      const end = Math.min(start + samplesPerBucket, audioData.length)
      
      let min = 1
      let max = -1
      let sum = 0
      let count = 0
      
      for (let j = start; j < end; j++) {
        const sample = audioData[j]
        min = Math.min(min, sample)
        max = Math.max(max, sample)
        sum += sample * sample
        count++
      }
      
      const rms = count > 0 ? Math.sqrt(sum / count) : 0
      buckets.push({ min, max, rms })
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
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.15)'
    ctx.lineWidth = 1

    // 时间网格线
    const pixelsPerSecond = width / Math.max(duration, 1)
    for (let i = 0; i <= duration; i++) {
      const x = i * pixelsPerSecond
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // 水平中心线
    const centerY = height / 2
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)'
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()

    // 绘制播放头
    if (currentTime >= 0) {
      const playheadX = (currentTime / Math.max(duration, 1)) * width
      ctx.strokeStyle = '#ef4444' // red-500
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, height)
      ctx.stroke()
    }

    // 绘制已录制的波形数据
    drawRecordedWaveforms(ctx, pixelsPerSecond, centerY)

    // 绘制实时波形
    if (isRecording && isArmed) {
      drawRealtimeWaveform(ctx, pixelsPerSecond, centerY)
    }

    // 状态提示
    if (!isRecording && isArmed) {
      ctx.fillStyle = 'rgba(255, 165, 0, 0.7)'
      ctx.font = '14px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('READY TO RECORD', width / 2, height / 2 - 10)
      ctx.fillStyle = 'rgba(255, 165, 0, 0.5)'
      ctx.font = '12px system-ui'
      ctx.fillText('Click record to start capturing audio', width / 2, height / 2 + 10)
    } else if (!isArmed) {
      ctx.fillStyle = 'rgba(100, 116, 139, 0.6)'
      ctx.font = '12px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('Arm track to enable recording', width / 2, height / 2)
    }
  }, [width, height, currentTime, duration, isRecording, isArmed])

  // 绘制实时波形
  const drawRealtimeWaveform = (ctx: CanvasRenderingContext2D, pixelsPerSecond: number, centerY: number) => {
    if (!analyserRef.current) return

    // 获取当前音频数据
    analyserRef.current.getFloatTimeDomainData(audioBufferRef.current)
    
    // 计算当前录音位置
    const recordingTime = currentTime - recordingStartTimeRef.current
    const currentX = recordingTime * pixelsPerSecond
    
    if (currentX < 0 || currentX >= width) return

    // 将音频数据分桶 - 用较少的桶数来显示实时数据
    const bucketsCount = Math.min(100, width / 4) // 每4像素一个桶
    const buckets = createWaveformBuckets(audioBufferRef.current, bucketsCount)
    
    // 绘制波形
    ctx.strokeStyle = '#22c55e' // green-500
    ctx.fillStyle = 'rgba(34, 197, 94, 0.3)' // green with alpha
    ctx.lineWidth = 1

    // 绘制上下边界线和填充
    const bucketWidth = Math.max(1, Math.floor(pixelsPerSecond / 10)) // 0.1秒的宽度
    
    buckets.forEach((bucket, index) => {
      const x = currentX + (index * bucketWidth) - (bucketsCount * bucketWidth / 2)
      
      if (x >= 0 && x < width) {
        const maxY = centerY - (bucket.max * (height * 0.4))
        const minY = centerY - (bucket.min * (height * 0.4))
        
        // 填充区域
        ctx.fillRect(x, Math.min(maxY, centerY), bucketWidth, Math.abs(maxY - minY))
        
        // 边界线
        ctx.beginPath()
        ctx.moveTo(x, maxY)
        ctx.lineTo(x + bucketWidth, maxY)
        ctx.moveTo(x, minY)
        ctx.lineTo(x + bucketWidth, minY)
        ctx.stroke()
      }
    })

    // 存储波形数据到历史记录（每0.1秒存储一次）
    const timeKey = Math.floor(recordingTime * 10) / 10
    if (timeKey >= 0 && buckets.length > 0) {
      waveformBucketsRef.current.set(timeKey, [...buckets])
    }
  }

  // 绘制已录制的波形
  const drawRecordedWaveforms = (ctx: CanvasRenderingContext2D, pixelsPerSecond: number, centerY: number) => {
    ctx.strokeStyle = '#22c55e'
    ctx.fillStyle = 'rgba(34, 197, 94, 0.2)'
    ctx.lineWidth = 1

    Array.from(waveformBucketsRef.current.entries()).forEach(([timeKey, buckets]) => {
      const startX = timeKey * pixelsPerSecond
      
      if (startX >= -100 && startX < width + 100) { // 绘制稍微超出屏幕的部分
        const bucketWidth = Math.max(1, pixelsPerSecond / buckets.length)
        
        buckets.forEach((bucket, index) => {
          const x = startX + (index * bucketWidth)
          
          if (x >= -bucketWidth && x < width + bucketWidth) {
            const maxY = centerY - (bucket.max * (height * 0.4))
            const minY = centerY - (bucket.min * (height * 0.4))
            
            // 填充
            ctx.fillRect(x, Math.min(maxY, centerY), bucketWidth, Math.abs(maxY - minY))
            
            // 轮廓
            ctx.strokeRect(x, Math.min(maxY, minY), bucketWidth, Math.abs(maxY - minY))
          }
        })
      }
    })
  }

  // 启动录音
  const startRecording = async () => {
    try {
      console.log('🎤 启动实时音频录制:', trackId)
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 1
        }
      })

      streamRef.current = stream
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // 确保音频上下文处于运行状态
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
      
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 2048 // 1024个时域样本
      analyserRef.current.smoothingTimeConstant = 0 // 无平滑，获取原始数据
      
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      recordingStartTimeRef.current = currentTime
      audioBufferRef.current = new Float32Array(analyserRef.current.fftSize)

      console.log('✅ 音频录制启动成功, 采样率:', audioContextRef.current.sampleRate)
      
      // 开始动画循环
      const animate = () => {
        drawWaveform()
        if (isRecording && isArmed && analyserRef.current) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }
      animate()

    } catch (error) {
      console.error('❌ 启动录音失败:', error)
      alert('无法访问麦克风，请检查浏览器权限设置')
    }
  }

  // 停止录音
  const stopRecording = () => {
    console.log('🛑 停止录音:', trackId)
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    analyserRef.current = null
    
    // 最后绘制一次，显示最终状态
    drawWaveform()
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
      // 设置实际像素尺寸
      const devicePixelRatio = window.devicePixelRatio || 1
      canvas.width = width * devicePixelRatio
      canvas.height = height * devicePixelRatio
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(devicePixelRatio, devicePixelRatio)
      }
      
      // 设置CSS尺寸
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      
      drawWaveform()
    }
  }, [width, height, drawWaveform])

  // 监听时间变化
  useEffect(() => {
    if (!isRecording) {
      drawWaveform()
    }
  }, [currentTime, drawWaveform])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ 
        background: '#1e293b',
        imageRendering: 'pixelated'
      }}
    />
  )
}
