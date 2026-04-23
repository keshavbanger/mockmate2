import { useEffect, useState } from 'react';
import { 
  LiveKitRoom, 
  RoomAudioRenderer,
  BarVisualizer,
  useVoiceAssistant
} from '@livekit/components-react';

export default function VoiceOrb({ token, serverUrl }) {
  if (!token || !serverUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface-800 rounded-xl">
        <p className="text-slate-500 text-sm">Waiting for connection...</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={true}
      video={false}
      className="w-full h-full flex flex-col items-center justify-center bg-surface-800 rounded-xl border border-white/5 relative"
    >
      <RoomAudioRenderer />
      <VoiceOrbContent />
    </LiveKitRoom>
  );
}

function VoiceOrbContent() {
  const { state, audioTrack } = useVoiceAssistant();

  // state can be 'connecting', 'listening', 'speaking', 'idle'
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';

  return (
    <div className="flex flex-col items-center justify-center gap-8">
      {/* The glowing orb */}
      <div className="relative flex items-center justify-center h-48 w-48">
        {/* Outer glow rings */}
        <div className={`absolute inset-0 rounded-full transition-all duration-700 ${
          isSpeaking ? 'bg-purple-500/20 scale-150 blur-xl animate-pulse' : 
          isListening ? 'bg-purple-400/10 scale-110 blur-lg' : 
          'bg-slate-500/5 scale-100 blur-md'
        }`} />
        <div className={`absolute inset-4 rounded-full transition-all duration-500 ${
          isSpeaking ? 'bg-purple-400/30 scale-125 blur-lg' : 
          isListening ? 'bg-purple-300/20 scale-105 blur-md' : 
          'bg-slate-400/10 scale-100'
        }`} />
        
        {/* Core orb */}
        <div className={`relative h-24 w-24 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center overflow-hidden ${
          isSpeaking ? 'bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/50 scale-110' : 
          isListening ? 'bg-gradient-to-br from-purple-300 to-purple-500 shadow-purple-400/50 scale-100' : 
          'bg-gradient-to-br from-slate-600 to-slate-800 shadow-none scale-95'
        }`}>
          {isSpeaking && audioTrack && (
            <div className="absolute inset-0 flex items-center justify-center opacity-50 mix-blend-overlay">
              <BarVisualizer state={state} trackRef={audioTrack} barCount={5} options={{ minHeight: 10 }} className="h-12 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Status Text */}
      <div className="text-center z-10">
        <h3 className="text-white text-xl font-bold mb-1">Stitch AI</h3>
        <p className={`text-sm font-medium uppercase tracking-widest ${
          isSpeaking ? 'text-purple-400' : 
          isListening ? 'text-purple-300' : 
          'text-slate-500'
        }`}>
          {state || 'Connecting...'}
        </p>
      </div>
    </div>
  );
}
