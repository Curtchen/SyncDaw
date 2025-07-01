export type TrackType = 'audio' | 'instrument' | 'midi' | 'automation' | 'group'

export interface Track {
  id: string
  name: string
  type: TrackType
  color: string
  volume: number   // 0-100 for UI, convert to 0-1 in engine
  pan: number      // -100 (Left) ~ 100 (Right)
  muted: boolean
  solo: boolean
  armed: boolean
} 