'use client'

import { useEffect, useRef } from 'react'

interface TestWaveformProps {
  isRecording: boolean
  isArmed: boolean
  trackId: string
  width: number
  height: number
  currentTime: number
  duration: number
}

export default function TestWaveform({
  isRecording,
  isArmed,
  trackId,
  width,
  height,
  currentTime,
  duration
}: TestWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 存储录音过程中的音频数据历史
  const waveformHistoryRef = useRef<Map<number, number[]>>(new Map())
  // 当前实时音频数据
  const currentWaveformRef = useRef<number[]>([])
  const animationFrameRef = useRef<number>()
  // 音频相关引用
  const audioContextRef = useRef<AudioContext>()
  const analyserRef = useRef<AnalyserNode>()
  const microphoneRef = useRef<MediaStreamAudioSourceNode>()
  const streamRef = useRef<MediaStream>()
  const recordingStartTimeRef = useRef<number>(0)

  useEffect(() => {
    console.log(`🎤 RealTimeWaveform effect - trackId: ${trackId}, isRecording: ${isRecording}, isArmed: ${isArmed}`)
    
    if (isRecording && isArmed) {
      startRealTimeRecording()
    } else {
      stopRealTimeRecording()
    }

    return () => stopRealTimeRecording()
  }, [isRecording, isArmed])

  // 监听canvas尺寸变化，重新绘制
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = width
      canvas.height = height
      draw() // 重新绘制
    }
  }, [width, height])

  const startRealTimeRecording = async () => {
    console.log('🎤 Starting REAL-TIME recording for track', trackId)
    
    try {
      // 请求麦克风权限
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
      
      // 配置analyser用于时域分析
      analyserRef.current.fftSize = 2048  // 获得1024个时域样本点
      analyserRef.current.smoothingTimeConstant = 0 // 不平滑，获得原始数据
      
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      microphoneRef.current.connect(analyserRef.current)
      
      // 清空历史数据
      waveformHistoryRef.current.clear()
      currentWaveformRef.current = []
      recordingStartTimeRef.current = currentTime
      
      console.log('✅ Real-time audio capture started')
      captureRealTimeAudio()
      
    } catch (error) {
      console.error('❌ Error starting real-time recording:', error)
      // 如果获取音频失败，显示错误状态
    }
  }

  const stopRealTimeRecording = () => {
    console.log('🎤 Stopping REAL-TIME recording for track', trackId)
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = undefined
    }
    
    if (microphoneRef.current) {
      microphoneRef.current.disconnect()
      microphoneRef.current = undefined
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = undefined
    }
    
    analyserRef.current = undefined
  }

  const captureRealTimeAudio = () => {
    if (!analyserRef.current || !isRecording || !isArmed) {
      return
    }

    // 获取时域数据
    const bufferLength = analyserRef.current.fftSize
    const timeData = new Float32Array(bufferLength)
    analyserRef.current.getFloatTimeDomainData(timeData)

    // 下采样以适应屏幕显示（每100个样本取一个）
    const samplesPerPixel = Math.max(1, Math.floor(bufferLength / 200))
    const displaySamples: number[] = []
    
    for (let i = 0; i < bufferLength; i += samplesPerPixel) {
      // 计算这个区间内的RMS值
      let sum = 0
      let count = 0
      for (let j = i; j < Math.min(i + samplesPerPixel, bufferLength); j++) {
        sum += timeData[j] * timeData[j]
        count++
      }
      const rms = Math.sqrt(sum / count)
      displaySamples.push(rms)
    }

    // 存储当前波形数据
    currentWaveformRef.current = displaySamples
    
    // 将当前波形存储到历史记录中（以时间为键）
    const recordingTime = currentTime - recordingStartTimeRef.current
    if (recordingTime >= 0) {
      const timeKey = Math.floor(recordingTime * 10) / 10 // 0.1秒精度
      waveformHistoryRef.current.set(timeKey, [...displaySamples])
      
      // 内存管理：限制历史记录大小
      if (waveformHistoryRef.current.size > 300) { // 保持30秒的历史
        const oldestKey = Math.min(...Array.from(waveformHistoryRef.current.keys()))
        waveformHistoryRef.current.delete(oldestKey)
      }
    }

    // 实时绘制
    draw()

    // 继续捕获
    if (isRecording && isArmed) {
      animationFrameRef.current = requestAnimationFrame(captureRealTimeAudio)
    }
  }

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear with solid background
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)

    // Draw center line
    const centerY = height / 2
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()

    if (isRecording && isArmed) {
      // 绘制实时音频波形
      const currentTime = new Date().getTime()
      const recordingDuration = (currentTime - recordingStartTimeRef.current) / 1000
      
      // 绘制历史波形数据
      ctx.strokeStyle = '#22c55e'
      ctx.fillStyle = 'rgba(34, 197, 94, 0.2)'
      ctx.lineWidth = 1

      // 计算时间窗口 - 显示最近的录音数据
      const pixelsPerSecond = width / Math.max(duration, 10) // 至少显示10秒
      
      // 绘制所有历史波形
      Array.from(waveformHistoryRef.current.entries()).forEach(([timeKey, samples]) => {
        const x = timeKey * pixelsPerSecond
        if (x >= 0 && x < width) {
          // 为每个时间点绘制波形
          ctx.beginPath()
          for (let i = 0; i < samples.length; i++) {
            const sampleX = x + (i / samples.length) * (pixelsPerSecond * 0.1) // 0.1秒的宽度
            const amplitude = samples[i]
            const y = centerY - (amplitude * height * 0.4)
            
            if (i === 0) {
              ctx.moveTo(sampleX, y)
            } else {
              ctx.lineTo(sampleX, y)
            }
          }
          ctx.stroke()
        }
      })

      // 绘制当前实时数据（在最右侧）
      if (currentWaveformRef.current.length > 0) {
        ctx.strokeStyle = '#10b981'
        ctx.lineWidth = 2
        
        const currentX = recordingDuration * pixelsPerSecond
        ctx.beginPath()
        
        for (let i = 0; i < currentWaveformRef.current.length; i++) {
          const x = currentX + (i / currentWaveformRef.current.length) * 20 // 当前数据占用20像素宽度
          const amplitude = currentWaveformRef.current[i]
          const y = centerY - (amplitude * height * 0.4)
          
          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
      }

      // 显示录音状态
      ctx.fillStyle = '#22c55e'
      ctx.font = '12px monospace'
      ctx.textAlign = 'right'
      const historyCount = waveformHistoryRef.current.size
      const currentSamples = currentWaveformRef.current.length
      ctx.fillText(`● RECORDING - History: ${historyCount}, Current: ${currentSamples}`, width - 10, 20)
      
    } else if (!isRecording && isArmed) {
      // Show armed state
      ctx.fillStyle = '#22c55e'
      ctx.font = '16px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('● ARMED - Ready to Record (REAL AUDIO)', width / 2, centerY)
    } else if (!isArmed) {
      // Show disarmed state
      ctx.fillStyle = '#64748b'
      ctx.font = '14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Track not armed - Click record button to arm', width / 2, centerY)
    }
    
    // 绘制当前时间指示器（红色进度条）
    const timelineX = (currentTime / duration) * width
    if (timelineX >= 0 && timelineX <= width) {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(timelineX, 0)
      ctx.lineTo(timelineX, height)
      ctx.stroke()
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 w-full h-full"
      style={{ 
        width: `${width}px`, 
        height: `${height}px`
      }}
    />
  )
}
