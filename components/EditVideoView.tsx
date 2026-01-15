
import React, { useState, useRef, PointerEvent, useEffect } from 'react';
import { 
  ArrowLeft, Type, Minus, Plus, 
  Music, Scissors, Wand2, Mic, Volume2, VolumeX,
  Sticker, X, Trash2, Check, StopCircle, Upload
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

// Define the structure for a text overlay
export interface TextOverlay {
  id: number;
  type: 'text';
  content: string;
  x: number;
  y: number;
  scale: number;
  color: string;
}

// Define the structure for a sticker overlay
export interface StickerOverlay {
  id: number;
  type: 'sticker';
  content: string; // Emoji or URL
  x: number;
  y: number;
  scale: number;
}

interface EditVideoViewProps {
  videoSrc: string;
  onBack: () => void;
  // Updated signature to include audioSettings
  onNext: (texts: TextOverlay[], stickers: StickerOverlay[], voiceoverBlob: Blob | null, audioSettings: { isMuted: boolean }) => void;
  initialTexts: TextOverlay[];
  initialStickers?: StickerOverlay[];
  currentFilter: string;
  onFilterChange: (filter: string) => void;
}

// --- DRAGGABLE COMPONENT WRAPPER (Generic) ---
const DraggableItem: React.FC<{
  x: number;
  y: number;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (x: number, y: number) => void;
  children: React.ReactNode;
}> = ({ x, y, scale, isSelected, onSelect, onUpdate, children }) => {
  const [dragState, setDragState] = useState<{ x: number, y: number } | null>(null);

  const handleDragStart = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragState({ x: e.clientX - x, y: e.clientY - y });
  };

  const handleDragMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragState) {
      e.preventDefault();
      e.stopPropagation();
      onUpdate(e.clientX - dragState.x, e.clientY - dragState.y);
    }
  };

  const handleDragEnd = (e: PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setDragState(null);
  };

  return (
    <div
      onPointerDown={handleDragStart}
      onPointerMove={handleDragMove}
      onPointerUp={handleDragEnd}
      onPointerCancel={handleDragEnd}
      className="absolute touch-none cursor-grab active:cursor-grabbing p-2 select-none flex items-center justify-center"
      style={{
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        border: isSelected ? '2px dashed rgba(255,255,255,0.8)' : '2px solid transparent',
        borderRadius: '12px',
        zIndex: isSelected ? 20 : 10,
      }}
    >
      {children}
      {isSelected && (
          <div className="absolute -top-3 -right-3 w-6 h-6 bg-white text-black rounded-full flex items-center justify-center shadow-sm">
             <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
          </div>
      )}
    </div>
  );
};

// Text Input Modal
const TextEditModal: React.FC<{
  onDone: (content: string, color: string) => void;
  onClose: () => void;
}> = ({ onDone, onClose }) => {
    const { t } = useLanguage();
    const [content, setContent] = useState('');
    const [color, setColor] = useState('#FFFFFF');
    const colors = ['#FFFFFF', '#000000', '#FF3B30', '#34C759', '#007AFF', '#FFCC00', '#AF52DE'];

    return (
        <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center p-4">
            <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('type_something')}
                className="w-full max-w-sm bg-transparent border-b-2 border-white text-white text-3xl font-bold text-center placeholder:text-gray-400 outline-none p-2 mb-8"
                autoFocus
            />
            <div className="flex gap-3 mb-8">
                {colors.map(c => (
                    <button key={c} onClick={() => setColor(c)} style={{ backgroundColor: c }}
                        className={`w-8 h-8 rounded-full transition-transform transform ${color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`}
                    />
                ))}
            </div>
            <div className="flex gap-4">
                 <button onClick={onClose} className="px-6 py-2 rounded-full font-bold bg-white/20 text-white">{t('cancel')}</button>
                 <button onClick={() => content && onDone(content, color)} 
                   className="px-8 py-2 rounded-full font-bold bg-blue-600 text-white disabled:bg-gray-500"
                   disabled={!content}
                 >
                   {t('done')}
                 </button>
            </div>
        </div>
    );
};

