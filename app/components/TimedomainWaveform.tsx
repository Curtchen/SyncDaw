'use client'

import { useEffect, useRef } from 'react'

interface TimedomainWaveformProps {
  isRecording: boolean
  isArmed: boolean
  trackId: string
  width: number
  height: number
  currentTime: number
  duration: number
}

export default function TimedomainWaveform({
  isRecording,
  isArmed,
  trackId,
  width,
  height,
  currentTime,
  duration
}: TimedomainWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext>()
  const analyserRef = useRef<AnalyserNode>()
  const microphoneRef = useRef<MediaStreamAudioSourceNode>()
  const streamRef = useRef<MediaStream>()
  const animationFrameRef = useRef<number>()
  
  // 存储完整的时域波形数据 - 每个时间点存储一个样本数组
  const waveformBufferRef = useRef<Map<number, Float32Array>>(new Map())
  const recordingStartTimeRef = useRef<number>(0)

  useEffect(() => {
    if (isRecording && isArmed) {
      recordingStartTimeRef.current = currentTime
      startRecording()
    } else {
      stopRecording()
    }

    return () => stopRecording()
  }, [isRecording, isArmed])

  // 绘制循环
  useEffect(() => {
    draw()
    
    if (isRecording && isArmed) {
      const drawLoop = () => {
        draw()
        animationFrameRef.current = requestAnimationFrame(drawLoop)
      }
      animationFrameRef.current = requestAnimationFrame(drawLoop)
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRecording, isArmed, currentTime, width, height])

  const startRecording = async () => {
    console.log('🎤 Starting timedomain waveform recording for track', trackId)
    
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.error('❌ getUserMedia not supported')
        startTestMode()
        return
      }
      
      // 创建音频上下文
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      })
      
      streamRef.current = stream
      
      // 创建分析器节点 - 专门用于时域分析
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 4096 // 更大的FFT获得更好的时域分辨率
      analyserRef.current.smoothingTimeConstant = 0.0 // 不平滑
      
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      microphoneRef.current.connect(analyserRef.current)
      
      // 清除之前的数据
      waveformBufferRef.current.clear()
      
      console.log('✅ Timedomain recording started with fftSize:', analyserRef.current.fftSize)
      captureTimeDomainData()
    } catch (err) {
      console.error('❌ Error starting timedomain recording:', err)
      startTestMode()
    }
  }

  const captureTimeDomainData = () => {
    if (!analyserRef.current || !isRecording) return
    
    const bufferLength = analyserRef.current.fftSize
    const dataArray = new Float32Array(bufferLength)
    
    const capture = () => {
      if (!analyserRef.current || !isRecording) return
      
      // 获取时域数据（这是真正的音频波形！）
      analyserRef.current.getFloatTimeDomainData(dataArray)
      
      // 计算当前相对于录音开始的时间
      const relativeTime = currentTime - recordingStartTimeRef.current
      
      if (relativeTime >= 0) {
        // 将整个时域数据存储起来，精确到0.01秒
        const timeKey = Math.floor(relativeTime * 100) / 100
        
        // 复制数据（因为dataArray会被重用）
        const waveformSlice = new Float32Array(dataArray)
        waveformBufferRef.current.set(timeKey, waveformSlice)
        
        // 内存管理 - 只保留最近的数据
        if (waveformBufferRef.current.size > 500) { // 约5秒的数据
          const oldestKey = Math.min(...Array.from(waveformBufferRef.current.keys()))
          waveformBufferRef.current.delete(oldestKey)
        }
        
        // 调试输出
        const rms = Math.sqrt(dataArray.reduce((sum, val) => sum + val * val, 0) / dataArray.length)
        if (waveformBufferRef.current.size % 50 === 0) {
          console.log(`🎵 Captured timedomain data: ${waveformBufferRef.current.size} chunks, RMS: ${rms.toFixed(4)}`)
        }
      }
      
      // 继续捕获
      if (isRecording) {
        setTimeout(capture, 10) // 每10ms捕获一次，获得高时间分辨率
      }
    }
    
    capture()
  }

  const startTestMode = () => {
    console.log('🧪 Starting test mode for timedomain waveform')
    
    const generateTestWaveform = () => {
      if (!isRecording) return
      
      const relativeTime = currentTime - recordingStartTimeRef.current
      if (relativeTime >= 0) {
        const timeKey = Math.floor(relativeTime * 100) / 100
        
        // 生成测试时域波形数据
        const testSamples = new Float32Array(1024)
        for (let i = 0; i < testSamples.length; i++) {
          const t = relativeTime + (i / 44100) // 模拟44.1kHz采样率
          // 生成复合波形：基频 + 谐波 + 噪声
          const wave = 0.3 * Math.sin(2 * Math.PI * 440 * t) +      // 440Hz基频
                      0.2 * Math.sin(2 * Math.PI * 880 * t) +      // 第二谐波
                      0.1 * Math.sin(2 * Math.PI * 1320 * t) +     // 第三谐波
                      0.05 * (Math.random() - 0.5)                 // 噪声
          testSamples[i] = wave
        }
        
        waveformBufferRef.current.set(timeKey, testSamples)
        
        // 内存管理
        if (waveformBufferRef.current.size > 500) {
          const oldestKey = Math.min(...Array.from(waveformBufferRef.current.keys()))
          waveformBufferRef.current.delete(oldestKey)
        }
      }
      
      if (isRecording) {
        setTimeout(generateTestWaveform, 10)
      }
    }
    
    generateTestWaveform()
  }

  const stopRecording = () => {
    console.log('🛑 Stopping timedomain recording for track', trackId)
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = undefined
    }
    
    if (microphoneRef.current) {
      microphoneRef.current.disconnect()
      microphoneRef.current = undefined
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = undefined
    }
  }

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // 设置canvas分辨率
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    
    // 清除画布
    ctx.fillStyle = '#1e293b' // slate-800
    ctx.fillRect(0, 0, width, height)
    
    // 绘制中心线
    ctx.strokeStyle = '#475569' // slate-600
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()
    
    // 如果没有录音数据，显示状态信息
    if (waveformBufferRef.current.size === 0) {
      ctx.fillStyle = isArmed ? '#22c55e' : '#64748b'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(
        isArmed ? (isRecording ? 'Recording...' : 'Ready to record') : 'Arm track to record',
        width / 2,
        height / 2 + 4
      )
      return
    }
    
    // 绘制时域波形
    ctx.strokeStyle = '#22c55e' // green-500
    ctx.lineWidth = 1
    ctx.beginPath()
    
    const centerY = height / 2
    const amplitudeScale = height * 0.4 // 40%的高度作为最大振幅
    let hasFirstPoint = false
    
    // 按时间顺序处理所有波形数据
    const sortedTimes = Array.from(waveformBufferRef.current.keys()).sort((a, b) => a - b)
    
    for (const relativeTime of sortedTimes) {
      const waveformSlice = waveformBufferRef.current.get(relativeTime)
      if (!waveformSlice) continue
      
      // 计算这个时间段在canvas上的起始x位置
      const absoluteTime = recordingStartTimeRef.current + relativeTime
      const startX = (absoluteTime / duration) * width
      
      // 只处理可见范围内的数据
      if (startX > width || startX + (width / duration) < 0) continue
      
      // 对波形数据进行下采样以适应显示宽度
      const samplesPerPixel = Math.max(1, Math.floor(waveformSlice.length / (width / 10)))
      
      for (let i = 0; i < waveformSlice.length; i += samplesPerPixel) {
        const sample = waveformSlice[i]
        
        // 计算这个样本在时间轴上的位置
        const sampleTime = absoluteTime + (i / waveformSlice.length) * 0.01 // 假设每个chunk是0.01秒
        const x = (sampleTime / duration) * width
        
        // 只绘制在可见范围内的样本
        if (x >= 0 && x <= width) {
          const y = centerY - (sample * amplitudeScale)
          
          if (!hasFirstPoint) {
            ctx.moveTo(x, y)
            hasFirstPoint = true
          } else {
            ctx.lineTo(x, y)
          }
        }
      }
    }
    
    ctx.stroke()
    
    // 绘制当前播放位置指示器
    if (isRecording) {
      const playheadX = (currentTime / duration) * width
      if (playheadX >= 0 && playheadX <= width) {
        ctx.strokeStyle = '#ef4444' // red-500
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(playheadX, 0)
        ctx.lineTo(playheadX, height)
        ctx.stroke()
        
        // 录音指示点
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(playheadX, centerY, 3, 0, 2 * Math.PI)
        ctx.fill()
      }
    }
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ 
        width: `${width}px`, 
        height: `${height}px`,
        display: 'block'
      }}
      className="bg-slate-800 rounded"
    />
  )
}
