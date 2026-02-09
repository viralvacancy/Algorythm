import React from 'react';
import { Pause, Play, SkipBack, SkipForward, Volume2, Waves } from 'lucide-react';
import { VisualizerMode } from '../types';
import { MODES } from '../constants';

interface Props {
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentMode: VisualizerMode;
  onModeChange: (mode: VisualizerMode) => void;
  volume: number;
  onVolumeChange: (val: number) => void;
  currentTrackName?: string;
  isMicActive: boolean;
}

const ControlDock: React.FC<Props> = ({
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  currentMode,
  onModeChange,
  volume,
  onVolumeChange,
  currentTrackName,
  isMicActive
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4">
      <div className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-black/70 p-4 backdrop-blur-xl shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-purple-500/20">
              <Waves className="text-cyan-200" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                Now Playing
              </p>
              <p className="text-lg font-semibold text-white">
                {isMicActive ? 'Live Microphone' : (currentTrackName || 'No track loaded')}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={onPrev}
              className="rounded-full border border-white/10 p-3 text-white/70 transition hover:text-white hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isMicActive}
            >
              <SkipBack size={20} />
            </button>
            <button
              onClick={onPlayPause}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 text-white shadow-lg shadow-cyan-500/40 transition hover:scale-105"
            >
              {isPlaying ? <Pause fill="white" /> : <Play fill="white" className="ml-1" />}
            </button>
            <button
              onClick={onNext}
              className="rounded-full border border-white/10 p-3 text-white/70 transition hover:text-white hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isMicActive}
            >
              <SkipForward size={20} />
            </button>
          </div>

          <div className="flex flex-col gap-3 md:w-72">
            <label className="text-xs uppercase tracking-[0.3em] text-white/50">Mode</label>
            <div className="flex flex-wrap gap-2">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onModeChange(mode.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    currentMode === mode.id
                      ? 'border-cyan-300/50 bg-cyan-500/20 text-cyan-100'
                      : 'border-white/10 text-white/60 hover:border-white/40 hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Volume2 size={18} className="text-white/50" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-cyan-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlDock;
