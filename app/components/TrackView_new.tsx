'use client'

import { Volume2, Circle, Headphones, X } from 'lucide-react'

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

interface TrackViewProps {
  track: Track
  onUpdate: (updates: Partial<Track>) => void
  isSelected?: boolean
}

export default function TrackView({ track, onUpdate, isSelected = false }: TrackViewProps) {
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ volume: parseInt(e.target.value) })
  }

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ pan: parseInt(e.target.value) })
  }

  return (
    <div 
      className={`bg-slate-800 border-b border-slate-700 p-2 flex flex-col justify-center ${
        isSelected ? 'bg-slate-700' : 'hover:bg-slate-750'
      }`}
      style={{ height: '80px' }}
    >
      {/* Top row - Track name and controls */}
      <div className="flex items-center justify-between mb-1.5">
        {/* Left side - Track color and name */}
        <div className="flex items-center gap-2">
          <div 
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: track.color }}
          />
          <span className="text-sm font-medium text-white">{track.name}</span>
        </div>

        {/* Right side - Control buttons */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onUpdate({ armed: !track.armed })}
            className={`w-5 h-5 rounded-sm flex items-center justify-center ${
              track.armed ? 'bg-red-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-400'
            }`}
            title="Record Arm"
          >
            <Circle className="w-2.5 h-2.5" />
          </button>
          
          <button
            onClick={() => onUpdate({ muted: !track.muted })}
            className={`w-5 h-5 rounded-sm flex items-center justify-center ${
              track.muted ? 'bg-yellow-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-400'
            }`}
            title="Mute"
          >
            <Volume2 className="w-2.5 h-2.5" />
          </button>
          
          <button
            onClick={() => onUpdate({ solo: !track.solo })}
            className={`w-5 h-5 rounded-sm flex items-center justify-center ${
              track.solo ? 'bg-blue-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-400'
            }`}
            title="Solo"
          >
            <Headphones className="w-2.5 h-2.5" />
          </button>
          
          <button
            className="w-5 h-5 rounded-sm flex items-center justify-center bg-slate-600 hover:bg-slate-500 text-slate-400"
            title="Remove Track"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Bottom row - Volume and Pan controls */}
      <div className="flex items-center gap-4 text-xs">
        {/* Volume */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-xs w-6">Vol</span>
          <div className="relative w-16">
            <input
              type="range"
              min="0"
              max="100"
              value={track.volume}
              onChange={handleVolumeChange}
              className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <span className="text-slate-300 text-xs w-6 text-right">{track.volume}</span>
        </div>

        {/* Pan */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-xs w-6">Pan</span>
          <div className="relative w-12">
            <input
              type="range"
              min="-100"
              max="100"
              value={track.pan}
              onChange={handlePanChange}
              className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <span className="text-slate-300 text-xs w-4 text-center">
            {track.pan === 0 ? 'C' : track.pan > 0 ? 'R' : 'L'}
          </span>
        </div>
      </div>
    </div>
  )
}
