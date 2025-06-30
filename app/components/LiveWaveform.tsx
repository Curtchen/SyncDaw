'use client'

import { useEffect, useRef } from 'react'

interface LiveWaveformProps {
  isRecording: boolean
  trackId: string
  currentTime: number
  duration: number
  width: number
  height: number
}

export default function LiveWaveform(props: LiveWaveformProps) {
  const { width, height } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioResourcesRef = useRef<{
    audioCtx: AudioContext
    analyser: AnalyserNode
    stream: MediaStream
    dataArray: Uint8Array
  } | null>(null)
  const peaksRef = useRef<number[]>([])
  const animationFrameIdRef = useRef<number | null>(null)
  const isAudioInitializedRef = useRef(false)

  // Use a ref to store the latest props, so the animation loop can access them
  // without being a dependency of the useEffect that starts the loop.
  const propsRef = useRef(props)
  propsRef.current = props

  // Effect for audio initialization - only when recording starts
  useEffect(() => {
    let isActive = true

    const initAudio = async () => {
      if (!props.isRecording) {
        // Clean up audio when not recording
        if (audioResourcesRef.current) {
          audioResourcesRef.current.stream.getTracks().forEach(t => t.stop())
          audioResourcesRef.current.audioCtx.close()
          audioResourcesRef.current = null
          isAudioInitializedRef.current = false
          console.log('🛑 Audio cleaned up')
        }
        return
      }

      // Only initialize audio when recording starts
      if (props.isRecording && !audioResourcesRef.current) {
        try {
          console.log('🎤 Initializing audio for recording...')
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
          
          // Resume audio context if suspended (required by some browsers)
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume()
          }
          
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              sampleRate: 44100
            }
          })
          
          if (!isActive || !props.isRecording) {
            stream.getTracks().forEach(t => t.stop())
            await audioCtx.close()
            return
          }
          
          const source = audioCtx.createMediaStreamSource(stream)
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 2048
          analyser.smoothingTimeConstant = 0.1
          source.connect(analyser)
          const dataArray = new Uint8Array(analyser.frequencyBinCount)

          audioResourcesRef.current = { audioCtx, analyser, stream, dataArray }
          isAudioInitializedRef.current = true
          
          // Clear previous waveform data when starting new recording
          peaksRef.current = new Array(width).fill(0)
          
          console.log('✅ Audio initialized successfully for recording')
        } catch (e) {
          console.error('❌ Error initializing audio:', e)
          isAudioInitializedRef.current = false
          alert('无法访问麦克风，请检查权限设置并确保没有其他应用在使用麦克风')
        }
      }
    }

    initAudio()

    return () => {
      isActive = false
      if (!props.isRecording && audioResourcesRef.current) {
        audioResourcesRef.current.stream.getTracks().forEach(t => t.stop())
        audioResourcesRef.current.audioCtx.close()
        audioResourcesRef.current = null
        isAudioInitializedRef.current = false
      }
    }
  }, [props.isRecording, width])

  // Effect for drawing loop
  useEffect(() => {
    // Initialize or resize peaks array when width changes
    peaksRef.current = new Array(width).fill(0)

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const { isRecording, currentTime, duration, width, height } = propsRef.current
      const audioResources = audioResourcesRef.current

      // Sample and update peaks if recording
      if (isRecording && audioResources && isAudioInitializedRef.current) {
        const { analyser, dataArray } = audioResources
        analyser.getByteTimeDomainData(dataArray)
        let peak = 0
        for (let i = 0; i < dataArray.length; i++) {
          const v = Math.abs((dataArray[i] - 128) / 128)
          if (v > peak) peak = v
        }
        const idx = Math.floor((currentTime / duration) * width)
        if (idx >= 0 && idx < width) {
          // Always update the peak to show real-time audio
          peaksRef.current[idx] = Math.max(peaksRef.current[idx], peak)
          
          // Debug: log peak values occasionally
          if (Math.random() < 0.01) { // 1% chance to log
            console.log(`Peak at x=${idx}: ${peak.toFixed(3)}`)
          }
        }
      }

      // --- Drawing ---
      // Clear canvas
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(0, 0, width, height)

      // Draw waveform
      const centerY = height / 2
      const halfH = height / 2
      ctx.fillStyle = '#22c55e'
      peaksRef.current.forEach((p, x) => {
        if (p > 0) {
          const y1 = centerY - p * halfH
          const h = p * halfH * 2
          ctx.fillRect(x, y1, 1, Math.max(1, h))
        }
      })

      // Draw playhead
      const playX = (currentTime / duration) * width
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playX, 0)
      ctx.lineTo(playX, height)
      ctx.stroke()

      // Draw status info for debugging
      if (isRecording && isAudioInitializedRef.current) {
        ctx.fillStyle = '#22c55e'
        ctx.font = '12px monospace'
        ctx.fillText('● RECORDING', 10, 20)
      } else if (isRecording && !isAudioInitializedRef.current) {
        ctx.fillStyle = '#f59e0b'
        ctx.font = '12px monospace'
        ctx.fillText('⏳ INITIALIZING...', 10, 20)
      } else if (!isRecording) {
        ctx.fillStyle = '#6b7280'
        ctx.font = '12px monospace'
        ctx.fillText('⏸ STOPPED', 10, 20)
      }

      animationFrameIdRef.current = requestAnimationFrame(draw)
    }

    // Start the drawing loop
    draw()

    return () => {
      // Stop the drawing loop when the effect cleans up
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [width, height]) // Re-run only on resize

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  )
}
