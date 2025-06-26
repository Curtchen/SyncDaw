'use client'

import { Volume2, Circle, Headphones, Mic, Settings } from 'lucide-react'

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

interface TrackControlPanelProps {
  track: Track
  onUpdate: (updates: Partial<Track>) => void
  isSelected?: boolean
}

export default function TrackControlPanel({ track, onUpdate, isSelected = false }: TrackControlPanelProps) {
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ volume: parseInt(e.target.value) })
  }

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ pan: parseInt(e.target.value) })
  }

  return (
    <div className={`flex items-center gap-3 p-3 border-b border-slate-700 ${
      isSelected ? 'bg-slate-700' : 'bg-slate-800 hover:bg-slate-750'
    }`}>
      {/* Track color indicator */}
      <div 
        className="w-4 h-4 rounded-full border border-slate-600"
        style={{ backgroundColor: track.color }}
      />
      
      {/* Track name */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white truncate">
          {track.name}
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-1">
        {/* Record arm */}
        <button
          onClick={() => onUpdate({ armed: !track.armed })}
          className={`p-1.5 rounded ${
            track.armed 
              ? 'bg-red-600 text-white' 
              : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
          }`}
          title="Record Arm"
        >
          <Circle className="w-3 h-3" />
        </button>

        {/* Mute */}
        <button
          onClick={() => onUpdate({ muted: !track.muted })}
          className={`p-1.5 rounded ${
            track.muted 
              ? 'bg-yellow-600 text-white' 
              : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
          }`}
          title="Mute"
        >
          <Volume2 className="w-3 h-3" />
        </button>

        {/* Solo */}
        <button
          onClick={() => onUpdate({ solo: !track.solo })}
          className={`p-1.5 rounded ${
            track.solo 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
          }`}
          title="Solo"
        >
          <Headphones className="w-3 h-3" />
        </button>
      </div>

      {/* Volume slider */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-slate-400 w-6">Vol</span>
        <div className="relative flex-1 min-w-16">
          <input
            type="range"
            min="0"
            max="100"
            value={track.volume}
            onChange={handleVolumeChange}
            className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
        <span className="text-xs text-slate-400 w-6 text-right">{track.volume}</span>
      </div>

      {/* Pan knob */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 w-6">Pan</span>
        <div className="relative">
          <input
            type="range"
            min="-100"
            max="100"
            value={track.pan}
            onChange={handlePanChange}
            className="w-12 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
        <span className="text-xs text-slate-400 w-4 text-center">
          {track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}
        </span>
      </div>

      {/* Settings */}
      <button
        className="p-1.5 bg-slate-600 hover:bg-slate-500 text-slate-300 rounded"
        title="Track Settings"
      >
        <Settings className="w-3 h-3" />
      </button>
    </div>
  )
}
