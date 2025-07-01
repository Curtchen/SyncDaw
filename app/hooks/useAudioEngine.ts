'use client'

import { useEffect, useRef, useState } from 'react'
import { AudioEngine, AudioTrack } from '../lib/audio-engine'

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine>()
  const [isInitialized, setIsInitialized] = useState(false)
  const [masterVolume, setMasterVolume] = useState(80)

  useEffect(() => {
    const initEngine = async () => {
      try {
        console.log('🚀 Starting audio engine initialization...')
        engineRef.current = new AudioEngine()
        await engineRef.current.initialize()
        setIsInitialized(true)
        console.log('✅ Audio engine initialization completed')
      } catch (error) {
        console.error('❌ Audio engine initialization failed:', error)
        setIsInitialized(false)
        
        // 在一些情况下（特别是Edge），我们可能需要等待用户交互
        if (error instanceof Error && error.message.includes('suspended')) {
          console.log('⏳ AudioContext suspended - waiting for user interaction')
          
          // 监听用户交互，然后重试初始化
          const retryInit = async () => {
            try {
              if (engineRef.current) {
                await engineRef.current.initialize()
                setIsInitialized(true)
                console.log('✅ Audio engine initialized after user interaction')
              }
            } catch (retryError) {
              console.error('❌ Audio engine retry failed:', retryError)
            }
          }

          const handleUserInteraction = () => {
            retryInit()
            document.removeEventListener('click', handleUserInteraction)
            document.removeEventListener('keydown', handleUserInteraction)
          }

          document.addEventListener('click', handleUserInteraction, { once: true })
          document.addEventListener('keydown', handleUserInteraction, { once: true })
        }
      }
    }

    initEngine()

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose()
      }
    }
  }, [])

  const createTrack = (id: string): AudioTrack | null => {
    if (!engineRef.current) return null
    return engineRef.current.createTrack(id)
  }

  const getTrack = (id: string): AudioTrack | undefined => {
    return engineRef.current?.getTrack(id)
  }

  const removeTrack = (id: string) => {
    engineRef.current?.removeTrack(id)
  }

  const updateMasterVolume = (volume: number) => {
    setMasterVolume(volume)
    engineRef.current?.setMasterVolume(volume)
  }

  const getMaxTrackDuration = (): number => {
    return engineRef.current?.getMaxTrackDuration() || 0
  }

  const getAllTrackDurations = (): { [trackId: string]: number } => {
    return engineRef.current?.getAllTrackDurations() || {}
  }

  return {
    isInitialized,
    masterVolume,
    createTrack,
    getTrack,
    removeTrack,
    setMasterVolume: updateMasterVolume,
    getMaxTrackDuration,
    getAllTrackDurations,
    audioEngine: engineRef.current
  }
}
