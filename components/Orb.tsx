
import React from 'react';
import { SessionStatus } from '../types';

interface OrbProps {
  status: SessionStatus;
  volume: number;
  isSpeaking: boolean;
  onClick: () => void;
}

export const Orb: React.FC<OrbProps> = ({ status, volume, isSpeaking, onClick }) => {
  const isConnected = status === SessionStatus.CONNECTED;
  const isConnecting = status === SessionStatus.CONNECTING;
  const isError = status === SessionStatus.ERROR;

  // Determine core gradient and animation
  let coreClass = "magsman-core relative w-full h-full rounded-full transition-all duration-500 shadow-2xl flex items-center justify-center ";
  let ringColor = "rgba(59, 130, 246, 0.5)";

  if (isError) {
    coreClass += "bg-gradient-to-br from-red-600 to-orange-600 scale-95";
    ringColor = "rgba(239, 68, 68, 0.5)";
  } else if (isConnecting) {
    coreClass += "bg-gradient-to-br from-yellow-400 to-orange-500 animate-pulse";
    ringColor = "rgba(245, 158, 11, 0.5)";
  } else if (isSpeaking) {
    coreClass += "bg-gradient-to-br from-emerald-400 to-cyan-500 animate-vibrate";
    ringColor = "rgba(16, 185, 129, 0.6)";
  } else if (isConnected) {
    // User is listening (vocalizing / sending audio)
    coreClass += "bg-gradient-to-br from-pink-500 to-yellow-400";
    ringColor = "rgba(244, 63, 94, 0.6)";
  } else {
    // Idle
    coreClass += "bg-gradient-to-br from-blue-500 to-indigo-600 animate-breathe";
    ringColor = "rgba(59, 130, 246, 0.4)";
  }

  return (
    <div className="relative group cursor-pointer" onClick={onClick}>
      {/* Outer pulsing ring for active states */}
      {(isConnected || isConnecting) && (
        <div 
          className="absolute inset-0 rounded-full animate-pulse-ring pointer-events-none"
          style={{ 
            backgroundColor: ringColor, 
            transform: `scale(${1 + volume * 0.5})`,
            zIndex: 0
          }}
        />
      )}
      
      {/* Orb Body */}
      <div className="w-16 h-16 md:w-20 md:h-20 relative z-10">
        <div className={coreClass}>
          <svg className="w-8 h-8 md:w-10 md:h-10 text-white drop-shadow-md" viewBox="0 0 24 24" fill="currentColor">
            {isConnected ? (
               <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.66 9 5v6c0 1.66 1.34 3 3 3z M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            ) : (
               <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            )}
          </svg>
        </div>
      </div>

      {/* Tap Label */}
      {!isConnected && !isConnecting && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
           <span className="bg-black/80 text-[10px] font-bold uppercase tracking-widest text-white px-2 py-1 rounded">Tap to Start</span>
        </div>
      )}
    </div>
  );
};
