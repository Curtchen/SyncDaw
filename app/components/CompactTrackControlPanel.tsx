'use client'

import { Volume2, VolumeX, Headphones, Circle, X } from 'lucide-react'

interface Track {
  id: string
  name: string
  volume: number
  pan: number
  muted: boolean
  solo: boolean
  armed: boolean
  color: string
}

interface CompactTrackControlPanelProps {
  track: Track
  onUpdate: (updates: Partial<Track>) => void
  onTrackUpdate?: (updates: Partial<Track>) => void
  onStartRecording?: () => void
  onStopRecording?: () => void
  onRemoveTrack?: () => void
  isSelected?: boolean
}

export default function CompactTrackControlPanel({ 
  track, 
  onUpdate,
  onTrackUpdate,
  onStartRecording,
  onStopRecording,
  onRemoveTrack,
  isSelected = false 
}: CompactTrackControlPanelProps) {
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updates = { volume: parseInt(e.target.value) }
    onUpdate?.(updates)
    onTrackUpdate?.(updates)
  }

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updates = { pan: parseInt(e.target.value) }
    onUpdate?.(updates)
    onTrackUpdate?.(updates)
  }

  const handleMute = () => {
    const updates = { muted: !track.muted }
    onUpdate?.(updates)
    onTrackUpdate?.(updates)
  }

  const handleSolo = () => {
    const updates = { solo: !track.solo }
    onUpdate?.(updates)
    onTrackUpdate?.(updates)
  }

  const handleArm = () => {
    const updates = { armed: !track.armed }
    onUpdate?.(updates)
    onTrackUpdate?.(updates)
  }

  return (
    <div className={`flex items-center gap-2 p-2 border-b border-slate-700 ${
      isSelected ? 'bg-slate-700' : 'bg-slate-800 hover:bg-slate-750'
    }`}>
      {/* Track color indicator */}
      <div 
        className="w-3 h-3 rounded-full border border-slate-600"
        style={{ backgroundColor: track.color }}
      />
      
      {/* Track name */}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-white truncate">
          {track.name}
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-1">
        {/* Record arm */}
        <button
          onClick={handleArm}
          className={`p-1 rounded ${
            track.armed 
              ? 'bg-red-600 text-white' 
              : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
          }`}
          title="Record Arm"
        >
          <Circle className="w-2.5 h-2.5" />
        </button>

        {/* Mute */}
        <button
          onClick={handleMute}
          className={`p-1 rounded ${
            track.muted 
              ? 'bg-yellow-600 text-white' 
              : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
          }`}
          title="Mute"
        >
          <Volume2 className="w-2.5 h-2.5" />
        </button>

        {/* Solo */}
        <button
          onClick={handleSolo}
          className={`p-1 rounded ${
            track.solo 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
          }`}
          title="Solo"
        >
          <Headphones className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Volume slider */}
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-xs text-slate-400">Vol</span>
        <div className="relative flex-1 min-w-12">
          <input
            type="range"
            min="0"
            max="100"
            value={track.volume}
            onChange={handleVolumeChange}
            className="w-12 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
        <span className="text-xs text-slate-400 w-4 text-right">{track.volume}</span>
      </div>

      {/* Pan knob */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-400">Pan</span>
        <div className="relative">
          <input
            type="range"
            min="-100"
            max="100"
            value={track.pan}
            onChange={handlePanChange}
            className="w-8 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
        <span className="text-xs text-slate-400 w-2 text-center">
          {track.pan === 0 ? 'C' : track.pan > 0 ? 'R' : 'L'}
        </span>
      </div>
    </div>
  )
}
