import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, FocusPointData } from './types';
import { generateTheme, generateLandscape, generateHaikuOptions, generateHaikuAudio, HaikuOption } from './services/geminiService';
import FocusPoint from './components/FocusPoint';
import LoadingScreen from './components/LoadingScreen';

// Reliable MP3 source for forest/nature ambience
const AMBIENT_MUSIC_URL = "/background.mp3";

const App: React.FC = () => {
  // State
  const [appState, setAppState] = useState<AppState>(AppState.INTRO);
  const [theme, setTheme] = useState<string>("");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [haikuLines, setHaikuLines] = useState<string[]>([]);
  const [focusPoints, setFocusPoints] = useState<FocusPointData[]>([]);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio Logic
  const initAudio = useCallback(() => {
    // 1. Init Audio Context
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    
    // 2. Resume Context (Browser Autoplay Policy)
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(e => console.warn("AudioContext resume failed", e));
    }
    
    // 3. Init Ambient Music
    if (!ambientAudioRef.current) {
      const audio = new Audio(AMBIENT_MUSIC_URL);
      audio.loop = true;
      audio.volume = 0.3;
      audio.crossOrigin = "anonymous";
      ambientAudioRef.current = audio;
    }

    // 4. Play Ambient (if not muted)
    if (ambientAudioRef.current && !isMuted) {
      ambientAudioRef.current.play().catch(error => {
        console.warn("Ambient autoplay prevented:", error);
      });
    }
  }, [isMuted]);

  // Sync mute state
  useEffect(() => {
    if (ambientAudioRef.current) {
      ambientAudioRef.current.muted = isMuted;
      if (!isMuted && ambientAudioRef.current.paused && appState !== AppState.INTRO) {
          ambientAudioRef.current.play().catch(e => console.warn("Unmute play failed", e));
      }
    }
  }, [isMuted, appState]);

  // Manual PCM Decoder for Gemini TTS (Raw PCM 24kHz 1ch)
  const pcmToAudioBuffer = (buffer: ArrayBuffer, ctx: AudioContext): AudioBuffer => {
    const dataInt16 = new Int16Array(buffer);
    const sampleRate = 24000; 
    const numChannels = 1;
    // Calculate frames
    const frameCount = dataInt16.length / numChannels;
    
    const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        // Convert Int16 [-32768, 32767] to Float32 [-1.0, 1.0]
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return audioBuffer;
  };

  const playBuffer = async (buffer: ArrayBuffer) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    try {
      // Decode raw PCM manually
      const audioBuffer = pcmToAudioBuffer(buffer, ctx);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      console.error("Audio playback error", e);
    }
  };

  // Logic: Start New Haiku Sequence
  const startExperience = async () => {
    initAudio(); 
    setAppState(AppState.GENERATING_SCENE);
    setHaikuLines([]);
    setFocusPoints([]);
    setBgImage(null);
    setLoadingMessage("Meditating on a theme...");

    try {
      const newTheme = await generateTheme();
      setTheme(newTheme);
      
      setLoadingMessage(`Manifesting ${newTheme}...`);
      
      // Parallel Generation
      const [imageBase64, options] = await Promise.all([
        generateLandscape(newTheme), // No secondary feature arg initially
        generateHaikuOptions(0, newTheme, [], null, undefined)
      ]);

      setBgImage(imageBase64);
      createFocusPointsFromOptions(options);
      
      setAppState(AppState.SELECTING_LINE);
    } catch (err) {
      console.error(err);
      setAppState(AppState.ERROR);
    }
  };

  const createFocusPointsFromOptions = (options: HaikuOption[]) => {
    const newPoints: FocusPointData[] = options.map((opt, idx) => ({
      id: `opt-${idx}`,
      x: opt.x,
      y: opt.y,
      text: opt.text,
      feature: opt.feature
    }));
    setFocusPoints(newPoints);
  };

  const handleFocusClick = async (selectedLine: string, selectedFeature: string) => {
    const newLines = [...haikuLines, selectedLine];
    setHaikuLines(newLines);

    if (newLines.length === 3) {
      finishHaiku(newLines);
    } else {
      advanceToNextLine(newLines, selectedFeature);
    }
  };

  const advanceToNextLine = async (currentLines: string[], lastFeature: string) => {
    setAppState(AppState.GENERATING_SCENE);
    setLoadingMessage(`Approaching ${lastFeature.toLowerCase()}...`);
    setFocusPoints([]); 

    try {
      const nextIndex = currentLines.length;
      
      // OPTIMIZATION: Removed bgImage passed to generateLandscape.
      // We now perform a fresh Text-to-Image generation for speed,
      // rather than a heavier Image-to-Image variation.
      const [newImage, options] = await Promise.all([
          generateLandscape(theme, lastFeature), 
          generateHaikuOptions(nextIndex, theme, currentLines, null, lastFeature) 
      ]);

      setBgImage(newImage);
      createFocusPointsFromOptions(options);
      setAppState(AppState.SELECTING_LINE);

    } catch (err) {
      console.error(err);
      setAppState(AppState.ERROR);
    }
  };

  const finishHaiku = async (finalLines: string[]) => {
    setAppState(AppState.RECITING);
    setLoadingMessage("Composing reflection...");
    
    try {
      const fullPoem = finalLines.join(". ");
      const audioBuffer = await generateHaikuAudio(fullPoem);
      
      setLoadingMessage(""); 
      await playBuffer(audioBuffer);
      
    } catch (err) {
      console.error("Audio failed", err);
      setLoadingMessage("");
    }
  };

  // --- Renders ---

  if (appState === AppState.INTRO) {
    return (
      <div className="relative w-full h-screen bg-neutral-900 flex flex-col items-center justify-center text-center p-8 overflow-hidden">
        {/* Updated to a specific moody nature image to guarantee a nature theme */}
        <div className="absolute inset-0 opacity-30 bg-[url('https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=1920&auto=format&fit=crop')] bg-cover bg-center" />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-5xl md:text-7xl mb-6 font-serif tracking-tighter text-white">Tanka</h1>
          <p className="text-xl md:text-2xl text-neutral-300 mb-12 font-light italic">
            "Find clarity in the shifting landscape."
          </p>
          <button 
            onClick={startExperience}
            className="px-12 py-4 border border-white/30 hover:border-white text-white tracking-[0.2em] uppercase transition-all duration-500 hover:bg-white/10 text-sm md:text-base cinzel"
          >
            Begin Journey
          </button>
        </div>
      </div>
    );
  }

  if (appState === AppState.ERROR) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white">
        <p className="mb-4 text-red-400">The spirits are quiet today (Error).</p>
        <button onClick={() => setAppState(AppState.INTRO)} className="border px-4 py-2 hover:bg-white hover:text-black">Return</button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black select-none">
      
      {/* Background Image Layer */}
      {bgImage && (
        <div 
          className="absolute inset-0 transition-all duration-[2000ms] ease-in-out"
          style={{
            backgroundImage: `url(data:image/png;base64,${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: appState === AppState.GENERATING_SCENE ? 'scale(1.15)' : 'scale(1.0)',
            opacity: appState === AppState.GENERATING_SCENE ? 0.5 : 1
          }}
        >
          <div className="absolute inset-0 bg-black/20" /> 
        </div>
      )}

      {/* Audio Control */}
      <div className="absolute top-6 right-6 z-50">
        <button 
          onClick={() => setIsMuted(!isMuted)}
          className="text-white/70 hover:text-white transition-colors"
        >
          {isMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
            </svg>
          )}
        </button>
      </div>

      {/* Loading Overlay */}
      {(appState === AppState.GENERATING_SCENE || (appState === AppState.RECITING && loadingMessage)) && (
        <LoadingScreen message={loadingMessage} />
      )}

      {/* Focus Points Layer */}
      {appState === AppState.SELECTING_LINE && (
        <div className="absolute inset-0 z-30">
           {focusPoints.map((point, idx) => (
             <FocusPoint 
               key={point.id}
               x={point.x}
               y={point.y}
               text={point.text}
               delay={idx * 300}
               onClick={() => handleFocusClick(point.text, point.feature)}
             />
           ))}
           <div className="absolute bottom-10 w-full text-center text-white/60 text-sm tracking-widest uppercase animate-pulse pointer-events-none">
             Explore the landscape to find inspiration
           </div>
        </div>
      )}

      {/* Haiku Display Layer - ADDED BACKGROUND GRADIENT FOR READABILITY */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-40 pointer-events-none p-8 md:p-16 flex flex-col items-start">
        {haikuLines.map((line, idx) => (
          <div 
            key={idx} 
            className="text-2xl md:text-4xl lg:text-5xl text-white font-serif mb-4 drop-shadow-2xl opacity-0 animate-[slideIn_1s_ease-out_forwards]"
            style={{ animationDelay: `${idx * 0.2}s`, textShadow: '0 4px 12px rgba(0,0,0,1)' }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Final State Controls */}
      {appState === AppState.RECITING && !loadingMessage && (
        <div className="absolute bottom-20 w-full flex justify-center z-50 animate-[fadeIn_2s_ease-in]">
          <button 
             onClick={startExperience}
             className="px-8 py-3 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white tracking-widest uppercase transition-all cinzel shadow-lg"
          >
            Compose Another
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default App;