'use client'

import { useEffect, useRef, useState } from 'react'

interface AudioVisualizerProps {
  isRecording: boolean
  trackId: string
  width?: number
  height?: number
  currentTime?: number
  duration?: number
}

export default function AudioVisualizer({ 
  isRecording, 
  trackId, 
  width = 300, 
  height = 48,
  currentTime = 0,
  duration = 60
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const audioContextRef = useRef<AudioContext>()
  const analyserRef = useRef<AnalyserNode>()
  const microphoneRef = useRef<MediaStreamAudioSourceNode>()
  const dataArrayRef = useRef<Uint8Array>()
  const streamRef = useRef<MediaStream>()

  useEffect(() => {
    if (isRecording) {
      startRecording()
    } else {
      stopRecording()
    }

    return () => {
      stopRecording()
    }
  }, [isRecording])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      
      analyserRef.current.fftSize = 512
      const bufferLength = analyserRef.current.frequencyBinCount
      dataArrayRef.current = new Uint8Array(bufferLength)
      
      microphoneRef.current.connect(analyserRef.current)
      
      draw()
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
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
  }

  const draw = () => {
    if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    analyserRef.current.getByteTimeDomainData(dataArrayRef.current)

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, width, height)

    // Draw waveform
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#3b82f6'
    ctx.beginPath()

    const sliceWidth = width / dataArrayRef.current.length
    let x = 0

    for (let i = 0; i < dataArrayRef.current.length; i++) {
      const v = dataArrayRef.current[i] / 128.0
      const y = (v * height) / 2

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      x += sliceWidth
    }

    ctx.stroke()

    if (isRecording) {
      animationRef.current = requestAnimationFrame(draw)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0"
      style={{ 
        width: `${width}px`, 
        height: `${height}px`,
        background: 'transparent'
      }}
    />
  )
}
