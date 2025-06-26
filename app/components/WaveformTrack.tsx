'use client'

import { useEffect, useRef } from 'react'

interface WaveformTrackProps {
  isRecording: boolean
  isArmed: boolean
  trackId: string
  duration: number
  currentTime: number
  height: number
  width: number
}

export default function WaveformTrack({ 
  trackId,
  isRecording, 
  isArmed,
  currentTime,
  duration,
  width,
  height 
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
   
  useEffect(() => {
    // reset data and start/stop audio capture
    if (isRecording && isArmed) {
      // initialize per-pixel storage
      minDataRef.current = new Array(width).fill(0)
      maxDataRef.current = new Array(width).fill(0)
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
      analyserRef.current.smoothingTimeConstant = 0.8
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
    const elapsed = audioContextRef.current.currentTime - recordStartRef.current
    const playheadX = Math.floor((elapsed / duration) * width)
    if (playheadX >= 0 && playheadX < width) {
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
    canvas.width = width
    canvas.height = height
    const centerY = height / 2

    // background
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)
    // 绘制已录制的波形（像素最小/最大值）
    const amplitudeScale = height * 0.8  // 增加高度占比，更明显
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2  // 加粗线条
    ctx.globalAlpha = 0.8  // 降低透明度，波形更清晰
    // 根据状态选择绘制范围：录制时到 lastRecordedX，否则到当前时间的像素
    const endX = isRecording ? lastRecordedXRef.current : Math.floor((currentTime / duration) * width)
    for (let x = 0; x <= endX; x++) {
      const yMin = centerY - (minDataRef.current[x] || 0) * amplitudeScale
      const yMax = centerY - (maxDataRef.current[x] || 0) * amplitudeScale
      ctx.beginPath()
      ctx.moveTo(x, yMin)
      ctx.lineTo(x, yMax)
      ctx.stroke()
    }
    ctx.globalAlpha = 1.0  // 恢复不透明度
    // draw playhead / indicator
    const playX = isRecording ? lastRecordedXRef.current : Math.floor((currentTime / duration) * width)
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(playX, 0); ctx.lineTo(playX, height); ctx.stroke()
    if (isRecording) {
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(playX, centerY, 2, 0, 2 * Math.PI); ctx.fill()
    }
    // optional status
    ctx.fillStyle = '#888888'
    ctx.font = '10px Arial'
    ctx.fillText(`${isRecording ? 'REC' : ''}`, 5, 12)
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
