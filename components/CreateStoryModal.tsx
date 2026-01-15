
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Palette, Type, Image as ImageIcon, 
  ChevronRight, ArrowRight, Wand2, Sticker
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CreateStoryModalProps {
  onClose: () => void;
  onPost: (storyPayload: any) => void; 
}

const GRADIENTS = [
  'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500',
  'bg-gradient-to-tr from-blue-400 to-emerald-400',
  'bg-gradient-to-bl from-orange-400 to-rose-400',
  'bg-gradient-to-br from-gray-900 to-gray-600',
  'bg-gradient-to-r from-slate-900 to-slate-700',
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
      
      {/* Top Bar - Android Style */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 pt-safe flex justify-between items-start bg-gradient-to-b from-black/40 to-transparent h-24">
        <button onClick={onClose} className="p-2 text-white/90 bg-black/10 rounded-full backdrop-blur-md active:scale-90 transition-transform">
          <X size={28} strokeWidth={2} />
        </button>
        
        {mode === 'text' && (
            <div className="flex gap-4">
               <button className="p-2 rounded-full bg-black/20 backdrop-blur-sm text-white hover:bg-black/30">
                  <Type size={24} />
               </button>
               <button 
                 onClick={() => setBgIndex(prev => (prev + 1) % GRADIENTS.length)}
                 className="p-2 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 text-white shadow-sm border border-white/20"
               >
                  <Palette size={24} />
               </button>
            </div>
        )}
      </div>

      {/* Editor Surface */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {mode === 'text' ? (
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('story_text_placeholder')}
                className="w-full bg-transparent border-none outline-none text-center font-black text-4xl text-white placeholder:text-white/50 resize-none drop-shadow-md h-full py-40"
                autoFocus
                dir="auto"
            />
        ) : (
            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                {mediaFile?.type.startsWith('video') ? (
                    <video src={mediaPreview!} autoPlay loop muted playsInline className="w-full h-full object-contain" />
                ) : (
                    <img src={mediaPreview!} alt="" className="w-full h-full object-contain" />
                )}
                
                {/* Image Editor Tools Overlay */}
                <div className="absolute top-4 right-4 flex flex-col gap-4">
                    <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
                        <Type size={20} />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
                        <Sticker size={20} />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
                        <Wand2 size={20} />
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Bottom Bar - Android Story Style */}
      <div className="pb-safe pt-4 px-4 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent min-h-[100px]">
         
         {/* Gallery Picker */}
         <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-lg border-2 border-white/30 overflow-hidden flex items-center justify-center bg-white/10 active:scale-95 transition-transform"
         >
            {mediaPreview ? (
                <img src={mediaPreview} className="w-full h-full object-cover" />
            ) : (
                <ImageIcon size={20} className="text-white" />
            )}
         </button>
         <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} />

         {/* Send Button (FAB) */}
         <button 
            onClick={handlePublish}
            disabled={mode === 'text' && !text.trim()}
            className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold text-sm shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
         >
            <span>{t('your_story')}</span>
            <div className={`w-6 h-6 rounded-full bg-black flex items-center justify-center ${language === 'ar' ? 'rotate-180' : ''}`}>
                <ArrowRight size={14} className="text-white" />
            </div>
         </button>

      </div>

    </div>
  );
};

export default CreateStoryModal;
