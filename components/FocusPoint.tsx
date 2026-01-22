import React, { useState } from 'react';

interface FocusPointProps {
  x: number;
  y: number;
  text: string;
  onClick: () => void;
  delay: number; // Animation delay
}

const FocusPoint: React.FC<FocusPointProps> = ({ x, y, text, onClick, delay }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="absolute flex items-center justify-center cursor-pointer z-20 group"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        animation: `fadeIn 2s ease-out ${delay}ms forwards`,
        opacity: 0,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* The Spirit Orb */}
      <div 
        className={`relative z-10 rounded-full transition-all duration-700 ease-in-out ${
          hovered ? 'w-5 h-5 bg-white shadow-[0_0_20px_rgba(255,255,255,1)] opacity-100' : 'w-3 h-3 bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.8)] opacity-90'
        }`} 
      />
      
      {/* Pulsating Ring (Ripple) - Replaces the blur glow with a structured pulse */}
      {!hovered && (
         <div 
           className="absolute w-12 h-12 rounded-full border border-white/40 opacity-0" 
           style={{ animation: 'ripple 2.5s infinite ease-out' }}
         />
      )}

      {/* Hover Text Hint */}
      <div 
        className={`absolute top-8 left-1/2 -translate-x-1/2 text-white text-sm md:text-base tracking-widest font-serif italic whitespace-nowrap px-3 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded pointer-events-none transition-all duration-500 ${
          hovered ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 -translate-y-2 blur-sm'
        }`}
        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
      >
        {text}
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ripple {
          0% { transform: scale(0.1); opacity: 0.8; border-width: 3px; }
          50% { opacity: 0.4; }
          100% { transform: scale(1.5); opacity: 0; border-width: 0px; }
        }
      `}</style>
    </div>
  );
};

export default FocusPoint;