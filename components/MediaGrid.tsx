
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface MediaGridProps {
  media: Array<{
    url: string;
    type: 'image' | 'video';
    thumbnail?: string;
  }>;
  maxDisplay?: number;
  variant?: 'feed' | 'profile';
}

const MediaGrid: React.FC<MediaGridProps> = ({ media, maxDisplay = 3, variant = 'feed' }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Filter primarily for images for the grid, but you could adapt for video mixing
  const items = media.filter(m => m.type === 'image' || m.type === 'video');
  const displayItems = items.slice(0, maxDisplay);
  const remaining = items.length - maxDisplay;

  if (items.length === 0) return null;

  const bgClass = variant === 'feed' ? '' : 'bg-gray-100 border border-gray-100';
  const itemBgClass = variant === 'feed' ? '' : 'bg-gray-100';

  const handleMediaClick = (index: number) => {
    setActiveImageIndex(index);
    setLightboxOpen(true);
  };

  const renderItem = (item: typeof items[0], index: number, isOverlay: boolean = false) => {
    const isVideo = item.type === 'video';
    return (
      <div 
        key={index} 
        onClick={(e) => { e.stopPropagation(); handleMediaClick(index); }}
        className={`relative overflow-hidden cursor-pointer w-full h-full ${itemBgClass}`}
      >
        {isVideo ? (
           <video src={item.url} className="w-full h-full object-cover" />
        ) : (
           <img 
             src={item.url} 
             alt="" 
             className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" 
             loading="lazy" 
             decoding="async" 
           />
        )}
        
        {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="w-10 h-10 bg-white/80 rounded-full flex items-center justify-center">
                    <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-black border-b-[6px] border-b-transparent ml-1"></div>
                </div>
            </div>
        )}

        {isOverlay && remaining > 0 && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center transition-colors hover:bg-black/70">
            <span className="text-white text-2xl font-bold">+{remaining}</span>
          </div>
        )}
      </div>
    );
  };

  // 1 Item - FORCED ASPECT RATIO (Instagram Style 1:1)
  if (items.length === 1) {
    return (
      <div className={`w-full aspect-square rounded-lg overflow-hidden ${bgClass}`}>
         {renderItem(items[0], 0)}
         {lightboxOpen && <Lightbox media={items} initialIndex={activeImageIndex} onClose={() => setLightboxOpen(false)} />}
      </div>
    );
  }

  // 2 Items
  if (items.length === 2) {
    return (
      <div className={`grid grid-cols-2 gap-1 rounded-lg overflow-hidden h-64 ${bgClass}`}>
        {items.map((item, i) => renderItem(item, i))}
        {lightboxOpen && <Lightbox media={items} initialIndex={activeImageIndex} onClose={() => setLightboxOpen(false)} />}
      </div>
    );
  }

  // 3+ Items (Facebook Style - Fixed Grid Layout)
  // Using grid-rows-2 guarantees exact 50% split for the small images
  return (
    <div className={`grid grid-cols-2 grid-rows-2 gap-1 rounded-lg overflow-hidden border-none h-[360px] ${variant === 'feed' ? bgClass : 'border border-gray-100 bg-gray-100'}`}>
      {/* Big Image (Right in RTL): Spans 2 rows */}
      <div className="row-span-2 relative h-full">
         {renderItem(displayItems[0], 0)}
      </div>
      
      {/* Top Small Image (Left Top in RTL) */}
      <div className="relative h-full">
         {renderItem(displayItems[1], 1)}
      </div>

      {/* Bottom Small Image (Left Bottom in RTL) */}
      <div className="relative h-full">
         {renderItem(displayItems[2], 2, true)}
      </div>

      {lightboxOpen && <Lightbox media={items} initialIndex={activeImageIndex} onClose={() => setLightboxOpen(false)} />}
    </div>
  );
};

const Lightbox: React.FC<{ media: any[], initialIndex: number, onClose: () => void }> = ({ media, initialIndex, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const current = media[currentIndex];

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col animate-in fade-in duration-200">
            <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 bg-black/50 rounded-full text-white">
                <X size={24} />
            </button>
            
            <div className="flex-1 flex items-center justify-center relative">
                {current.type === 'video' ? (
                    <video src={current.url} controls autoPlay className="max-w-full max-h-full" />
                ) : (
                    <img src={current.url} alt="" className="max-w-full max-h-full object-contain" />
                )}
                
                {/* Navigation zones */}
                <div className="absolute inset-0 flex">
                    <div className="w-1/2 h-full" onClick={(e) => { e.stopPropagation(); if(currentIndex > 0) setCurrentIndex(prev => prev - 1); }}></div>
                    <div className="w-1/2 h-full" onClick={(e) => { e.stopPropagation(); if(currentIndex < media.length - 1) setCurrentIndex(prev => prev + 1); }}></div>
                </div>
            </div>
            
            <div className="p-4 bg-black/80 flex gap-2 overflow-x-auto justify-center">
                {media.map((m, i) => (
                    <div 
                        key={i} 
                        onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
                        className={`w-12 h-12 rounded-md overflow-hidden border-2 cursor-pointer flex-shrink-0 ${currentIndex === i ? 'border-blue-500' : 'border-transparent opacity-50'}`}
                    >
                        {m.type === 'video' ? (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white text-[8px]">VID</div>
                        ) : (
                            <img src={m.url} className="w-full h-full object-cover" />
                        )}
                    </div>
                ))}
            </div>
        </div>,
        document.body
    );
};

export default MediaGrid;
