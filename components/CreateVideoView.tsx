
import React, { useRef, useEffect, useState } from 'react';
import { X, SwitchCamera, Image as ImageIcon, Zap, Settings, ChevronLeft, Circle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CreateVideoViewProps {
  onClose: () => void;
  onVideoReady: (file: File) => void;
}

const CreateVideoView: React.FC<CreateVideoViewProps> = ({ onClose, onVideoReady }) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerIntervalRef = useRef<any>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
            facingMode: cameraFacingMode,
            height: { ideal: 1920 }, // High quality
            width: { ideal: 1080 }
        },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied", err);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [cameraFacingMode]);

  const startRecording = () => {
    if (streamRef.current) {
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, { mimeType, videoBitsPerSecond: 2500000 });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const videoBlob = new Blob(chunksRef.current, { type: mimeType });
        const videoFile = new File([videoBlob], `android_vid_${Date.now()}.mp4`, { type: mimeType });
        onVideoReady(videoFile);
      };
      
      mediaRecorderRef.current.start(); 
      setIsRecording(true);
      setRecordingDuration(0);
      timerIntervalRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black text-white flex flex-col font-sans h-[100dvh] overflow-hidden select-none">
      
      {/* Top Bar (Android Style) */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 pt-safe flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-black/20 transition-colors">
          <X size={28} strokeWidth={1.5} className="drop-shadow-md" />
        </button>
        
        {isRecording ? (
           <div className="bg-red-600 px-3 py-1 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-xs font-bold tracking-widest font-mono">{formatTime(recordingDuration)}</span>
           </div>
        ) : (
           <div className="flex items-center gap-6 drop-shadow-md">
              <Zap size={24} strokeWidth={1.5} className="opacity-90" />
              <Settings size={24} strokeWidth={1.5} className="opacity-90" />
           </div>
        )}
        <div className="w-8"></div>
      </div>

      {/* Viewport */}
      <div className="flex-1 relative bg-[#121212] overflow-hidden rounded-b-3xl">
        <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transition-transform duration-500" 
            style={{ transform: `scale(${zoomLevel})` }}
        />
        
        {/* Zoom Controls (Android Style) */}
        {!isRecording && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                {[0.5, 1, 2].map((z) => (
                    <button 
                        key={z}
                        onClick={() => setZoomLevel(z)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${zoomLevel === z ? 'bg-white text-black scale-110' : 'text-white hover:bg-white/20'}`}
                    >
                        {z}x
                    </button>
                ))}
            </div>
        )}
      </div>
      
      {/* Bottom Controls Area (Android Material 3) */}
      <div className="h-40 bg-black flex flex-col justify-center items-center px-8 pb-safe relative">
        
        {/* Text Mode Selector */}
        {!isRecording && (
            <div className="flex gap-6 mb-5 text-xs font-bold uppercase tracking-widest text-gray-500">
                <span>Photo</span>
                <span className="text-white scale-110 border-b-2 border-transparent">Video</span>
                <span>Shorts</span>
            </div>
        )}

        <div className="flex items-center justify-between w-full max-w-sm px-4">
            {/* Gallery */}
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 rounded-full border border-white/20 bg-gray-800 flex items-center justify-center overflow-hidden active:scale-90 transition-transform"
            >
               <ImageIcon size={20} className="text-white/70" />
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={(e) => e.target.files?.[0] && onVideoReady(e.target.files[0])} />

            {/* Shutter Button - Pixel Style */}
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className="relative group transition-transform active:scale-95"
            >
                <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-colors duration-300 ${isRecording ? 'border-white' : 'border-white'}`}>
                    <div className={`rounded-full transition-all duration-300 ${isRecording ? 'w-8 h-8 bg-red-600 rounded-md' : 'w-16 h-16 bg-red-600'}`}></div>
                </div>
            </button>

            {/* Flip Camera */}
            <button 
                onClick={() => setCameraFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center active:rotate-180 transition-transform duration-500 hover:bg-white/20"
            >
               <SwitchCamera size={24} className="text-white" strokeWidth={1.5} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default CreateVideoView;
