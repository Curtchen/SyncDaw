'use client'

import { Volume2, Circle, Headphones, X } from 'lucide-react'
import { useCallback, memo } from 'react'

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
  onRemove?: () => void
  isSelected?: boolean
}

const TrackView = memo(function TrackView({ track, onUpdate, onRemove, isSelected = false }: TrackViewProps) {
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ volume: parseInt(e.target.value) })
  }, [onUpdate])

  const handlePanChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ pan: parseInt(e.target.value) })
  }, [onUpdate])

  const handleArmedToggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onUpdate({ armed: !track.armed })
  }, [track.armed, onUpdate])

  const handleMutedToggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onUpdate({ muted: !track.muted })
  }, [track.muted, onUpdate])

  const handleSoloToggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onUpdate({ solo: !track.solo })
  }, [track.solo, onUpdate])

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onRemove?.()
  }, [onRemove])

  return (
    <div 
      className={`bg-slate-800 border-b border-slate-700 p-3 flex flex-col ${
        isSelected ? 'bg-slate-700' : 'hover:bg-slate-750'
      }`}
      style={{ height: '108px' }}
    >
      {/* Track name at the top */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: track.color }}
          />
          <span className="text-xs font-medium text-white truncate max-w-24">{track.name}</span>
        </div>
        
        {/* Remove button */}
        <button
          onClick={handleRemove}
          className="w-4 h-4 rounded flex items-center justify-center bg-slate-600 hover:bg-red-600 text-slate-400 hover:text-white opacity-60 hover:opacity-100 relative z-10"
          style={{ pointerEvents: 'all' }}
          title="Remove Track"
        >
          <X className="w-2.5 h-2.5 pointer-events-none" />
        </button>
      </div>

      {/* Control buttons row */}
      <div className="flex items-center justify-center gap-1 mb-2">
        <button
          onClick={handleArmedToggle}
          className={`w-6 h-6 rounded flex items-center justify-center relative z-10 transition-colors duration-150 ${
            track.armed ? 'bg-red-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-400'
          }`}
          style={{ pointerEvents: 'all' }}
          title="Record Arm"
        >
          <Circle className="w-3 h-3 pointer-events-none" />
        </button>
        
        <button
          onClick={handleMutedToggle}
          className={`w-6 h-6 rounded flex items-center justify-center relative z-10 transition-colors duration-150 ${
            track.muted ? 'bg-yellow-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-400'
          }`}
          style={{ pointerEvents: 'all' }}
          title="Mute"
        >
          <Volume2 className="w-3 h-3 pointer-events-none" />
        </button>
        
        <button
          onClick={handleSoloToggle}
          className={`w-6 h-6 rounded flex items-center justify-center relative z-10 transition-colors duration-150 ${
            track.solo ? 'bg-blue-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-400'
          }`}
          style={{ pointerEvents: 'all' }}
          title="Solo"
        >
          <Headphones className="w-3 h-3 pointer-events-none" />
        </button>
      </div>

      {/* Volume control */}
      <div className="mb-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 text-xs w-6">Vol</span>
          <div className="flex-1 relative">
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
      </div>

      {/* Pan control */}
      <div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 text-xs w-6">Pan</span>
          <div className="flex-1 relative">
            <input
              type="range"
              min="-100"
              max="100"
              value={track.pan}
              onChange={handlePanChange}
              className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <span className="text-slate-300 text-xs w-6 text-center">
            {track.pan === 0 ? 'C' : track.pan > 0 ? 'R' : 'L'}
          </span>
        </div>
      </div>
    </div>
  )
})

export default TrackView
