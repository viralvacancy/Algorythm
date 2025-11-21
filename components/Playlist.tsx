import React, { useState } from 'react';
import { Track } from '../types';
import { Music, X, Menu, Trash2 } from 'lucide-react';

interface Props {
  playlist: Track[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Playlist: React.FC<Props> = ({ playlist, currentIndex, onSelect, onRemove, isOpen, setIsOpen }) => {
  
  return (
    <>
      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-50 p-3 bg-black/50 backdrop-blur border border-white/10 rounded-full text-white hover:bg-white/10 transition"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-black/90 backdrop-blur-xl border-l border-white/10 z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-cyan-400">
            <Music size={24} /> Playlist
          </h2>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {playlist.length === 0 ? (
              <div className="text-gray-500 text-center mt-10 text-sm">
                No tracks added.<br/>Use the upload button in the footer.
              </div>
            ) : (
              playlist.map((track, index) => (
                <div 
                  key={track.id}
                  className={`group p-3 rounded-lg border flex justify-between items-center transition cursor-pointer
                    ${index === currentIndex 
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-white' 
                      : 'bg-white/5 border-transparent hover:bg-white/10 text-gray-300'}`}
                  onClick={() => onSelect(index)}
                >
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium truncate">{track.name}</span>
                    <span className="text-xs opacity-50">Local Audio</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                    className="opacity-0 group-hover:opacity-100 p-2 hover:text-red-400 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/10 text-xs text-center text-gray-500">
            {playlist.length} Tracks • Algorythm v1.0
          </div>
        </div>
      </div>
    </>
  );
};

export default Playlist;