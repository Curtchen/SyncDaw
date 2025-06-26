'use client'

import { useEffect, useRef, useState } from 'react'

interface SimpleWaveformProps {
  isRecording: boolean
  isArmed: boolean
  trackId: string
  width?: number
  height?: number
}

export default function SimpleWaveform({ 
  isRecording, 
  isArmed,
  trackId, 
  width = 300, 
  height = 40 
}: SimpleWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const [audioLevel, setAudioLevel] = useState(0)

  useEffect(() => {
    if (isRecording && isArmed) {
      startVisualization()
    } else {
      stopVisualization()
    }

    return () => {
      stopVisualization()
    }
  }, [isRecording, isArmed])

  const startVisualization = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.log('MediaDevices not supported')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      const microphone = audioContext.createMediaStreamSource(stream)
      
      analyser.fftSize = 256
      microphone.connect(analyser)
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      
      const animate = () => {
        analyser.getByteFrequencyData(dataArray)
        
        // Calculate average audio level
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setAudioLevel(average)
        
        drawWaveform(dataArray)
        animationRef.current = requestAnimationFrame(animate)
      }
      
      animate()
    } catch (error) {
      console.error('Error accessing microphone:', error)
      // Show a fake animation instead
      startFakeAnimation()
    }
  }

  const startFakeAnimation = () => {
    let time = 0
    const animate = () => {
      time += 0.1
      const fakeLevel = Math.sin(time) * 50 + 50
      setAudioLevel(fakeLevel)
      
      const fakeData = Array.from({ length: 32 }, (_, i) => 
        Math.sin(time + i * 0.3) * 50 + 100
      )
      drawWaveform(new Uint8Array(fakeData))
      
      animationRef.current = requestAnimationFrame(animate)
    }
    animate()
  }

  const stopVisualization = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    setAudioLevel(0)
  }

  const drawWaveform = (dataArray: Uint8Array) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, width, height)

    // Draw waveform
    ctx.strokeStyle = isRecording ? '#ef4444' : '#3b82f6'
    ctx.lineWidth = 2
    ctx.beginPath()

    const sliceWidth = width / dataArray.length
    let x = 0

    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 255.0
      const y = height - (v * height)

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      x += sliceWidth
    }

    ctx.stroke()

    // Draw level indicator
    if (isRecording) {
      const levelHeight = (audioLevel / 255) * height
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'
      ctx.fillRect(0, height - levelHeight, width, levelHeight)
    }
  }

  // Draw static waveform when not recording
  useEffect(() => {
    if (!isRecording && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#1e293b'
      ctx.fillRect(0, 0, width, height)

      // Draw static placeholder waveform
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 1
      ctx.beginPath()

      for (let i = 0; i < width; i += 4) {
        const amplitude = Math.sin(i * 0.02) * 15 + height / 2
        if (i === 0) {
          ctx.moveTo(i, amplitude)
        } else {
          ctx.lineTo(i, amplitude)
        }
      }

      ctx.stroke()
    }
  }, [isRecording, width, height])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded border border-slate-600"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
      {isRecording && (
        <div className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-1 rounded">
          REC
        </div>
      )}
    </div>
  )
}
