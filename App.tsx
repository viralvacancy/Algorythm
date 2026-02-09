import React, { useState, useEffect, useRef } from 'react';
import { AudioEngine } from './services/AudioEngine';
import VisualizerCanvas from './components/VisualizerCanvas';
import ControlDock from './components/ControlDock';
import LibraryPanel from './components/LibraryPanel';
import { Track, VisualizerMode } from './types';

const App: React.FC = () => {
  const [audioEngine] = useState(() => new AudioEngine());
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [mode, setMode] = useState<VisualizerMode>(VisualizerMode.Spectrogram);
  const [isMicActive, setIsMicActive] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Ref to the actual HTML Audio Element
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio Ref
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";

    const handleEnded = () => {
      handleNext();
    };
    
    audioRef.current.addEventListener('ended', handleEnded);
    return () => {
      audioRef.current?.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Update Audio Engine Volume
  useEffect(() => {
    audioEngine.setVolume(volume);
    if (audioRef.current) {
        audioRef.current.volume = volume;
    }
  }, [volume, audioEngine]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newTracks: Track[] = Array.from(e.target.files).map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        url: URL.createObjectURL(file),
      }));

      setPlaylist((prev) => {
        // If this is the first upload, start playing the first new track
        if (prev.length === 0 && newTracks.length > 0) {
           setTimeout(() => playTrack(0, newTracks), 100);
        }
        return [...prev, ...newTracks];
      });

      // Open library panel on first upload
      if (playlist.length === 0) setIsLibraryOpen(true);
    }
  };

  const playTrack = (index: number, tracks = playlist) => {
    if (index < 0 || index >= tracks.length) return;
    if (!audioRef.current) return;

    setHasInteracted(true);
    setIsMicActive(false);
    setCurrentTrackIndex(index);
    
    const track = tracks[index];
    audioRef.current.src = track.url;
    
    // Connect Audio Element to Engine
    audioEngine.connectAudioElement(audioRef.current);
    
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(e => console.error("Playback failed:", e));
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    setHasInteracted(true);
    
    if (isMicActive) {
        // If mic is active, pause button just stops the visualizer updates roughly
        setIsPlaying(!isPlaying);
        return;
    }

    if (playlist.length === 0) return;

    if (audioRef.current.paused) {
      audioEngine.resumeContext();
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleNext = () => {
    if (playlist.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % playlist.length;
    playTrack(nextIndex);
  };

  const handlePrev = () => {
    if (playlist.length === 0) return;
    const prevIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    playTrack(prevIndex);
  };

  const handleMicEnable = async () => {
    try {
      setHasInteracted(true);
      // Pause audio playback
      if (audioRef.current) {
          audioRef.current.pause();
      }
      
      await audioEngine.connectMicrophone();
      setIsMicActive(true);
      setIsPlaying(true);
      setCurrentTrackIndex(-1);
    } catch (err) {
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const removeTrack = (index: number) => {
    const newPlaylist = [...playlist];
    newPlaylist.splice(index, 1);
    setPlaylist(newPlaylist);
    
    if (index === currentTrackIndex) {
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.pause();
        setCurrentTrackIndex(-1);
    } else if (index < currentTrackIndex) {
        setCurrentTrackIndex(currentTrackIndex - 1);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04040a] text-white font-sans">
      <VisualizerCanvas
        audioEngine={audioEngine}
        mode={mode}
        isPlaying={isPlaying}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />

      <header className="absolute top-0 left-0 right-0 z-30 px-6 pt-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-white/40">ALGORYTHM</p>
            <h1 className="text-3xl font-semibold text-white">Audio Visual Studio</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/60">
              FFT 2048
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/60">
              {isMicActive ? 'Mic Input' : 'File Playback'}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/60">
              {mode}
            </span>
          </div>
        </div>
      </header>

      {!hasInteracted && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="max-w-lg text-center">
            <p className="text-xs uppercase tracking-[0.45em] text-white/40">Initialize session</p>
            <h2 className="mt-4 text-5xl font-semibold text-white">
              Build a new audio reality.
            </h2>
            <p className="mt-4 text-base text-white/70">
              Upload audio, tap the mic, and explore the next generation of real-time visuals.
            </p>
            <button
              onClick={() => { setHasInteracted(true); setIsLibraryOpen(true); }}
              className="mt-8 rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:scale-105"
            >
              Enter Studio
            </button>
          </div>
        </div>
      )}

      <LibraryPanel
        playlist={playlist}
        currentIndex={currentTrackIndex}
        onSelect={(idx) => playTrack(idx)}
        onRemove={removeTrack}
        onFileUpload={handleFileUpload}
        onMicEnable={handleMicEnable}
        isMicActive={isMicActive}
        isOpen={isLibraryOpen}
        setIsOpen={setIsLibraryOpen}
      />

      <ControlDock
        isPlaying={isPlaying}
        onPlayPause={togglePlayPause}
        onNext={handleNext}
        onPrev={handlePrev}
        currentMode={mode}
        onModeChange={setMode}
        volume={volume}
        onVolumeChange={setVolume}
        currentTrackName={currentTrackIndex > -1 ? playlist[currentTrackIndex].name : undefined}
        isMicActive={isMicActive}
      />
    </div>
  );
};

export default App;
