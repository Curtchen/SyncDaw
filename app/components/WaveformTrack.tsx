'use client'

import { useEffect, useRef, useState } from 'react'

interface WaveformTrackProps {
  isRecording: boolean
  isArmed: boolean
  trackId: string
  duration: number
  currentTime: number
  height: number
}

export default function WaveformTrack({ 
  isRecording, 
  isArmed,
  trackId, 
  duration, 
  currentTime,
  height 
}: WaveformTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const audioContextRef = useRef<AudioContext>()
  const analyserRef = useRef<AnalyserNode>()
  const microphoneRef = useRef<MediaStreamAudioSourceNode>()
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0)

  useEffect(() => {
    if (isRecording && isArmed) {
      startRecording()
      setRecordingStartTime(currentTime)
    } else {
      stopRecording()
    }

    return () => {
      stopRecording()
    }
  }, [isRecording, isArmed])

  useEffect(() => {
    if (canvasRef.current) {
      drawWaveform()
    }
  }, [waveformData, currentTime, duration, height])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      
      analyserRef.current.fftSize = 512
      analyserRef.current.smoothingTimeConstant = 0.8
      const bufferLength = analyserRef.current.frequencyBinCount
      
      microphoneRef.current.connect(analyserRef.current)
      
      captureAudio()
    } catch (err) {
      console.error('Error accessing microphone:', err)
    }
  }

  const stopRecording = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    
    if (microphoneRef.current) {
      microphoneRef.current.disconnect()
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
    }
  }

  const captureAudio = () => {
    if (!analyserRef.current) return

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    
    analyserRef.current.getByteTimeDomainData(dataArray)
    
    // 计算音频数据的平均值来生成波形
    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      const value = (dataArray[i] - 128) / 128.0
      sum += value * value
    }
    const rms = Math.sqrt(sum / bufferLength)
    const amplitude = rms * 100 // 放大波形
    
    // 将新的振幅数据添加到波形数据中
    setWaveformData(prev => [...prev, amplitude])
    
    animationRef.current = requestAnimationFrame(captureAudio)
  }

  const drawWaveform = () => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const canvasHeight = canvas.height

    // 清空画布
    ctx.clearRect(0, 0, width, canvasHeight)

    if (waveformData.length === 0) return

    // 计算像素每秒
    const pixelsPerSecond = width / duration
    const samplesPerSecond = 10 // 每秒10个采样点
    
    // 绘制波形
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1
    ctx.beginPath()

    for (let i = 0; i < waveformData.length; i++) {
      const x = (recordingStartTime + i / samplesPerSecond) * pixelsPerSecond
      const amplitude = waveformData[i]
      const y1 = canvasHeight / 2 - amplitude
      const y2 = canvasHeight / 2 + amplitude
      
      // 只绘制在当前时间之前的波形
      if (x <= currentTime * pixelsPerSecond) {
        // 绘制正波形
        ctx.moveTo(x, canvasHeight / 2)
        ctx.lineTo(x, y1)
        ctx.moveTo(x, canvasHeight / 2)
        ctx.lineTo(x, y2)
      }
    }
    
    ctx.stroke()

    // 如果正在录制，绘制实时波形指示器
    if (isRecording && isArmed) {
      const currentX = currentTime * pixelsPerSecond
      const currentAmplitude = waveformData[waveformData.length - 1] || 0
      
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(currentX - 1, canvasHeight / 2 - currentAmplitude, 2, currentAmplitude * 2)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={800}
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
