'use client'

import { useEffect, useRef } from 'react'

interface LiveWaveformProps {
  isRecording: boolean
  isArmed: boolean
  trackId: string
  currentTime: number
  duration: number
  width: number
  height: number
}

export default function LiveWaveform({
  isRecording,
  isArmed, // 可以忽略 track arm
  trackId,
  currentTime,
  duration,
  width,
  height
}: LiveWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const waveformPeaksRef = useRef<number[]>([])

  useEffect(() => {
    let animationId: number
    let stream: MediaStream

    if (isRecording) {
      // 开始录音时清空已有峰值
      waveformPeaksRef.current = []
      ;(async () => {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        audioCtxRef.current = audioCtx
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })

        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        analyserRef.current = analyser

        const draw = () => {
          const canvas = canvasRef.current
          if (!canvas || !analyserRef.current) return
          const ctx = canvas.getContext('2d')
          if (!ctx) return

          // 滚动画布内容，向左移动1像素
          ctx.drawImage(canvas, 1, 0, width - 1, height, 0, 0, width - 1, height)
          // 清除右侧新列背景
          ctx.fillStyle = '#1e293b'
          ctx.fillRect(width - 1, 0, 1, height)
          // 获取新的时域样本峰值
          const data = new Uint8Array(analyserRef.current.fftSize)
          analyserRef.current.getByteTimeDomainData(data)
          let peak = 0
          for (let i = 0; i < data.length; i++) {
            const v = Math.abs((data[i] - 128) / 128)
            if (v > peak) peak = v
          }
          // 绘制新列波形
          const centerY = height / 2
          const halfH = height / 2
          const y1 = centerY - peak * halfH
          const y2 = centerY + peak * halfH
          ctx.fillStyle = '#22c55e'
          ctx.fillRect(width - 1, y1, 1, y2 - y1)

          // 绘制播放头
          const playX = (currentTime / duration) * width
          ctx.strokeStyle = '#ef4444'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(playX, 0)
          ctx.lineTo(playX, height)
          ctx.stroke()

          animationId = requestAnimationFrame(draw)
        }
        draw()
      })()
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      if (audioCtxRef.current) audioCtxRef.current.close()
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [isRecording, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  )
}
