export type ClipType = 'audio' | 'midi'

export interface BaseClip {
  id: string
  trackId: string
  type: ClipType
  start: number // seconds
  duration: number // seconds
}

export interface AudioClip extends BaseClip {
  type: 'audio'
  buffer: AudioBuffer
}

export interface MidiNote {
  time: number // seconds from clip start
  duration: number // seconds
  midi: number // 0-127
  velocity: number // 0-1
}

export interface MidiClip extends BaseClip {
  type: 'midi'
  notes: MidiNote[]
}

export type Clip = AudioClip | MidiClip 