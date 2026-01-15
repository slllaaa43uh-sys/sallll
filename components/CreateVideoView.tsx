
import React, { useRef, useEffect, useState } from 'react';
import { X, SwitchCamera, Image as ImageIcon, Video, Zap, Settings, MoreVertical, Timer } from 'lucide-react';
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

  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('user');
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerIntervalRef = useRef<any>(null);

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
            facingMode: cameraFacingMode,
            height: { ideal: 1280 },
            frameRate: { ideal: 30 }
        },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
    } catch (err) {
      setHasPermission(false);
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

  const handleStartSequence = () => {
    setCountdown(3);
    let count = 3;
    const interval = setInterval(() => {
        count--;
        if (count > 0) setCountdown(count);
        else {
            clearInterval(interval);
            setCountdown(null);
            startRecording();
        }
    }, 1000);
  };

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
      
      {/* Native Android Header (Status & Icons) */}
      <div className="absolute top-0 left-0 right-0 z-30 p-5 pt-safe flex justify-between items-center bg-gradient-to-b from-black/40 to-transparent">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X size={26} strokeWidth={2.5} />
        </button>
        
        {isRecording ? (
           <div className="bg-red-600 px-4 py-1.5 rounded-full flex items-center gap-2 animate-pulse shadow-lg border border-white/20">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-sm font-black tracking-widest">{formatTime(recordingDuration)}</span>
           </div>
        ) : (
           <div className="flex items-center gap-4">
              <Zap size={22} className="text-white/80" />
              <Timer size={22} className="text-white/80" />
              <Settings size={22} className="text-white/80" />
           </div>
        )}
        
        <div className="w-8"></div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative bg-[#0a0a0a]">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        
        {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-40">
                <span className="text-[140px] font-black text-white animate-in zoom-in duration-300 drop-shadow-2xl">{countdown}</span>
            </div>
        )}

        {/* Focus Indicator (Android Style) */}
        {!isRecording && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-yellow-400 opacity-40 rounded-sm"></div>}
      </div>
      
      {/* Bottom Controls (Native Android Layout) */}
      <div className="h-44 bg-black flex flex-col justify-center items-center px-8 relative pb-safe">
        
        {/* Mode Selector (Android Camera Slider Style) */}
        <div className="flex gap-6 mb-6 opacity-60 text-xs font-bold uppercase tracking-tighter">
            <span>PORTRAIT</span>
            <span className="text-yellow-400">VIDEO</span>
            <span>PHOTO</span>
        </div>

        <div className="flex items-center justify-between w-full max-w-sm">
            {/* Gallery Preview */}
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 rounded-full border-2 border-white/20 overflow-hidden bg-gray-800 flex items-center justify-center active:scale-90 transition-transform"
            >
               <ImageIcon size={20} className="text-white/60" />
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={(e) => e.target.files?.[0] && onVideoReady(e.target.files[0])} />

            {/* Shutter Button (Android Native Design) */}
            <button 
              onClick={isRecording ? stopRecording : handleStartSequence}
              className="relative w-20 h-20 flex items-center justify-center group"
            >
                <div className="absolute inset-0 rounded-full border-[3px] border-white scale-100 group-active:scale-95 transition-transform"></div>
                <div className={`transition-all duration-300 ${isRecording ? 'w-8 h-8 bg-red-600 rounded-lg' : 'w-16 h-16 bg-red-600 rounded-full'} shadow-xl`}></div>
            </button>

            {/* Lens Switcher */}
            <button 
                onClick={() => setCameraFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center active:rotate-180 transition-transform duration-500"
            >
               <SwitchCamera size={24} className="text-white" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default CreateVideoView;
