'use client'

import { useState, useEffect, useCallback } from 'react'
import { Track } from '../types/track'

interface DAWState {
  isPlaying: boolean
  isRecording: boolean
  currentTime: number
  duration: number
  tracks: Track[]
  bpm: number
  timeSignature: [number, number]
}

export function useDAW() {
  const [state, setState] = useState<DAWState>({
    isPlaying: false,
    isRecording: false,
    currentTime: 0,
    duration: 60,
    bpm: 120,
    timeSignature: [4, 4],
    tracks: [
      {
        id: '1',
        name: 'Track 1',
        type: 'audio',
        volume: 80,
        pan: 0,
        muted: false,
        solo: false,
        armed: true,
        color: '#ff6b35'
      }
    ]
  })

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (state.isPlaying) {
      interval = setInterval(() => {
        setState(prev => ({
          ...prev,
          currentTime: prev.currentTime >= prev.duration ? 0 : prev.currentTime + 0.1
        }))
      }, 100)
    }
    return () => clearInterval(interval)
  }, [state.isPlaying, state.duration])

  const play = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))
  }, [])

  const stop = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }))
  }, [])

  const record = useCallback(() => {
    setState(prev => ({ ...prev, isRecording: !prev.isRecording }))
  }, [])

  const addTrack = useCallback(() => {
    setState(prev => {
      const newTrack: Track = {
        id: (prev.tracks.length + 1).toString(),
        name: `Track ${prev.tracks.length + 1}`,
        type: 'audio',
        volume: 80,
        pan: 0,
        muted: false,
        solo: false,
        armed: false,
        color: `hsl(${Math.random() * 360}, 70%, 60%)`
      }
      return { ...prev, tracks: [...prev.tracks, newTrack] }
    })
  }, [])

  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => 
        track.id === id ? { ...track, ...updates } : track
      )
    }))
  }, [])

  const setCurrentTime = useCallback((time: number) => {
    setState(prev => ({ ...prev, currentTime: time }))
  }, [])

  const pause = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false }))
  }, [])

  const startRecording = useCallback(() => {
    setState(prev => ({ ...prev, isRecording: true }))
  }, [])

  const stopRecording = useCallback(() => {
    setState(prev => ({ ...prev, isRecording: false }))
  }, [])

  const removeTrack = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.filter(track => track.id !== id)
    }))
  }, [])

  const setMasterVolume = useCallback((volume: number) => {
    // Master volume logic would go here
  }, [])

  const getTotalDuration = useCallback(() => {
    return state.duration
  }, [state.duration])

  const seekTo = useCallback((time: number) => {
    setState(prev => ({ ...prev, currentTime: Math.max(0, Math.min(time, prev.duration)) }))
  }, [])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  return {
    ...state,
    masterVolume: 80,
    isInitialized: true,
    audioContext: null,
    masterGain: null,
    play,
    pause,
    stop,
    record,
    startRecording,
    stopRecording,
    addTrack,
    removeTrack,
    updateTrack,
    setCurrentTime,
    setMasterVolume,
    getTotalDuration,
    seekTo,
    formatTime
  }
}
