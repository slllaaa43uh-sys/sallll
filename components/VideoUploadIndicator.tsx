
import React from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface VideoUploadIndicatorProps {
  status: 'compressing' | 'uploading' | 'success' | 'error';
  progress: number;
  thumbnail: string | null;
  errorMessage?: string;
}

const VideoUploadIndicator: React.FC<VideoUploadIndicatorProps> = ({ status, progress, thumbnail, errorMessage }) => {
  const { t } = useLanguage();
  const isSuccess = status === 'success';
  const isError = status === 'error';

  // Circular Progress Calculation
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const center = 16;

  return (
    <div className={`fixed top-24 left-4 z-[9999] flex items-center gap-3 p-2 pr-4 rounded-xl backdrop-blur-md shadow-2xl border transition-all duration-500 transform ${
      isError ? 'bg-red-900/90 border-red-500/50' : 'bg-black/80 border-white/10'
    } ${isSuccess ? 'animate-out fade-out slide-out-to-left duration-1000 delay-3000' : 'animate-in slide-in-from-left duration-500'}`}>
      
      {/* Thumbnail Container with Overlay Loader */}
      <div className={`relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border ${isError ? 'border-red-500/50 bg-red-950' : 'border-white/20 bg-gray-800'}`}>
        {thumbnail && !isError ? (
          <img src={thumbnail} alt="uploading" className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className={`w-full h-full ${isError ? 'bg-red-900/40' : 'bg-gray-700'}`} />
        )}

        <div className="absolute inset-0 flex items-center justify-center">
          {status === 'compressing' ? (
             <Loader2 size={20} className="text-white animate-spin" />
          ) : isSuccess ? (
             <div className="bg-green-500 rounded-full p-1 animate-in zoom-in">
                <Check size={14} className="text-white" strokeWidth={3} />
             </div>
          ) : isError ? (
             <AlertCircle size={24} className="text-white animate-pulse" />
          ) : (
             <div className="relative flex items-center justify-center">
                <svg className="transform -rotate-90 w-8 h-8">
                  <circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" fill="transparent" />
                  <circle
                    cx={center} cy={center} r={radius}
                    stroke="#3b82f6" strokeWidth="2.5" fill="transparent"
                    strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round" className="transition-all duration-300 ease-linear"
                  />
                </svg>
                <span className="absolute text-[8px] font-bold text-white">{Math.round(progress)}%</span>
             </div>
          )}
        </div>
      </div>

      {/* Text Info */}
      <div className="flex flex-col min-w-[100px] max-w-[200px]">
         <span className={`text-xs font-bold mb-0.5 ${isError ? 'text-white' : 'text-white'}`}>
            {status === 'compressing' && t('video_preparing')}
            {status === 'uploading' && t('video_uploading')}
            {status === 'success' && t('video_success')}
            {status === 'error' && (t('error_occurred') || 'فشل النشر')}
         </span>
         <span className={`text-[10px] line-clamp-2 ${isError ? 'text-red-200 font-bold' : 'text-gray-400'}`}>
            {isError ? (errorMessage || 'خطأ غير معروف من الخادم') : (
              status === 'compressing' ? t('video_wait') :
              status === 'uploading' ? t('video_dont_close') :
              t('video_watch_now')
            )}
         </span>
      </div>
    </div>
  );
};

export default VideoUploadIndicator;
