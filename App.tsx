import React, { useState, useEffect, useRef } from 'react';
import { AudioEngine } from './services/AudioEngine';
import VisualizerCanvas from './components/VisualizerCanvas';
import Controls from './components/Controls';
import Playlist from './components/Playlist';
import { Track, VisualizerMode } from './types';

const App: React.FC = () => {
  const [audioEngine] = useState(() => new AudioEngine());
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [mode, setMode] = useState<VisualizerMode>(VisualizerMode.Spectrogram);
  const [isMicActive, setIsMicActive] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
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
      
      // Open playlist sidebar on first upload
      if (playlist.length === 0) setIsPlaylistOpen(true);
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
    <div className="relative w-full h-screen overflow-hidden bg-black text-white font-sans select-none">
      
      {/* Background / Canvas */}
      <VisualizerCanvas 
        audioEngine={audioEngine} 
        mode={mode} 
        isPlaying={isPlaying}
      />

      {/* Overlay Gradient for readability */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/60" />

      {/* Branding / Start Prompt */}
      {!hasInteracted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 backdrop-blur-sm">
          <div className="text-center animate-pulse">
             <h1 className="text-6xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-600">
               ALGORYTHM
             </h1>
             <button 
               onClick={() => { setHasInteracted(true); setIsPlaylistOpen(true); }}
               className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition"
             >
               START EXPERIENCE
             </button>
          </div>
        </div>
      )}

      {/* Playlist Sidebar */}
      <Playlist 
        playlist={playlist}
        currentIndex={currentTrackIndex}
        onSelect={(idx) => playTrack(idx)}
        onRemove={removeTrack}
        isOpen={isPlaylistOpen}
        setIsOpen={setIsPlaylistOpen}
      />

      {/* Track Title (Floating) */}
      {!isMicActive && currentTrackIndex !== -1 && (
        <div className="absolute top-8 left-8 z-10 max-w-md">
            <h1 className="text-4xl font-bold text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.8)] line-clamp-2">
                {playlist[currentTrackIndex].name}
            </h1>
        </div>
      )}

      {/* Main Controls */}
      <Controls 
        isPlaying={isPlaying}
        onPlayPause={togglePlayPause}
        onNext={handleNext}
        onPrev={handlePrev}
        currentMode={mode}
        onModeChange={setMode}
        onMicEnable={handleMicEnable}
        onFileUpload={handleFileUpload}
        volume={volume}
        onVolumeChange={setVolume}
        currentTrackName={currentTrackIndex > -1 ? playlist[currentTrackIndex].name : undefined}
        isMicActive={isMicActive}
      />
    </div>
  );
};

export default App;