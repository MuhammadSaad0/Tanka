import React from 'react';

interface LoadingScreenProps {
  message: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-700">
      <div className="flex flex-col items-center">
        {/* Wind Icon Animation */}
        <div className="w-16 h-16 border-t-2 border-r-2 border-white/50 rounded-full animate-spin mb-6" />
        <p className="text-white/80 font-serif tracking-widest text-lg animate-pulse">
          {message}
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;