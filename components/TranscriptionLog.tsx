
import React, { useEffect, useRef } from 'react';
import { Message } from '../types';

interface TranscriptionLogProps {
  messages: Message[];
  currentInput: string;
  currentOutput: string;
}

export const TranscriptionLog: React.FC<TranscriptionLogProps> = ({ messages, currentInput, currentOutput }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentInput, currentOutput]);

  return (
    <div className="w-full max-w-2xl h-64 md:h-80 glass rounded-2xl p-6 overflow-y-auto flex flex-col gap-4" ref={scrollRef}>
      {messages.length === 0 && !currentInput && !currentOutput && (
        <div className="h-full flex items-center justify-center text-gray-500 italic text-sm text-center">
          Tap the button below to start a conversation...
        </div>
      )}
      
      {messages.map((m) => (
        <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
          <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${
            m.role === 'user' 
              ? 'bg-blue-600 text-white rounded-tr-none' 
              : 'bg-white/10 text-gray-200 rounded-tl-none'
          }`}>
            {m.text}
          </div>
        </div>
      ))}

      {currentInput && (
        <div className="flex flex-col items-end">
          <div className="max-w-[85%] px-4 py-2 rounded-2xl bg-blue-600/50 text-white/80 text-sm italic rounded-tr-none animate-pulse">
            {currentInput}
          </div>
        </div>
      )}

      {currentOutput && (
        <div className="flex flex-col items-start">
          <div className="max-w-[85%] px-4 py-2 rounded-2xl bg-white/5 text-gray-200/80 text-sm rounded-tl-none animate-pulse">
            {currentOutput}
          </div>
        </div>
      )}
    </div>
  );
};
