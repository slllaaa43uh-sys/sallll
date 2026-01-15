
import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { API_BASE_URL } from '../constants';
import { HARAJ_CATEGORIES, JOB_CATEGORIES } from '../data/categories';
import { useLanguage } from '../contexts/LanguageContext';

interface ShortItem {
  id: string;
  title: string;
  views: string;
  thumbnail: string | null;
  videoUrl: string;
}

interface ShortsCarouselProps {
  onShortClick: (shortId: string) => void;
  title?: string;
  filterType?: 'forYou' | 'haraj' | 'jobs' | 'friends';
}

// 1. Shared Skeleton Component - Visual fix: Removed animate-pulse from full block
const CardSkeletonOverlay = () => (
  <div className="absolute inset-0 z-20 bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
      {/* Subtle pulsing dot instead of full card flashing */}
      <div className="w-8 h-8 bg-gray-300 dark:bg-gray-700 rounded-full animate-pulse"></div>
  </div>
);

// Sub-component to handle individual loading state
const ShortCard: React.FC<{ short: ShortItem; onClick: () => void }> = ({ short, onClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div 
      onClick={onClick}
      className="relative w-32 h-56 rounded-xl overflow-hidden cursor-pointer group bg-gray-200 shadow-sm border border-gray-100 flex-shrink-0"
    >
      {/* Visual Loading State (Overlay) */}
      {!isLoaded && <CardSkeletonOverlay />}

      {short.thumbnail ? (
        <img 
          src={short.thumbnail} 
          alt={short.title} 
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setIsLoaded(true)} 
        />
      ) : (
        <video 
          src={`${short.videoUrl}#t=0.1`} 
          className={`w-full h-full object-cover pointer-events-none transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          preload="metadata"
          muted
          playsInline
          onLoadedData={() => setIsLoaded(true)}
          onError={() => setIsLoaded(true)}
        />
      )}
      
      {/* Content Overlays - Only show when loaded */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80 flex flex-col justify-end p-2 pointer-events-none">
            {/* Views Count Display */}
            <div className="flex items-center gap-1 mb-1">
                <Play size={10} className="text-white fill-white" />
                <span className="text-white text-[10px] font-bold drop-shadow-md">{short.views}</span>
            </div>
            {/* Title */}
            <span className="text-white font-bold text-xs mb-0.5 shadow-sm line-clamp-1">{short.title}</span>
          </div>
          
          {/* Centered Play Button on Hover */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/30 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm pointer-events-none">
             <Play size={20} className="text-white fill-white" />
          </div>
      </div>
    </div>
  );
};

const ShortsCarousel: React.FC<ShortsCarouselProps> = ({ 
  onShortClick, 
  title = "فيديوهات قصيرة", 
  filterType = 'forYou' 
}) => {
  const { t, language } = useLanguage();
  const [shorts, setShorts] = useState<ShortItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const currentUserId = localStorage.getItem('userId');

    if (token) {
      // Determine URL based on filter type
      let url = `${API_BASE_URL}/api/v1/posts/shorts/for-you?limit=10`;
      
      if (filterType === 'haraj' || filterType === 'jobs') {
         // Fetch general shorts for categories then filter client side
         url = `${API_BASE_URL}/api/v1/posts?isShort=true&limit=50`;
      } else if (filterType === 'friends') {
         // Note: Assuming endpoint exists, otherwise fallback to for-you or handle client-side
         url = `${API_BASE_URL}/api/v1/posts/shorts/friends?limit=10`;
      }

      fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        const postsArray = data.posts || (Array.isArray(data) ? data : []);

        if (Array.isArray(postsArray) && postsArray.length > 0) {
          let filteredPosts = postsArray.filter((item: any) => {
                // 1. Must be strictly a Short (created via Shorts flow) or undefined (legacy)
                // BUT NOT EXPLICITLY FALSE
                if (item.isShort === false) return false;

                // 2. Must have media
                if (!item.media || item.media.length === 0) return false;
                
                // 3. Must NOT be my video
                const postUserId = item.user?._id || item.user?.id || item.user;
                if (currentUserId && postUserId && String(postUserId) === String(currentUserId)) {
                    return false;
                }
                
                return true;
            });

          // Apply Category Filter
          if (filterType === 'haraj') {
             const harajNames = HARAJ_CATEGORIES.map(c => c.name);
             filteredPosts = filteredPosts.filter((p: any) => p.category && harajNames.includes(p.category));
          } else if (filterType === 'jobs') {
             const jobNames = JOB_CATEGORIES.map(c => c.name);
             filteredPosts = filteredPosts.filter((p: any) => p.category && jobNames.includes(p.category));
          }

          const mappedShorts = filteredPosts.map((item: any) => {
              const videoMedia = item.media.find((m: any) => m.type === 'video') || item.media[0];
              
              let thumbnailUrl = videoMedia?.thumbnail;
              if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
                thumbnailUrl = `${API_BASE_URL}${thumbnailUrl}`;
              }

              let videoUrl = videoMedia?.url;
              if (videoUrl && !videoUrl.startsWith('http')) {
                videoUrl = `${API_BASE_URL}${videoUrl}`;
              }

              // FIX: Check both viewCount AND views property to align with backend/profile logic
              const rawViews = item.viewCount || item.views || 0;

              return {
                id: item._id || item.id,
                title: item.title || item.text?.substring(0, 30) || 'فيديو قصير',
                views: new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(rawViews),
                thumbnail: thumbnailUrl || null,
                videoUrl: videoUrl
              };
            });
            
          // Limit to 10 items for carousel
          setShorts(mappedShorts.slice(0, 10));
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load carousel shorts", err);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [filterType, language]);

  // If loading finished and no shorts found, hide the component
  if (!isLoading && shorts.length === 0) return null;

  return (
    <div className="bg-white mb-3 py-4 border-y border-gray-100 animate-in fade-in duration-500">
      <div className="px-4 mb-3 flex items-center gap-2">
         <div className={`p-1 rounded-md ${filterType === 'haraj' ? 'bg-orange-600' : filterType === 'jobs' ? 'bg-purple-600' : 'bg-red-600'}`}>
            <Play size={16} className="text-white fill-white" />
         </div>
         <h3 className="font-bold text-gray-800">{title}</h3>
      </div>
      
      <div className="overflow-x-auto no-scrollbar px-4">
        <div className="flex gap-2 min-w-max">
          {isLoading ? (
            // Loading State: Use EXACTLY the same structure and overlay as ShortCard
            Array.from({ length: 5 }).map((_, i) => (
              <div 
                key={i}
                className="relative w-32 h-56 rounded-xl overflow-hidden bg-gray-200 shadow-sm border border-gray-100 flex-shrink-0"
              >
                <CardSkeletonOverlay />
              </div>
            ))
          ) : (
            // Real Data
            shorts.map((short) => (
              <ShortCard 
                key={short.id} 
                short={short} 
                onClick={() => onShortClick(short.id)} 
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ShortsCarousel;