// --- DATA: STICKERS (CapCut Style) ---
const STICKER_CATEGORIES = [
    { id: 'emoji', label: 'إيموجي', items: ['😂','😍','🔥','👍','😭','🎉','👀','✨','❤️','😎','🤔','😡','🥰','🤩','🤪','👻','💀','👽','🤖','💩'] },
    { id: 'vibe', label: 'أجواء', items: ['✨','🌟','💫','⚡','🌙','☀️','🌈','☁️','❄️','🔥','💧','🌊','🏖️','🏕️','🎡'] },
    { id: 'arrows', label: 'أسهم', items: ['⬅️','➡️','⬆️','⬇️','↗️','↘️','↙️','↖️','↔️','↕️','🔄','↪️','↩️'] },
    { id: 'love', label: 'حب', items: ['❤️','🧡','💛','💚','💙','💜','🤎','🖤','🤍','🤍','❣️','💕','💞','💓','💗','💖'] },
    { id: 'sign', label: 'إشارات', items: ['✅','❌','❎','🚫','🛑','⭕','❗','❓','💯','💢','💥','💤','💨','💦'] },
];

const VIDEO_FILTERS = [
    { name: 'Normal', css: 'none' },
    { name: 'Contrast', css: 'contrast(1.4) brightness(1.1)' },
    { name: 'Warm', css: 'sepia(0.3) saturate(1.4)' },
    { name: 'Cool', css: 'saturate(0.8) hue-rotate(180deg) brightness(1.1)' },
    { name: 'B&W', css: 'grayscale(1)' },
    { name: 'Vintage', css: 'sepia(0.6) contrast(1.2)' },
    { name: 'Dreamy', css: 'blur(0.5px) brightness(1.2) saturate(1.2)' },
    { name: 'Vivid', css: 'saturate(2) contrast(1.1)' },
    { name: 'Fade', css: 'opacity(0.8) brightness(1.1)' },
    { name: 'Invert', css: 'invert(1)' },
];

const FILTER_PREVIEW_IMG = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&q=80";

