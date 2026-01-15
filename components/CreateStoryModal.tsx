
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Type, Image as ImageIcon, 
  ChevronRight, ArrowRight, Sticker, Palette,
  Move, Trash2, Download, Save
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import Avatar from './Avatar';
import { API_BASE_URL } from '../constants';

interface CreateStoryModalProps {
  onClose: () => void;
  onPost: (storyPayload: any) => void; 
}

interface TextOverlay {
  id: number;
  text: string;
  color: string;
  x: number;
  y: number;
  scale: number;
}

const COLORS = ['#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE', '#FF2D55'];

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
  
  // Base Content
  const [mainText, setMainText] = useState(''); // For text-only mode
  const [bgIndex, setBgIndex] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  
  // Overlays (Android Style Editing)
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [isTextEditorOpen, setIsTextEditorOpen] = useState(false);
  const [currentEditText, setCurrentEditText] = useState('');
  const [currentEditColor, setCurrentEditColor] = useState('#FFFFFF');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userName = localStorage.getItem('userName') || 'User';
  const userAvatar = localStorage.getItem('userAvatar');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setMode('media');
    }
  };

  const handleAddTextOverlay = () => {
      if (!currentEditText.trim()) {
          setIsTextEditorOpen(false);
          return;
      }
      const newOverlay: TextOverlay = {
          id: Date.now(),
          text: currentEditText,
          color: currentEditColor,
          x: 50, // Center %
          y: 50, // Center %
          scale: 1
      };
      setOverlays([...overlays, newOverlay]);
      setCurrentEditText('');
      setIsTextEditorOpen(false);
  };

  const removeOverlay = (id: number) => {
      setOverlays(prev => prev.filter(o => o.id !== id));
  };

  const handlePublish = () => {
    if (mode === 'text' && !mainText.trim()) return;
    
    // Prepare payload
    onPost({
        type: mode,
        text: mode === 'text' ? mainText : undefined,
        backgroundColor: mode === 'text' ? GRADIENTS[bgIndex] : undefined,
        file: mediaFile || undefined,
        overlays: overlays.map(o => ({
            id: o.id,
            type: 'text',
            content: o.text,
            x: o.x, // Simplified position mapping
            y: o.y,
            scale: o.scale,
            color: o.color
        }))
    });
    onClose();
  };

  return (
    <div className={`fixed inset-0 z-[2000] flex flex-col font-sans transition-colors duration-500 overflow-hidden ${mode === 'text' ? GRADIENTS[bgIndex] : 'bg-black'}`}>
      
      {/* 1. TOP TOOLBAR (Android Style - Icons Only) */}
      <div className="absolute top-0 left-0 right-0 z-30 pt-safe px-4 pb-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent h-32">
        <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-colors"
        >
          <X size={24} />
        </button>
        
        <div className="flex gap-4">
           {mode === 'text' && (
               <button 
                 onClick={() => setBgIndex(prev => (prev + 1) % GRADIENTS.length)}
                 className="w-10 h-10 flex items-center justify-center bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40"
               >
                  <Palette size={20} />
               </button>
           )}
           
           {/* Text Overlay Tool */}
           <button 
             onClick={() => setIsTextEditorOpen(true)}
             className="w-10 h-10 flex items-center justify-center bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40"
           >
              <Type size={20} />
           </button>

           {/* Sticker Tool (Visual only for now) */}
           <button className="w-10 h-10 flex items-center justify-center bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40">
              <Sticker size={20} />
           </button>
        </div>
      </div>

      {/* 2. EDITOR SURFACE */}
      <div className="flex-1 flex items-center justify-center relative w-full h-full">
        {mode === 'text' ? (
            <textarea
                value={mainText}
                onChange={(e) => setMainText(e.target.value)}
                placeholder={t('story_text_placeholder')}
                className="w-full h-full bg-transparent border-none outline-none text-center font-black text-4xl text-white placeholder:text-white/50 resize-none drop-shadow-md py-40 px-8"
                autoFocus={!isTextEditorOpen}
                dir="auto"
            />
        ) : (
            <div className="relative w-full h-full bg-black flex items-center justify-center">
                {mediaFile?.type.startsWith('video') ? (
                    <video src={mediaPreview!} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                ) : (
                    <img src={mediaPreview!} alt="" className="w-full h-full object-cover" />
                )}
            </div>
        )}

        {/* Render Overlays */}
        {overlays.map((overlay) => (
            <div 
                key={overlay.id}
                className="absolute z-20 cursor-move select-none"
                style={{
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    transform: 'translate(-50%, -50%)',
                }}
            >
                <div className="relative group">
                    <span 
                        className="font-bold text-2xl px-3 py-1 rounded-lg backdrop-blur-sm"
                        style={{ 
                            color: overlay.color, 
                            backgroundColor: overlay.color === '#FFFFFF' ? 'rgba(0,0,0,0.5)' : 'white',
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                    >
                        {overlay.text}
                    </span>
                    <button 
                        onClick={() => removeOverlay(overlay.id)}
                        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        ))}
      </div>

      {/* 3. BOTTOM BAR (Android Story Action Bar) */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pb-safe pt-6 px-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between min-h-[100px]">
         
         {/* Left: Gallery (Hidden Input) */}
         {mode === 'text' && (
             <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 rounded-lg border-2 border-white/40 overflow-hidden flex items-center justify-center bg-white/10 active:scale-95 transition-transform"
             >
                <ImageIcon size={20} className="text-white" />
             </button>
         )}
         {/* If Media mode, show "Save" icon instead just for visual balance */}
         {mode === 'media' && (
             <button className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors">
                 <Download size={20} className="text-white" />
             </button>
         )}
         
         <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} />

         {/* Right: Action Buttons */}
         <div className="flex items-center gap-3">
             {/* "Your Story" Button */}
             <button 
                onClick={handlePublish}
                disabled={mode === 'text' && !mainText.trim()}
                className="flex flex-col items-center gap-1 active:scale-95 transition-transform disabled:opacity-50"
             >
                 <div className="relative">
                     <Avatar 
                        name={userName} 
                        src={userAvatar ? (userAvatar.startsWith('http') ? userAvatar : `${API_BASE_URL}${userAvatar}`) : null} 
                        className="w-10 h-10 border-2 border-white" 
                     />
                     <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5 border border-white">
                         <div className="w-2 h-2 bg-white rounded-full"></div>
                     </div>
                 </div>
                 <span className="text-[10px] font-bold text-white shadow-sm">{t('your_story')}</span>
             </button>

             {/* "Close Friends" (Visual) */}
             <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform opacity-90">
                 <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center border-2 border-white text-white">
                     <Save size={18} />
                 </div>
                 <span className="text-[10px] font-bold text-white shadow-sm">الأصدقاء</span>
             </button>

             {/* Send Button (Big FAB) */}
             <button 
                onClick={handlePublish}
                disabled={mode === 'text' && !mainText.trim()}
                className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform ml-2 disabled:opacity-50"
             >
                <ArrowRight size={24} className={language === 'ar' ? 'rotate-180' : ''} />
             </button>
         </div>

      </div>

      {/* 4. TEXT EDITOR OVERLAY (Full Screen Input) */}
      {isTextEditorOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
              {/* Header */}
              <div className="flex justify-between items-center p-4 pt-safe">
                  <button onClick={() => setIsTextEditorOpen(false)} className="text-white font-bold">{t('cancel')}</button>
                  <button onClick={handleAddTextOverlay} className="bg-white text-black px-4 py-1.5 rounded-full font-bold text-sm">{t('done')}</button>
              </div>
              
              {/* Input */}
              <div className="flex-1 flex items-center justify-center px-8">
                  <textarea
                      value={currentEditText}
                      onChange={(e) => setCurrentEditText(e.target.value)}
                      placeholder={t('type_something')}
                      className="w-full bg-transparent border-none outline-none text-center font-black text-3xl text-white placeholder:text-white/50 resize-none h-1/2"
                      style={{ color: currentEditColor }}
                      autoFocus
                  />
              </div>

              {/* Color Picker */}
              <div className="pb-safe p-4 flex justify-center gap-3 overflow-x-auto no-scrollbar">
                  {COLORS.map(c => (
                      <button
                          key={c}
                          onClick={() => setCurrentEditColor(c)}
                          className={`w-8 h-8 rounded-full border-2 transition-transform ${currentEditColor === c ? 'border-white scale-125' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                      />
                  ))}
              </div>
          </div>
      )}

    </div>
  );
};

export default CreateStoryModal;
