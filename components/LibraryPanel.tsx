import React from 'react';
import { Mic, Music2, Trash2, Upload, X, Menu } from 'lucide-react';
import { Track } from '../types';

interface Props {
  playlist: Track[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMicEnable: () => void;
  isMicActive: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const LibraryPanel: React.FC<Props> = ({
  playlist,
  currentIndex,
  onSelect,
  onRemove,
  onFileUpload,
  onMicEnable,
  isMicActive,
  isOpen,
  setIsOpen
}) => {
  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-50 rounded-full border border-white/10 bg-black/40 p-3 text-white backdrop-blur transition hover:border-white/30"
      >
        {isOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <aside
        className={`fixed left-0 top-0 z-40 h-full w-[320px] transform border-r border-white/10 bg-black/80 backdrop-blur-xl transition duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">Library</p>
              <h2 className="text-2xl font-semibold text-white">Sources</h2>
            </div>
            <div className={`rounded-full border px-3 py-1 text-xs ${isMicActive ? 'border-red-400/50 text-red-200' : 'border-white/10 text-white/50'}`}>
              {isMicActive ? 'Mic Live' : 'File Mode'}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:border-cyan-400/50 hover:text-white">
              <Upload size={18} className="text-cyan-300" />
              <span>Upload audio files</span>
              <input type="file" multiple accept="audio/*" onChange={onFileUpload} className="hidden" />
            </label>

            <button
              onClick={onMicEnable}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                isMicActive
                  ? 'border-red-400/50 bg-red-500/10 text-red-100'
                  : 'border-white/10 bg-white/5 text-white/80 hover:border-cyan-400/50 hover:text-white'
              }`}
            >
              <Mic size={18} className={isMicActive ? 'text-red-200' : 'text-cyan-300'} />
              <span>{isMicActive ? 'Microphone active' : 'Use microphone input'}</span>
            </button>
          </div>

          <div className="mt-8 flex-1 overflow-hidden">
            <div className="mb-3 flex items-center gap-2 text-sm text-white/60">
              <Music2 size={16} />
              <span>{playlist.length} Tracks</span>
            </div>

            <div className="space-y-2 overflow-y-auto pr-2">
              {playlist.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">
                  Drop in some audio files to begin your session.
                </div>
              ) : (
                playlist.map((track, index) => (
                  <button
                    key={track.id}
                    onClick={() => onSelect(index)}
                    className={`group flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      index === currentIndex
                        ? 'border-cyan-400/50 bg-cyan-500/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{track.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-white/40">Local</span>
                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemove(index);
                        }}
                        className="rounded-full p-1 text-white/40 transition hover:text-red-300"
                      >
                        <Trash2 size={14} />
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/50">
            Tip: For FLAC files, use local file upload to keep decoding accurate and responsive.
          </div>
        </div>
      </aside>
    </>
  );
};

export default LibraryPanel;