const EditVideoView: React.FC<EditVideoViewProps> = ({ videoSrc, onBack, onNext, initialTexts, initialStickers = [], currentFilter, onFilterChange }) => {
  const { t, language } = useLanguage();
  
  // Content State
  const [texts, setTexts] = useState<TextOverlay[]>(initialTexts);
  const [stickers, setStickers] = useState<StickerOverlay[]>(initialStickers);
  
  // Voiceover & Music State
  const [isVoiceDrawerOpen, setIsVoiceDrawerOpen] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0); // Timer State
  const [voiceoverBlob, setVoiceoverBlob] = useState<Blob | null>(null);
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceoverAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimerRef = useRef<any>(null); // Ref for timer interval
  const musicInputRef = useRef<HTMLInputElement>(null); // Music input ref

  // UI State
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<{ type: 'text'|'sticker', id: number } | null>(null);
  
  const [isEffectsDrawerOpen, setIsEffectsDrawerOpen] = useState(false);
  const [isStickerDrawerOpen, setIsStickerDrawerOpen] = useState(false);
  const [activeStickerTab, setActiveStickerTab] = useState(0);
  
  // Audio State
  const [isMuted, setIsMuted] = useState(false); 

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Track if video has been initialized to avoid resetting mute state on loop
  const initialLoadRef = useRef(true);

  // --- PLAYBACK SYNC LOGIC (IMPROVED) ---
  useEffect(() => {
      const video = videoRef.current;
      const audio = voiceoverAudioRef.current;

      if (!video) return;

      const handlePlay = () => {
          if (audio && voiceoverUrl) {
              // Sync audio to video time when play starts
              const timeDiff = Math.abs(audio.currentTime - video.currentTime);
              if (timeDiff > 0.1) {
                  audio.currentTime = video.currentTime;
              }
              audio.play().catch(() => {});
          }
      };

      const handlePause = () => {
          if (audio) audio.pause();
      };

      const handleSeek = () => {
          if (audio && voiceoverUrl) {
              audio.currentTime = video.currentTime;
          }
      };

      // Critical fix for "Plays only once":
      // Instead of relying on 'ended', we use 'timeupdate' to detect the loop.
      // Since video has `loop` prop, it jumps to 0 automatically.
      // We detect this jump and reset audio.
      const handleTimeUpdate = () => {
          if (!audio || !voiceoverUrl) return;
          
          // If video looped (time is near 0 but was just playing)
          if (video.currentTime < 0.2 && !video.paused) {
               // Ensure audio is also near 0
               if (audio.currentTime > 0.5) {
                   audio.currentTime = 0;
                   if (audio.paused) audio.play().catch(()=>{});
               }
          }
          
          // Drift correction
          const diff = Math.abs(audio.currentTime - video.currentTime);
          if (diff > 0.3) {
              audio.currentTime = video.currentTime;
          }
      };

      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('seeking', handleSeek);
      video.addEventListener('timeupdate', handleTimeUpdate);

      return () => {
          video.removeEventListener('play', handlePlay);
          video.removeEventListener('pause', handlePause);
          video.removeEventListener('seeking', handleSeek);
          video.removeEventListener('timeupdate', handleTimeUpdate);
      };
  }, [voiceoverUrl]);

  // --- INITIALIZATION ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    // Reset initial load state when video source changes
    initialLoadRef.current = true;

    video.load();

    const attemptPlay = async () => {
        if (!initialLoadRef.current) {
            try { await video.play(); } catch(e) {}
            return;
        }

        try {
            video.muted = false;
            setIsMuted(false);
            await video.play();
        } catch (error) {
            console.log("Autoplay with sound failed, fallback to muted.");
            video.muted = true;
            setIsMuted(true);
            try { await video.play(); } catch(e) {}
        } finally {
            initialLoadRef.current = false;
        }
    };

    const handleReady = () => { 
        attemptPlay(); 
    };

    if (video.readyState >= 2) { attemptPlay(); } 
    else {
        video.addEventListener('loadeddata', handleReady, { once: true });
        video.addEventListener('canplay', handleReady, { once: true });
    }

    return () => {
        video.removeEventListener('loadeddata', handleReady);
        video.removeEventListener('canplay', handleReady);
    };
  }, [videoSrc]);

  const toggleMute = () => {
      const video = videoRef.current;
      if (video) {
          const newState = !video.muted;
          video.muted = newState;
          setIsMuted(newState);
      }
  };

  // --- MUSIC UPLOAD LOGIC ---
  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          // Clear previous if exists to ensure clean state
          if (voiceoverUrl) URL.revokeObjectURL(voiceoverUrl);
          
          const url = URL.createObjectURL(file);
          setVoiceoverBlob(file);
          setVoiceoverUrl(url);
          
          // Optionally auto-play or sync immediately
          if (videoRef.current && !videoRef.current.paused) {
              // Wait for audio element to load the new source
              setTimeout(() => {
                  if (voiceoverAudioRef.current) {
                      voiceoverAudioRef.current.currentTime = videoRef.current!.currentTime;
                      voiceoverAudioRef.current.play().catch(() => {});
                  }
              }, 100);
          }
      }
  };

  // --- VOICE RECORDING LOGIC ---
  const startVoiceRecording = async () => {
      try {
          // Reset previous recordings if any
          deleteVoiceover();

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  audioChunksRef.current.push(event.data);
              }
          };

          mediaRecorder.onstop = () => {
              const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              const url = URL.createObjectURL(blob);
              setVoiceoverBlob(blob);
              setVoiceoverUrl(url);
              
              // Stop tracks
              stream.getTracks().forEach(track => track.stop());
          };

          // Start Video Playback (Muted to avoid echo)
          if (videoRef.current) {
              videoRef.current.currentTime = 0;
              videoRef.current.muted = true; // Temporary mute while recording
              videoRef.current.play();
          }

          mediaRecorder.start();
          setIsRecordingVoice(true);
          
          // Start Timer
          setRecordingDuration(0);
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = setInterval(() => {
              setRecordingDuration(prev => prev + 1);
          }, 1000);

      } catch (err) {
          console.error("Mic error", err);
          alert("الرجاء السماح بالوصول للميكروفون");
      }
  };

  const stopVoiceRecording = () => {
      if (mediaRecorderRef.current && isRecordingVoice) {
          mediaRecorderRef.current.stop();
          setIsRecordingVoice(false);
          
          // Clear Timer
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          setRecordingDuration(0);
          
          // Stop Video
          if (videoRef.current) {
              videoRef.current.pause();
              videoRef.current.currentTime = 0;
              // Restore mute state to what user had selected before
              videoRef.current.muted = isMuted; 
          }
      }
  };

  const deleteVoiceover = () => {
      if (voiceoverUrl) {
          URL.revokeObjectURL(voiceoverUrl);
      }
      setVoiceoverBlob(null);
      setVoiceoverUrl(null);
      setRecordingDuration(0); // Reset timer just in case
  };

  // Helper for timer format
  const formatDuration = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- TEXT LOGIC ---
  const handleAddText = (content: string, color: string) => {
    const container = containerRef.current;
    if (!container) return;
    const newText: TextOverlay = {
      id: Date.now(),
      type: 'text',
      content,
      color,
      x: container.clientWidth / 2,
      y: container.clientHeight / 2,
      scale: 1,
    };
    setTexts(prev => [...prev, newText]);
    setIsTextModalOpen(false);
    setSelectedItemId({ type: 'text', id: newText.id });
  };
  
  const updateText = (id: number, x: number, y: number) => {
    setTexts(prev => prev.map(t => t.id === id ? { ...t, x, y } : t));
  };

  // --- STICKER LOGIC ---
  const handleAddSticker = (content: string) => {
      const container = containerRef.current;
      if (!container) return;
      const newSticker: StickerOverlay = {
          id: Date.now(),
          type: 'sticker',
          content,
          x: container.clientWidth / 2,
          y: container.clientHeight / 2,
          scale: 1.5, // Start slightly bigger
      };
      setStickers(prev => [...prev, newSticker]);
      setIsStickerDrawerOpen(false);
      setSelectedItemId({ type: 'sticker', id: newSticker.id });
  };

  const updateSticker = (id: number, x: number, y: number) => {
      setStickers(prev => prev.map(s => s.id === id ? { ...s, x, y } : s));
  };

  // --- SHARED RESIZE LOGIC ---
  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!selectedItemId) return;

    if (selectedItemId.type === 'text') {
        setTexts(prev => prev.map(t => t.id === selectedItemId.id ? { ...t, scale: val } : t));
    } else {
        setStickers(prev => prev.map(s => s.id === selectedItemId.id ? { ...s, scale: val } : s));
    }
  };

  const handleDeleteItem = () => {
      if (!selectedItemId) return;
      if (selectedItemId.type === 'text') {
          setTexts(prev => prev.filter(t => t.id !== selectedItemId.id));
      } else {
          setStickers(prev => prev.filter(s => s.id !== selectedItemId.id));
      }
      setSelectedItemId(null);
  };

  const getSelectedItemScale = () => {
      if (!selectedItemId) return 1;
      if (selectedItemId.type === 'text') {
          return texts.find(t => t.id === selectedItemId.id)?.scale || 1;
      } else {
          return stickers.find(s => s.id === selectedItemId.id)?.scale || 1;
      }
  };

  const showComingSoon = () => {
      alert(language === 'ar' ? 'هذه الميزة ستتوفر قريباً، نعمل على تطويرها!' : 'This feature is coming soon!');
  };

  // Tools Configuration
  const editTools = [
      { id: 'text', icon: Type, label: language === 'ar' ? 'نص' : 'Text', action: () => setIsTextModalOpen(true) },
      // Sticker Tool
      { 
          id: 'sticker', 
          icon: Sticker, 
          label: language === 'ar' ? 'ملصق' : 'Sticker', 
          action: () => setIsStickerDrawerOpen(true) 
      },
      { 
          id: 'effects', 
          icon: Wand2, 
          label: language === 'ar' ? 'مؤثرات' : 'Effects', 
          action: () => setIsEffectsDrawerOpen(true) 
      },
      // Music Tool - Triggers File Input
      { 
          id: 'music', 
          icon: Music, 
          label: language === 'ar' ? 'موسيقى' : 'Music', 
          action: () => musicInputRef.current?.click()
      },
      // Voice Tool
      { 
          id: 'voice', 
          icon: Mic, 
          label: language === 'ar' ? 'تعليق' : 'Voice', 
          action: () => setIsVoiceDrawerOpen(true) 
      },
      { 
          id: 'volume', 
          icon: isMuted ? VolumeX : Volume2, 
          label: language === 'ar' ? 'صوت' : 'Sound', 
          action: toggleMute 
      },
  ];
  
  return (
    <div className="fixed inset-0 z-[110] bg-black text-white flex flex-col animate-in fade-in duration-300">
      
      {/* Hidden Audio Element for Voiceover/Music Playback */}
      <audio ref={voiceoverAudioRef} src={voiceoverUrl || ''} />
      
      {/* Hidden Music Input */}
      <input 
          type="file" 
          ref={musicInputRef} 
          className="hidden" 
          accept="audio/*" 
          onChange={handleMusicUpload} 
      />

      {/* Main Content Area */}
      <div ref={containerRef} className="flex-1 relative w-full h-full overflow-hidden" onClick={() => setSelectedItemId(null)}>
        {/* Video Player */}
        <video 
          key={videoSrc} 
          ref={videoRef}
          src={videoSrc} 
          playsInline
          muted={isMuted || isRecordingVoice} // FIX: Ensure mute during recording
          loop
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover transition-all duration-300" 
          style={{ filter: currentFilter }}
        />
        
        {/* Top Header */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-center pt-safe bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={onBack} className="p-2 bg-black/30 rounded-full backdrop-blur-md">
            <ArrowLeft className={language === 'ar' ? 'rotate-180' : ''} size={24} />
          </button>
          
          {/* Next Button */}
          <button 
            onClick={() => onNext(texts, stickers, voiceoverBlob, { isMuted })}
            className="px-6 py-2 rounded-full font-bold text-sm bg-blue-600 text-white transition-colors shadow-lg"
          >
            {t('post_next')}
          </button>
        </div>

        {/* Right Sidebar Tools */}
        <div className="absolute top-20 right-4 z-20 flex flex-col gap-5 items-center">
            {editTools.map((tool) => (
                <div key={tool.id} className="flex flex-col items-center gap-1 group">
                    <button 
                        onClick={(e) => { e.stopPropagation(); tool.action(); }}
                        className={`w-10 h-10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 shadow-lg active:scale-90 transition-transform ${tool.id === 'voice' && voiceoverBlob ? 'bg-red-600' : 'bg-black/40'}`}
                    >
                        <tool.icon size={20} className="text-white" />
                    </button>
                    <span className="text-[10px] font-medium text-white drop-shadow-md opacity-90">{tool.label}</span>
                </div>
            ))}
        </div>

        {/* Render Editable Texts */}
        {texts.map(text => (
          <DraggableItem
            key={text.id}
            x={text.x}
            y={text.y}
            scale={text.scale}
            isSelected={selectedItemId?.id === text.id && selectedItemId?.type === 'text'}
            onSelect={() => setSelectedItemId({ type: 'text', id: text.id })}
            onUpdate={(x, y) => updateText(text.id, x, y)} 
          >
             <span
                className="text-3xl font-bold whitespace-nowrap drop-shadow-lg"
                style={{ color: text.color, textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
             >
               {text.content}
             </span>
          </DraggableItem>
        ))}

        {/* Render Editable Stickers */}
        {stickers.map(sticker => (
          <DraggableItem
            key={sticker.id}
            x={sticker.x}
            y={sticker.y}
            scale={sticker.scale}
            isSelected={selectedItemId?.id === sticker.id && selectedItemId?.type === 'sticker'}
            onSelect={() => setSelectedItemId({ type: 'sticker', id: sticker.id })}
            onUpdate={(x, y) => updateSticker(sticker.id, x, y)}
          >
             <div className="text-5xl drop-shadow-2xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
               {sticker.content}
             </div>
          </DraggableItem>
        ))}

        {/* Text Input Modal */}
        {isTextModalOpen && (
            <TextEditModal
                onDone={handleAddText}
                onClose={() => setIsTextModalOpen(false)}
            />
        )}

        {/* STICKER DRAWER (CapCut Style) */}
        {isStickerDrawerOpen && (
            <div className="absolute bottom-0 left-0 right-0 z-30 bg-gray-900/95 backdrop-blur-xl border-t border-white/10 animate-in slide-in-from-bottom duration-300 pb-safe rounded-t-3xl h-[50vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <span className="text-sm font-bold text-white pl-2">الملصقات</span>
                    <button onClick={() => setIsStickerDrawerOpen(false)} className="p-1 rounded-full hover:bg-white/10">
                        <X size={20} className="text-gray-300" />
                    </button>
                </div>
                
                {/* Categories Tabs */}
                <div className="flex gap-2 overflow-x-auto p-2 no-scrollbar border-b border-white/5">
                    {STICKER_CATEGORIES.map((cat, index) => (
                        <button 
                            key={cat.id} 
                            onClick={() => setActiveStickerTab(index)}
                            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeStickerTab === index ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Stickers Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-5 gap-4">
                        {STICKER_CATEGORIES[activeStickerTab].items.map((emoji, i) => (
                            <button 
                                key={i}
                                onClick={() => handleAddSticker(emoji)}
                                className="text-4xl hover:scale-125 transition-transform active:scale-95 flex items-center justify-center h-12"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* VOICE DRAWER (Recorder) */}
        {isVoiceDrawerOpen && (
            <div className="absolute bottom-0 left-0 right-0 z-30 bg-gray-900/95 backdrop-blur-xl border-t border-white/10 animate-in slide-in-from-bottom duration-300 pb-safe rounded-t-3xl flex flex-col items-center p-6" onClick={(e) => e.stopPropagation()}>
                <div className="w-full flex justify-between items-center mb-6">
                    <span className="text-sm font-bold text-white">التعليق الصوتي</span>
                    <button onClick={() => setIsVoiceDrawerOpen(false)} className="p-1 rounded-full hover:bg-white/10">
                        <X size={20} className="text-gray-300" />
                    </button>
                </div>

                {voiceoverBlob ? (
                    <div className="flex flex-col items-center gap-4 w-full">
                        <div className="bg-green-500/20 text-green-400 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm border border-green-500/30">
                            <Check size={16} />
                            تم تسجيل الصوت
                        </div>
                        <div className="flex gap-4 w-full justify-center">
                            <button 
                                onClick={deleteVoiceover}
                                className="px-6 py-2 bg-red-500/20 text-red-400 rounded-full font-bold text-xs flex items-center gap-2 hover:bg-red-500/30"
                            >
                                <Trash2 size={14} />
                                حذف التسجيل
                            </button>
                            <button 
                                onClick={() => setIsVoiceDrawerOpen(false)}
                                className="px-6 py-2 bg-white text-black rounded-full font-bold text-xs hover:bg-gray-200"
                            >
                                تم
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                            {/* Pulse Effect */}
                            {isRecordingVoice && (
                                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-50"></div>
                            )}
                            <button
                                onPointerDown={startVoiceRecording}
                                onPointerUp={stopVoiceRecording}
                                onPointerLeave={stopVoiceRecording} // Safety stop
                                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecordingVoice ? 'bg-red-600 scale-110 ring-4 ring-red-900' : 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-900/50'}`}
                            >
                                <Mic size={32} className="text-white" />
                            </button>
                        </div>
                        
                        <div className="flex flex-col items-center gap-1">
                            <span className={`text-xs font-bold font-mono ${isRecordingVoice ? 'text-red-400' : 'text-gray-500'}`}>
                                {formatDuration(recordingDuration)}
                            </span>
                            <span className="text-xs text-gray-400 font-medium">
                                {isRecordingVoice ? 'جاري التسجيل...' : 'اضغط واستمر للتسجيل'}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Effects Drawer (Video Filters) */}
        {isEffectsDrawerOpen && (
            <div className="absolute bottom-0 left-0 right-0 z-30 bg-black/80 backdrop-blur-xl border-t border-white/10 animate-in slide-in-from-bottom duration-300 pb-safe rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <Wand2 size={18} className="text-purple-400" />
                        <span className="text-sm font-bold text-white">المؤثرات</span>
                    </div>
                    <button onClick={() => setIsEffectsDrawerOpen(false)} className="p-1 rounded-full hover:bg-white/10">
                        <X size={20} className="text-gray-300" />
                    </button>
                </div>
                <div className="flex gap-3 overflow-x-auto p-4 no-scrollbar">
                    {VIDEO_FILTERS.map((filter) => (
                        <div 
                            key={filter.name} 
                            onClick={() => onFilterChange(filter.css)}
                            className="flex flex-col items-center gap-2 cursor-pointer group flex-shrink-0"
                        >
                            <div className={`w-16 h-20 rounded-lg overflow-hidden border-2 transition-all ${currentFilter === filter.css ? 'border-purple-500 scale-105' : 'border-transparent opacity-70 group-hover:opacity-100'}`}>
                                {/* Use a Static Image instead of Video to fix lag */}
                                <img 
                                    src={FILTER_PREVIEW_IMG} 
                                    alt={filter.name}
                                    className="w-full h-full object-cover" 
                                    style={{ filter: filter.css }}
                                />
                            </div>
                            <span className={`text-[10px] font-bold ${currentFilter === filter.css ? 'text-purple-400' : 'text-gray-400'}`}>{filter.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* CONTROLS BAR (Delete & Scale) - Show only when item selected */}
        {selectedItemId !== null && !isStickerDrawerOpen && !isEffectsDrawerOpen && !isVoiceDrawerOpen && (
            <div className="absolute bottom-10 left-0 right-0 px-6 z-30 flex items-end justify-between animate-in slide-in-from-bottom duration-200 pointer-events-none" onClick={(e) => e.stopPropagation()}>
                
                {/* Delete Button */}
                <button 
                    onClick={handleDeleteItem}
                    className="w-12 h-12 bg-red-600/90 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-lg pointer-events-auto active:scale-90 transition-transform"
                >
                    <Trash2 size={24} />
                </button>

                {/* Scale Slider */}
                <div className="bg-black/60 backdrop-blur-md p-4 rounded-2xl w-full max-w-[200px] border border-white/10 pointer-events-auto">
                    <div className="flex items-center justify-between text-white mb-2">
                        <Minus size={16} />
                        <span className="text-xs font-bold">{t('text_size')}</span>
                        <Plus size={16} />
                    </div>
                    <input 
                        type="range" 
                        min="0.5" 
                        max="4" 
                        step="0.1"
                        value={getSelectedItemScale()}
                        onChange={handleScaleChange}
                        className="w-full accent-blue-600 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default EditVideoView;
