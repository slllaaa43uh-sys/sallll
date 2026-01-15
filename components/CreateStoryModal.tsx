
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Palette, Check, ALargeSmall, Image as ImageIcon, 
  ArrowLeft, Send, Type, Smile, Wand2, Trash2, Maximize, Minimize, Loader2
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CreateStoryModalProps {
  onClose: () => void;
  onPost: (storyPayload: any) => void; 
}

const GRADIENTS = [
  'bg-gradient-to-br from-[#6750A4] to-[#D0BCFF]', // Android Purple
  'bg-gradient-to-br from-[#1B6EF3] to-[#82B1FF]', // Android Blue
  'bg-gradient-to-br from-[#006A60] to-[#70F7E7]', // Android Teal
  'bg-gradient-to-br from-[#BA1A1A] to-[#FFDAD6]', // Android Red
  'bg-black',
];

const CreateStoryModal: React.FC<CreateStoryModalProps> = ({ onClose, onPost }) => {
  const { t, language } = useLanguage();
  const [mode, setMode] = useState<'text' | 'media'>('text');
  const [text, setText] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setMode('media');
    }
  };

  const handlePublish = () => {
    if (mode === 'text' && !text.trim()) return;
    onPost({
        type: mode,
        text: mode === 'text' ? text : undefined,
        backgroundColor: mode === 'text' ? GRADIENTS[bgIndex] : undefined,
        file: mediaFile || undefined
    });
    onClose();
  };

  return (
    <div className={`fixed inset-0 z-[2000] flex flex-col font-sans transition-colors duration-500 ${mode === 'text' ? GRADIENTS[bgIndex] : 'bg-black'}`}>
      
      {/* Android Style Transparent Header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 pt-safe flex justify-between items-center bg-gradient-to-b from-black/40 to-transparent">
        <button onClick={onClose} className="p-2 text-white bg-black/20 rounded-full backdrop-blur-md active:scale-90 transition-transform">
          <ArrowLeft size={24} className={language === 'en' ? 'rotate-180' : ''} />
        </button>
        
        <div className="flex gap-2">
            {mode === 'text' && (
                <button onClick={() => setBgIndex(prev => (prev + 1) % GRADIENTS.length)} className="p-2 bg-white/20 rounded-full text-white backdrop-blur-md">
                    <Palette size={22} />
                </button>
            )}
            <button 
                onClick={handlePublish}
                disabled={mode === 'text' && !text.trim()}
                className="bg-[#D0BCFF] text-[#381E72] px-6 py-2 rounded-full font-black text-sm shadow-xl active:scale-95 transition-all disabled:opacity-30"
            >
                {t('post_publish')}
            </button>
        </div>
      </div>

      {/* Editor Surface */}
      <div className="flex-1 flex items-center justify-center p-6">
        {mode === 'text' ? (
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('story_text_placeholder')}
                className="w-full bg-transparent border-none outline-none text-center font-bold text-4xl text-white placeholder:text-white/40 resize-none drop-shadow-xl"
                autoFocus
            />
        ) : (
            <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                {mediaFile?.type.startsWith('video') ? (
                    <video src={mediaPreview!} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                ) : (
                    <img src={mediaPreview!} alt="" className="w-full h-full object-cover" />
                )}
                {/* Visual Native Android Overlays */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none">
                     <div className="p-3 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 flex items-center gap-3 pointer-events-auto">
                        <Type size={18} className="text-white" />
                        <Smile size={18} className="text-white" />
                        <Wand2 size={18} className="text-white" />
                     </div>
                </div>
            </div>
        )}
      </div>

      {/* Bottom Switcher (Android Pill Design) */}
      <div className="pb-safe p-8 flex flex-col items-center gap-6">
         <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-full p-1.5 flex gap-1 shadow-2xl">
            <button 
                onClick={() => setMode('text')}
                className={`px-8 py-2.5 rounded-full text-sm font-black transition-all ${mode === 'text' ? 'bg-[#D0BCFF] text-[#381E72]' : 'text-white/60 hover:text-white'}`}
            >
                {t('story_type_text')}
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className={`px-8 py-2.5 rounded-full text-sm font-black transition-all ${mode === 'media' ? 'bg-[#D0BCFF] text-[#381E72]' : 'text-white/60 hover:text-white'}`}
            >
                {t('story_type_media')}
            </button>
         </div>
         <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
      </div>

    </div>
  );
};

export default CreateStoryModal;
