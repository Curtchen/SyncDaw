'use client'

import { useEffect, useRef } from 'react'

interface Props {
  isRecording: boolean
  isArmed: boolean
  width: number
  height: number
  currentTime: number   // 全局播放头时间（秒）
  duration: number      // 预计录音总时长（秒）
}

export default function RealTimeWaveform ({
  isRecording,
  isArmed,
  width,
  height,
  currentTime,
  duration
}: Props) {
  const canvasRef       = useRef<HTMLCanvasElement | null>(null)
  const ctxRef          = useRef<CanvasRenderingContext2D | null>(null)

  const audioCtxRef     = useRef<AudioContext | null>(null)
  const streamRef       = useRef<MediaStream | null>(null)
  const workletRef      = useRef<AudioWorkletNode | null>(null)

  /** 每个像素位置的 min / max（-1 → 1） */
  const minArrRef = useRef<Float32Array>(new Float32Array(width).fill(0))
  const maxArrRef = useRef<Float32Array>(new Float32Array(width).fill(0))
  const lastXRef  = useRef<number>(-1)

  /* ---------- 录音开关 ---------- */
  useEffect(() => {
    if (isRecording && isArmed) {
      initAudio().catch(console.error)
    } else {
      cleanup()
    }
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, isArmed])

  /* ---------- 大小变化时重新分配数组 ---------- */
  useEffect(() => {
    minArrRef.current = new Float32Array(width).fill(0)
    maxArrRef.current = new Float32Array(width).fill(0)
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  /* ---------- 停止录音后，依旧根据 currentTime 重绘播放头 ---------- */
  useEffect(draw, [currentTime]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- 初始化 Audio & Worklet ---------- */
  async function initAudio () {
    if (audioCtxRef.current) return                       // 已在录

    // 1. 麦克风流
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream

    // 2. AudioContext
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    await ctx.resume()
    audioCtxRef.current = ctx

    // 3. Worklet
    await ctx.audioWorklet.addModule('/waveform-processor.js')
    const worklet = new AudioWorkletNode(ctx, 'waveform-processor')
    worklet.port.onmessage = (ev) => {
      const { time, min, max } = ev.data as { time: number; min: number; max: number }
      updateWaveform(time, min, max)
    }
    workletRef.current = worklet

    // 4. 连接节点
    const src = ctx.createMediaStreamSource(stream)
    const mute = ctx.createGain()
    mute.gain.value = 0                                   // 静音，避免回放
    src.connect(worklet).connect(mute).connect(ctx.destination)

    console.log('🎙  audio worklet started')
  }

  /* ---------- 更新波形数组 ---------- */
  function updateWaveform (time: number, min: number, max: number) {
    if (!duration) return
    const x = Math.floor((time / duration) * width)
    if (x < 0 || x >= width) return

    minArrRef.current[x] = Math.min(minArrRef.current[x] || 0, min)
    maxArrRef.current[x] = Math.max(maxArrRef.current[x] || 0, max)
    lastXRef.current = Math.max(lastXRef.current, x)

    draw()
  }

  /* ---------- 绘制 ---------- */
  function draw () {
    const canvas = canvasRef.current
    if (!canvas) return

    // Hi‑DPI 处理
    const dpr = window.devicePixelRatio || 1
    canvas.width  = width  * dpr
    canvas.height = height * dpr
    canvas.style.width  = `${width}px`
    canvas.style.height = `${height}px`

    let ctx = ctxRef.current
    if (!ctx) {
      ctx = canvas.getContext('2d')!
      ctxRef.current = ctx
    }
    ctx.save()
    ctx.scale(dpr, dpr)

    // 背景
    ctx.clearRect(0, 0, width, height)

    const minArr = minArrRef.current
    const maxArr = maxArrRef.current
    const lastX  = lastXRef.current
    if (lastX < 1) {                        // 暂无有效数据
      ctx.restore()
      return
    }

    const midY = height / 2
    const amp  = height * 0.48              // 缩放系数

    /* ---- 填充包络带 ---- */
    ctx.beginPath()
    ctx.moveTo(0, midY - (maxArr[0] ?? 0) * amp)
    for (let x = 1; x <= lastX; x++) {
      ctx.lineTo(x, midY - (maxArr[x] ?? 0) * amp)
    }
    for (let x = lastX; x >= 0; x--) {
      ctx.lineTo(x, midY - (minArr[x] ?? 0) * amp)
    }
    ctx.closePath()
    ctx.fillStyle = '#3fa0ff'
    ctx.fill()

    /* ---- 播放头 —— 红线 ---- */
    const playX = Math.floor((currentTime / duration) * width)
    ctx.strokeStyle = '#ff4d4f'
    ctx.lineWidth   = 1 / dpr
    ctx.beginPath()
    ctx.moveTo(playX + 0.5, 0)
    ctx.lineTo(playX + 0.5, height)
    ctx.stroke()

    ctx.restore()
  }

  /* ---------- 清理资源 ---------- */
  function cleanup () {
    workletRef.current?.disconnect()
    workletRef.current?.port.close()
    workletRef.current = null

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null

    audioCtxRef.current?.close()
    audioCtxRef.current = null
  }

  return <canvas ref={canvasRef} />
}