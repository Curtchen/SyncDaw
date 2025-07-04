'use client'

import { useEffect, useRef } from 'react'

// 在props接口中添加可选的幅度缩放参数
interface WaveformTrackProps {
  isRecording: boolean
  isArmed: boolean
  trackId: string
  duration: number
  currentTime: number
  viewportStart?: number
  viewportDuration?: number
  height: number
  width: number
  amplitudeScale?: number  // 波形幅度缩放，0-1之间
  shouldClearData?: boolean // 是否应该清空数据（通常在stop时触发）
}

export default function WaveformTrack({ 
  trackId,
  isRecording, 
  isArmed,
  currentTime,
  duration,
  viewportStart = 0,
  viewportDuration = 30,
  width,
  height,
  amplitudeScale = 1,    // 默认100%灵敏度
  shouldClearData = false // 默认不清空数据
}: WaveformTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const audioContextRef = useRef<AudioContext>()
  const analyserRef = useRef<AnalyserNode>()
  const microphoneRef = useRef<MediaStreamAudioSourceNode>()
  
  // 改为基于时间的全局数据存储 - 每秒存储100个采样点 (高精度)
  const SAMPLES_PER_SECOND = 100
  const globalMinDataRef = useRef<Map<number, number>>(new Map()) // key: 时间索引, value: min值
  const globalMaxDataRef = useRef<Map<number, number>>(new Map()) // key: 时间索引, value: max值
  
  // 记录第一次录音开始的时间点，后续录音不重置
  const firstRecordingStartRef = useRef<number | null>(null)
  // 记录当前录音session的开始时间
  const currentRecordingStartRef = useRef<number | null>(null)
  
  // keep latest props for non-reactive loops
  const propsRef = useRef({ currentTime, duration, width, viewportStart, viewportDuration, isRecording, isArmed })
  propsRef.current = { currentTime, duration, width, viewportStart, viewportDuration, isRecording, isArmed }

  useEffect(() => {
    // reset data and start/stop audio capture
    if (isRecording && isArmed) {
      startRecording()
    } else {
      stopRecording()
      // 如果停止录音，但不清除数据，保持波形可见
    }

    return () => {
      stopRecording()
    }
  }, [isRecording, isArmed])

  // 监听清空数据请求
  useEffect(() => {
    if (shouldClearData) {
      // 清空所有录音数据
      globalMinDataRef.current.clear()
      globalMaxDataRef.current.clear()
      firstRecordingStartRef.current = null
      currentRecordingStartRef.current = null
      // 重新绘制以清空画布
      drawWaveform()
    }
  }, [shouldClearData])

  useEffect(() => {
    // redraw whenever timeline updates or viewport changes
    drawWaveform()
  }, [currentTime, duration, width, height, viewportStart, viewportDuration])

  // 移除视口滚动时的数据平移逻辑，因为我们现在使用全局时间存储

  const startRecording = async () => {
    try {
      // 只在第一次录音时记录起始时间，后续录音不重置
      if (firstRecordingStartRef.current === null) {
        firstRecordingStartRef.current = propsRef.current.currentTime
      }
      
      // 记录当前录音session的开始时间
      currentRecordingStartRef.current = propsRef.current.currentTime
      
      // 不清除之前的数据，支持叠加录音
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current.fftSize = 2048
      analyserRef.current.smoothingTimeConstant = 0.2
      microphoneRef.current.connect(analyserRef.current)
      
      // 立即采集第一个数据点，确保波形从录音开始时刻就有数据
      const startTime = currentRecordingStartRef.current
      const timeIndex = Math.floor(startTime * SAMPLES_PER_SECOND)
      globalMinDataRef.current.set(timeIndex, 0) // 初始静音状态
      globalMaxDataRef.current.set(timeIndex, 0)
      
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
    
    // 不重置 recordingStartTimeRef，保持历史记录
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
    
    // 将数据存储到基于时间的全局数组中
    const { currentTime: curT } = propsRef.current
    const timeIndex = Math.floor(curT * SAMPLES_PER_SECOND) // 当前时间对应的采样索引
    
    globalMinDataRef.current.set(timeIndex, minSample)
    globalMaxDataRef.current.set(timeIndex, maxSample)
    
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
    
    const { viewportStart: vpStart, viewportDuration: vpDuration, currentTime } = propsRef.current
    const amp = (rect.height / 2) * amplitudeScale
    
    // 如果还没有开始录音或没有数据，直接返回
    if (firstRecordingStartRef.current === null || globalMinDataRef.current.size === 0) return
    
    // 计算实际的绘制范围：从录音开始到当前时间（如果在录音中）
    const recordStart = firstRecordingStartRef.current
    const recordEnd = isRecording ? currentTime : Math.max(...Array.from(globalMinDataRef.current.keys())) / SAMPLES_PER_SECOND
    
    // 计算视口和录音数据的交集
    const drawStart = Math.max(vpStart, recordStart)
    const drawEnd = Math.min(vpStart + vpDuration, recordEnd)
    
    if (drawStart >= drawEnd) return // 没有交集
    
    // 计算绘制范围内的采样点
    const startIndex = Math.floor(drawStart * SAMPLES_PER_SECOND)
    const endIndex = Math.floor(drawEnd * SAMPLES_PER_SECOND)
    
    // 收集数据点，对于缺失的点使用0值
    const dataPoints: Array<{timeIndex: number, minValue: number, maxValue: number}> = []
    
    for (let timeIndex = startIndex; timeIndex <= endIndex; timeIndex++) {
      const time = timeIndex / SAMPLES_PER_SECOND
      // 只处理录音范围内的时间
      if (time >= recordStart && time <= recordEnd) {
        let minValue = globalMinDataRef.current.get(timeIndex) ?? 0
        let maxValue = globalMaxDataRef.current.get(timeIndex) ?? 0
        dataPoints.push({ timeIndex, minValue, maxValue })
      }
    }
    
    if (dataPoints.length === 0) return
    
    // 绘制波形
    ctx.beginPath()
    
    // 绘制上包络线（max值）
    dataPoints.forEach((point, index) => {
      const time = point.timeIndex / SAMPLES_PER_SECOND
      const x = ((time - vpStart) / vpDuration) * drawWidth
      const y = centerY - point.maxValue * amp
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    
    // 绘制下包络线（min值）- 反向
    for (let i = dataPoints.length - 1; i >= 0; i--) {
      const point = dataPoints[i]
      const time = point.timeIndex / SAMPLES_PER_SECOND
      const x = ((time - vpStart) / vpDuration) * drawWidth
      const y = centerY - point.minValue * amp
      ctx.lineTo(x, y)
    }
    
    ctx.closePath()
    ctx.fillStyle = 'rgba(59,130,246,1)'  // 半透明填充
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
        imageRendering: 'auto'
      }}
    />
  )
}
