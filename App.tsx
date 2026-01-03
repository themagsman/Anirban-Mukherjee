
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Type, FunctionDeclaration } from '@google/genai';
import { Orb } from './components/Orb';
import { SessionStatus, Message } from './types';
import { 
  decodeBase64, 
  decodeAudioData, 
  createPcmBlob 
} from './services/audioService';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';

const navigateFunction: FunctionDeclaration = {
  name: 'navigateToPage',
  parameters: {
    type: Type.OBJECT,
    description: 'Navigates the user to a specific page on the website.',
    properties: {
      page: {
        type: Type.STRING,
        description: 'The target page (home, about, services, contact, press).',
        enum: ['home', 'about', 'services', 'contact', 'press']
      },
    },
    required: ['page'],
  },
};

const App: React.FC = () => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [currentOutput, setCurrentOutput] = useState('');
  const [volume, setVolume] = useState(0);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const audioWorkletNodeRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setStatus(SessionStatus.IDLE);
    setVolume(0);
    setIsAssistantSpeaking(false);
    setCurrentOutput('');
  }, []);

  const handleStart = async () => {
    if (status !== SessionStatus.IDLE) {
      cleanup();
      return;
    }

    try {
      setStatus(SessionStatus.CONNECTING);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            // Using 'Zephyr' for a more human-like, modern conversational voice
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          tools: [{ functionDeclarations: [navigateFunction] }],
          systemInstruction: 'You are Aura, an elite, helpful, and natural conversational AI assistant for "The Magsman". Your tone is elegant, professional, and warm. You help users navigate the site and answer questions about SEO, Marketing, Video, and Design. When asked to navigate, call navigateToPage. Keep responses concise and human-like.',
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus(SessionStatus.CONNECTED);
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            audioWorkletNodeRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              const vol = Math.sqrt(sum / inputData.length);
              setVolume(vol);

              if (vol > 0.01) { // Only send if there's actual sound
                const pcmBlob = createPcmBlob(inputData);
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message) => {
            // Handle Tool Calls
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'navigateToPage') {
                  const page = (fc.args as any).page;
                  setCurrentOutput(`Navigating to ${page}...`);
                  // Mock navigation behavior
                  setTimeout(() => {
                    sessionPromise.then(s => s.sendToolResponse({
                      functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: { result: "Success: User moved to " + page },
                      }
                    }));
                  }, 500);
                }
              }
            }

            // Transcription for UI
            if (message.serverContent?.outputTranscription) {
              setCurrentOutput(prev => prev + message.serverContent!.outputTranscription!.text);
            }

            // Audio Output Handling
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputCtx) {
              setIsAssistantSpeaking(true);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsAssistantSpeaking(false);
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsAssistantSpeaking(false);
            }

            if (message.serverContent?.turnComplete) {
              // Wait a bit before clearing bubble
              setTimeout(() => {
                if (!isAssistantSpeaking) setCurrentOutput('');
              }, 4000);
            }
          },
          onerror: (err) => {
            setStatus(SessionStatus.ERROR);
            cleanup();
          },
          onclose: () => {
            setStatus(SessionStatus.IDLE);
            cleanup();
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (error) {
      setStatus(SessionStatus.ERROR);
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden flex flex-col items-center justify-center">
       {/* Main background mockup to represent the "website" */}
       <div className="absolute inset-0 bg-gradient-to-tr from-gray-950 via-gray-900 to-indigo-950 -z-10" />
       
       <div className="text-center p-8 max-w-xl animate-fade-in pointer-events-auto">
          <h1 className="text-5xl font-display font-bold text-white mb-4">The Magsman</h1>
          <p className="text-gray-400 text-lg">Digital Excellence in SEO, Marketing, and Design.</p>
       </div>

       {/* Floating Assistant Section (Bottom Left) */}
       <div className="absolute bottom-8 left-8 flex flex-col items-start gap-3 pointer-events-auto">
          
          {/* Status Label */}
          <div className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-bold tracking-widest text-blue-400 uppercase">
             Aura Assistant
          </div>

          {/* Speech Bubble */}
          <div className={`transition-all duration-500 transform origin-bottom-left max-w-xs ${currentOutput ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-90 pointer-events-none'}`}>
             <div className="bg-white text-gray-900 px-5 py-3 rounded-2xl rounded-bl-none shadow-2xl relative">
                <p className="text-sm font-medium leading-relaxed">{currentOutput}</p>
                {/* Tail */}
                <div className="absolute bottom-0 left-0 -translate-x-1/2 w-4 h-4 bg-white transform rotate-45 translate-y-1/2" />
             </div>
          </div>

          {/* Assistant Core */}
          <div className="flex items-center gap-4">
             <Orb 
               status={status} 
               volume={volume} 
               isSpeaking={isAssistantSpeaking} 
               onClick={handleStart} 
             />
             
             {status === SessionStatus.CONNECTED && (
               <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white/80">Listening...</span>
                  <div className="flex gap-1 items-center h-4 mt-1">
                     {[...Array(3)].map((_, i) => (
                       <div 
                         key={i} 
                         className="w-1 bg-blue-400 rounded-full animate-bounce" 
                         style={{ height: `${20 + volume * 80}%`, animationDelay: `${i * 0.1}s` }}
                       />
                     ))}
                  </div>
               </div>
             )}
          </div>
       </div>

       {/* Mobile / Full Screen overlay info for errors */}
       {status === SessionStatus.ERROR && (
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glass p-6 rounded-3xl text-center pointer-events-auto">
            <h2 className="text-red-400 font-bold mb-2">Connection Issue</h2>
            <p className="text-gray-300 text-sm mb-4">I'm having trouble connecting right now.</p>
            <button onClick={handleStart} className="bg-blue-600 px-6 py-2 rounded-full text-sm font-bold">Retry</button>
         </div>
       )}
    </div>
  );
};

export default App;
