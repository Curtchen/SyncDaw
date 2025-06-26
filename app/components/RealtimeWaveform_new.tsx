'use client'

import { useRef, useEffect, useCallback } from 'react'

interface RealtimeWaveformProps {
  trackId: string
  isRecording: boolean
  isArmed: boolean
  currentTime: number
  duration: number
  width?: number
  height?: number
}

export default function RealtimeWaveform({ 
  trackId, 
  isRecording, 
  isArmed, 
  currentTime, 
  duration,
  width = 800,
  height = 80
}: RealtimeWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>()
  const audioContextRef = useRef<AudioContext>()
  const analyserRef = useRef<AnalyserNode>()
  const microphoneRef = useRef<MediaStreamAudioSourceNode>()
  const streamRef = useRef<MediaStream>()
  const waveformDataRef = useRef<Map<number, number>>(new Map())

  // 清理函数
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = undefined
    }

    if (microphoneRef.current) {
      microphoneRef.current.disconnect()
      microphoneRef.current = undefined
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = undefined
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = undefined
    }

    analyserRef.current = undefined
    waveformDataRef.current.clear()
  }, [])

  // 开始音频采集
  const startCapture = useCallback(async () => {
    try {
      console.log(`🎵 Starting waveform capture for track ${trackId}`)
      console.log(`🎵 Recording state: ${isRecording}, Armed state: ${isArmed}`)
      
      // 强制清理之前的资源
      cleanup()
      
      // 检查浏览器支持
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ getUserMedia not supported in this browser')
        return
      }
      
      // 请求麦克风权限
      console.log('🎤 Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        } 
      })
      streamRef.current = stream
      console.log('✅ Microphone access granted')

      // 创建AudioContext - 使用用户交互确保激活
      console.log('🔊 Creating AudioContext...')
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      console.log(`🔊 AudioContext state: ${audioContextRef.current.state}`)
      
      // 强制恢复AudioContext
      if (audioContextRef.current.state === 'suspended') {
        console.log('🔊 Resuming AudioContext...')
        await audioContextRef.current.resume()
        console.log(`🔊 AudioContext resumed, new state: ${audioContextRef.current.state}`)
      }

      // 等待AudioContext完全激活
      if (audioContextRef.current.state !== 'running') {
        console.log('⏰ Waiting for AudioContext to become running...')
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('AudioContext timeout')), 5000)
          const checkState = () => {
            if (audioContextRef.current?.state === 'running') {
              clearTimeout(timeout)
              resolve(undefined)
            } else {
              setTimeout(checkState, 100)
            }
          }
          checkState()
        })
      }

      // 创建分析器
      console.log('📊 Creating analyser...')
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 2048
      analyserRef.current.smoothingTimeConstant = 0.1 // 更快的响应
      console.log(`📊 Analyser created, buffer length: ${analyserRef.current.frequencyBinCount}`)

      // 连接麦克风
      console.log('🔌 Connecting microphone to analyser...')
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      microphoneRef.current.connect(analyserRef.current)

      console.log(`✅ Audio capture initialized for track ${trackId}`)
      console.log(`🎵 Starting waveform drawing loop...`)
      
      // 立即开始绘制循环
      drawWaveform()
      
      // 测试音频数据
      setTimeout(() => {
        if (analyserRef.current) {
          const testArray = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteTimeDomainData(testArray)
          const hasData = testArray.some(val => val !== 128)
          console.log(`🔬 Audio data test: ${hasData ? 'DATA DETECTED' : 'NO DATA'}, Sample: [${testArray.slice(0, 5).join(',')}]`)
        }
      }, 1000)
      
    } catch (error) {
      console.error(`❌ Failed to start audio capture for track ${trackId}:`, error)
      // 显示具体的错误信息
      if (error instanceof Error) {
        console.error(`❌ Error details: ${error.name} - ${error.message}`)
      }
    }
  }, [trackId, isRecording, isArmed, cleanup])

  // 绘制波形
  const drawWaveform = useCallback(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 设置canvas尺寸
    canvas.width = width
    canvas.height = height

    // 清空canvas
    ctx.fillStyle = '#0f172a' // slate-900
    ctx.fillRect(0, 0, width, height)

    // 绘制中心线
    ctx.strokeStyle = '#334155' // slate-700
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()

    if (isRecording && isArmed && analyserRef.current) {
      // 获取当前音频数据
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyserRef.current.getByteTimeDomainData(dataArray)

      // 计算RMS值
      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128
        sum += normalized * normalized
      }
      const rms = Math.sqrt(sum / bufferLength)
      const amplitude = Math.min(rms * 4, 1) // 放大并限制

      // 将振幅数据存储到当前时间位置
      const timeKey = Math.floor(currentTime * 10) // 0.1秒精度
      waveformDataRef.current.set(timeKey, amplitude)

      // 更详细的调试信息，但减少频率
      if (timeKey % 5 === 0) { // 每0.5秒输出一次
        console.log(`🎵 Track ${trackId} - Time: ${currentTime.toFixed(1)}s, Amplitude: ${amplitude.toFixed(3)}, RMS: ${rms.toFixed(3)}, Data points: ${waveformDataRef.current.size}`)
        console.log(`🎵 Raw audio sample: [${Array.from(dataArray.slice(0, 5)).join(',')}]`)
      }
    }

    // 绘制历史波形数据
    ctx.strokeStyle = '#10b981' // green-500
    ctx.fillStyle = 'rgba(16, 185, 129, 0.3)' // green-500 透明
    ctx.lineWidth = 2

    const pixelsPerSecond = width / duration
    const sortedEntries = Array.from(waveformDataRef.current.entries()).sort((a, b) => a[0] - b[0])
    
    if (sortedEntries.length > 0) {
      ctx.beginPath()
      let pathStarted = false
      
      // 绘制上半部分波形
      for (const [timeKey, amplitude] of sortedEntries) {
        const time = timeKey / 10 // 转回秒
        const x = time * pixelsPerSecond
        
        if (x >= 0 && x <= width) {
          const centerY = height / 2
          const amplitudePixels = amplitude * (height / 2) * 0.8 // 80%的高度用于波形
          const topY = centerY - amplitudePixels
          
          if (!pathStarted) {
            ctx.moveTo(x, topY)
            pathStarted = true
          } else {
            ctx.lineTo(x, topY)
          }
        }
      }
      
      // 绘制下半部分波形（镜像）
      for (let i = sortedEntries.length - 1; i >= 0; i--) {
        const [timeKey, amplitude] = sortedEntries[i]
        const time = timeKey / 10
        const x = time * pixelsPerSecond
        
        if (x >= 0 && x <= width) {
          const centerY = height / 2
          const amplitudePixels = amplitude * (height / 2) * 0.8
          const bottomY = centerY + amplitudePixels
          ctx.lineTo(x, bottomY)
        }
      }
      
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }

    // 绘制当前录音位置指示器
    if (isRecording && isArmed) {
      const currentX = currentTime * pixelsPerSecond
      if (currentX >= 0 && currentX <= width) {
        ctx.strokeStyle = '#ef4444' // red-500
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(currentX, 0)
        ctx.lineTo(currentX, height)
        ctx.stroke()
      }
    }

    // 继续动画循环
    if (isRecording && isArmed) {
      animationFrameRef.current = requestAnimationFrame(drawWaveform)
    }
  }, [width, height, duration, currentTime, isRecording, isArmed, trackId])

  // 监听录音状态变化
  useEffect(() => {
    console.log(`🎵 Track ${trackId} - Effect triggered: isRecording=${isRecording}, isArmed=${isArmed}`)
    
    if (isRecording && isArmed) {
      console.log(`🎵 Track ${trackId} - Starting capture...`)
      startCapture()
    } else {
      console.log(`🎵 Track ${trackId} - Cleaning up...`)
      cleanup()
    }

    return cleanup
  }, [isRecording, isArmed, startCapture, cleanup, trackId])

  // 监听时间变化，重绘波形
  useEffect(() => {
    if (!isRecording && canvasRef.current) {
      // 非录音状态下也要绘制已有的波形数据
      drawWaveform()
    }
  }, [currentTime, drawWaveform, isRecording])

  // 组件卸载时清理
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full bg-slate-900 rounded"
        style={{ height: `${height}px` }}
      />
      
      {/* 调试信息 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-1 left-1 text-xs text-slate-400 bg-black bg-opacity-50 px-1 rounded">
          T{trackId}: {isRecording && isArmed ? 'REC' : 'IDLE'} | 
          Data: {waveformDataRef.current.size} | 
          Time: {currentTime.toFixed(1)}s |
          Audio: {audioContextRef.current?.state || 'none'}
        </div>
      )}
      
      {/* 麦克风权限测试按钮 */}
      {process.env.NODE_ENV === 'development' && !audioContextRef.current && (
        <button 
          onClick={startCapture}
          className="absolute top-1 right-1 bg-blue-600 text-white px-2 py-1 rounded text-xs"
        >
          Test Mic
        </button>
      )}
    </div>
  )
}
