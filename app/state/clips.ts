import { create } from 'zustand'
import { Clip } from '../types/clip'

interface ClipState {
  clips: Clip[]
  addClip: (clip: Clip) => void
  removeClip: (id: string) => void
  updateClip: (id: string, updates: Partial<Clip>) => void
  getClipsByTrack: (trackId: string) => Clip[]
  replaceClipForTrack: (trackId: string, clip: Clip) => void
}

export const useClips = create<ClipState>((set, get) => ({
  clips: [],
  addClip: (clip) => set(state => ({ clips: [...state.clips, clip] } as Partial<ClipState>)),
  removeClip: (id) => set(state => ({ clips: state.clips.filter(c => c.id !== id) } as Partial<ClipState>)),
  updateClip: (id, updates) => set(state => ({ clips: state.clips.map(c => c.id === id ? { ...c, ...updates } : c) } as Partial<ClipState>)),
  getClipsByTrack: (trackId) => get().clips.filter(c => c.trackId === trackId),
  replaceClipForTrack: (trackId, clip) => set(state => ({ clips: [...state.clips.filter(c => c.trackId !== trackId), clip] }))
})) 