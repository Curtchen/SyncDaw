'use client'

import { useEffect, useRef } from 'react'

interface RealTimeWaveformProps {
  isRecording: boolean
  isArmed: boolean
  trackId: string
  width: number
  height: number
  currentTime: number
  duration: number
}

export default function RealTimeWaveform({
  isRecording,
  isArmed,
  trackId,
  width,
  height,
  currentTime,
  duration
}: RealTimeWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationIdRef = useRef<number | null>(null)
  
  // 存储波形数据 - 像素级存储
  const waveformDataRef = useRef<number[]>([])
  // 存储波形数据 - 每像素最小值和最大值
  const minDataRef = useRef<number[]>([])
  const maxDataRef = useRef<number[]>([])
  const lastRecordedXRef = useRef<number>(-1)
  const lastTimeRef = useRef<number>(0)

  useEffect(() => {
    if (isRecording && isArmed) {
      startRecording()
    } else {
      stopRecording()
    }

    return () => stopRecording()
  }, [isRecording, isArmed])

  // 当录音状态改变时重置数据
  useEffect(() => {
    if (isRecording && isArmed) {
      // 录音开始时清空之前的数据
      minDataRef.current = new Array(width).fill(0)
      maxDataRef.current = new Array(width).fill(0)
      lastRecordedXRef.current = -1
      console.log('🔴 Recording started - data reset')
    }
  }, [isRecording, isArmed, width])

  const startRecording = async () => {
    console.log('🎤 Starting real-time waveform recording...')
    
    try {
      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      })
      
      streamRef.current = stream
      
      // 创建音频上下文
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // 创建分析器
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 2048  // 适中的FFT size
      analyserRef.current.smoothingTimeConstant = 0.1  // 轻微的平滑处理
      
      // 连接音频源
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      
      // 清空之前的数据
      waveformDataRef.current = new Array(width).fill(0)
      lastRecordedXRef.current = -1
      
      console.log('✅ Audio setup complete, starting DAW-style visualization...')
      console.log(`📊 FFT Size: ${analyserRef.current.fftSize}, Buffer Length: ${analyserRef.current.frequencyBinCount}`)
      
      // 开始绘制循环
      draw()
      
    } catch (error) {
      console.error('❌ Error accessing microphone:', error)
      // 如果麦克风访问失败，启动测试模式
      startTestMode()
    }
  }

  const stopRecording = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current)
      animationIdRef.current = null
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  const startTestMode = () => {
    console.log('🧪 Starting test mode...')
    waveformDataRef.current = new Array(width).fill(0)
    lastRecordedXRef.current = -1
    drawTestMode()
  }

  const drawTestMode = () => {
    if (!isRecording || !isArmed) return
    
    const playheadX = Math.floor((currentTime / duration) * width)
    
    // 在播放头当前位置生成测试波形数据
    if (playheadX >= 0 && playheadX < width) {
      // 生成复合测试波形（模拟真实DAW录音）
      const time = currentTime
      const fundamental = 0.4 * Math.sin(2 * Math.PI * 220 * time)  // 220Hz 基频
      const harmonic1 = 0.2 * Math.sin(2 * Math.PI * 440 * time)    // 440Hz 二次谐波
      const harmonic2 = 0.1 * Math.sin(2 * Math.PI * 880 * time)    // 880Hz 三次谐波
      const noise = (Math.random() - 0.5) * 0.1  // 噪声成分
      
      // 添加音量包络（模拟自然衰减）
      const envelope = Math.max(0.1, 1 - (time % 4) * 0.2)  // 每4秒一个循环
      
      const waveValue = (fundamental + harmonic1 + harmonic2 + noise) * envelope
      waveformDataRef.current[playheadX] = Math.max(-1, Math.min(1, waveValue))
      
      // 增加波形密度，在相邻像素也填充数据
      const density = 3  // 每个时间点填充3个像素
      for (let i = 1; i < density && playheadX + i < width; i++) {
        const variation = (Math.random() - 0.5) * 0.3
        waveformDataRef.current[playheadX + i] = Math.max(-1, Math.min(1, waveValue * 0.8 + variation))
      }
      
      console.log(`🧪 DAW Test wave at ${playheadX}: ${waveValue.toFixed(3)}, envelope: ${envelope.toFixed(2)}`)
    }
    
    renderWaveform()
    
    if (isRecording && isArmed) {
      animationIdRef.current = requestAnimationFrame(drawTestMode)
    }
  }

  const draw = () => {
    if (!analyserRef.current || !isRecording || !isArmed) return
    // 获取时域音频数据
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteTimeDomainData(dataArray)
    const playheadX = Math.floor((currentTime / duration) * width)
    // 计算本帧最小/最大值
    let minSample = 1
    let maxSample = -1
    for (let i = 0; i < dataArray.length; i++) {
      const sample = (dataArray[i] - 128) / 128
      minSample = Math.min(minSample, sample)
      maxSample = Math.max(maxSample, sample)
    }
    // 记录到对应像素
    if (playheadX >= 0 && playheadX < width) {
      minDataRef.current[playheadX] = minSample
      maxDataRef.current[playheadX] = maxSample
      lastRecordedXRef.current = playheadX
    }
    renderWaveform()
    if (isRecording && isArmed) {
      animationIdRef.current = requestAnimationFrame(draw)
    }
  }

  const renderWaveform = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    canvas.width = width
    canvas.height = height
    
    // 清空画布 - 深色背景
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)
    
    // 绘制中心线
    const centerY = height / 2
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()
    
    // 计算播放头位置
    const playheadX = (currentTime / duration) * width
    
    // 绘制已录制的波形（橙色，类似Amped Studio）
    ctx.strokeStyle = '#ff8c00'
    ctx.lineWidth = 1
    for (let x = 0; x < Math.min(width, Math.floor((currentTime / duration) * width)); x++) {
      const minSample = minDataRef.current[x] || 0
      const maxSample = maxDataRef.current[x] || 0
      const yMin = centerY - (minSample * height * 0.4)
      const yMax = centerY - (maxSample * height * 0.4)
      ctx.beginPath()
      ctx.moveTo(x, yMin)
      ctx.lineTo(x, yMax)
      ctx.stroke()
    }
    
    // 绘制播放头（白色竖线，类似Amped Studio）
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, height)
    ctx.stroke()
    
    // 绘制录音指示器
    if (isRecording && isArmed) {
      ctx.fillStyle = '#ff0000'
      ctx.beginPath()
      ctx.arc(playheadX, centerY, 2, 0, 2 * Math.PI)
      ctx.fill()
    }
    
    // 显示状态信息
    ctx.fillStyle = '#888888'
    ctx.font = '10px Arial'
    ctx.fillText(`${isRecording ? 'REC' : 'STOP'} | ${Math.floor(playheadX)}/${width}px`, 5, 15)
  }

  useEffect(() => {
    if (waveformDataRef.current.length !== width) {
      waveformDataRef.current = new Array(width).fill(0)
    }
    renderWaveform()
  }, [width, height])

  useEffect(() => {
    if (!isRecording) {
      renderWaveform()
    }
  }, [currentTime])

  return (
    <canvas
      ref={canvasRef}
      style={{ 
        width: `${width}px`, 
        height: `${height}px`,
        display: 'block'
      }}
    />
  )
}
