import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Mic, Upload, Volume2, Monitor } from 'lucide-react';
import { VisualizerMode } from '../types';
import { MODES } from '../constants';

interface Props {
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentMode: VisualizerMode;
  onModeChange: (mode: VisualizerMode) => void;
  onMicEnable: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  volume: number;
  onVolumeChange: (val: number) => void;
  currentTrackName?: string;
  isMicActive: boolean;
}

const Controls: React.FC<Props> = ({
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  currentMode,
  onModeChange,
  onMicEnable,
  onFileUpload,
  volume,
  onVolumeChange,
  currentTrackName,
  isMicActive
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md border-t border-white/10 p-4 text-white z-50">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Track Info & Upload */}
        <div className="flex items-center gap-4 w-full md:w-1/4">
          <label className="cursor-pointer p-2 rounded-full hover:bg-white/10 transition group relative">
            <input type="file" multiple accept="audio/*" onChange={onFileUpload} className="hidden" />
            <Upload size={20} className="text-cyan-400" />
            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 text-xs bg-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">Add Files</span>
          </label>
          <button 
            onClick={onMicEnable}
            className={`p-2 rounded-full hover:bg-white/10 transition relative group ${isMicActive ? 'bg-red-500/20 text-red-400' : 'text-cyan-400'}`}
          >
            <Mic size={20} />
            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 text-xs bg-black px-2 py-1 rounded opacity-0 group-hover:opacity-100">Use Mic</span>
          </button>
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate max-w-[150px]">
              {isMicActive ? 'Microphone Input' : (currentTrackName || 'No Track Selected')}
            </p>
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-6 w-full md:w-1/4 justify-center">
          <button onClick={onPrev} className="hover:text-cyan-400 transition disabled:opacity-50" disabled={isMicActive}>
            <SkipBack size={24} />
          </button>
          <button 
            onClick={onPlayPause} 
            className="w-12 h-12 flex items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full hover:scale-105 transition shadow-lg shadow-cyan-500/30"
          >
            {isPlaying ? <Pause fill="white" /> : <Play fill="white" className="ml-1" />}
          </button>
          <button onClick={onNext} className="hover:text-cyan-400 transition disabled:opacity-50" disabled={isMicActive}>
            <SkipForward size={24} />
          </button>
        </div>

        {/* Right: Volume & Mode */}
        <div className="flex items-center gap-4 w-full md:w-1/3 justify-end">
           <div className="flex items-center gap-2 group">
             <Volume2 size={18} className="text-gray-400" />
             <input 
               type="range" 
               min="0" 
               max="1" 
               step="0.01" 
               value={volume} 
               onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
               className="w-24 accent-cyan-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
             />
           </div>
           
           <div className="h-8 w-[1px] bg-white/10 mx-2"></div>

           <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0">
             {MODES.map((m) => (
               <button
                 key={m.id}
                 onClick={() => onModeChange(m.id)}
                 className={`px-3 py-1 text-xs rounded-full border border-transparent transition whitespace-nowrap
                   ${currentMode === m.id 
                     ? 'bg-white/20 border-white/20 text-white' 
                     : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
               >
                 {m.label}
               </button>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Controls;