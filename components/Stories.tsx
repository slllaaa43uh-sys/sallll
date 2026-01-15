
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Trash2, Eye, Loader2, Image as ImageIcon } from 'lucide-react';
import Avatar from './Avatar';
import { API_BASE_URL } from '../constants';
import { Story, StoryGroup } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface StoriesProps {
  onCreateStory?: () => void;
  refreshKey?: number;
  isUploading?: boolean;
  uploadProgress?: number;
  pendingStory?: { type: 'text'|'image'|'video', content: string, color?: string } | null;
}

interface Viewer {
  user: {
    _id: string;
    name: string;
    avatar?: string;
  };
  viewedAt: string;
}

// --- THUMBNAIL COMPONENT ---
const StoryThumbnail = ({ src, type, alt }: { src: string; type: string; alt: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const videoRef = useRef<HTMLVideoElement>(null);

  const isVideo = 
    (type && (type === 'video' || (typeof type === 'string' && type.toLowerCase().includes('video')))) || 
    (src && (src.endsWith('.mp4') || src.endsWith('.mov') || src.endsWith('.webm') || src.startsWith('blob:')));

  useEffect(() => {
    if (isVideo && videoRef.current) {
        videoRef.current.defaultMuted = true;
        videoRef.current.muted = true;
        // Try to play to get a frame, then pause if needed, but for thumbnail we just let it load
        videoRef.current.play().catch(() => {});
    }
  }, [isVideo, src]);

  if (hasError) {
    return (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
         <ImageIcon className="text-gray-400 opacity-50" size={24} />
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="w-full h-full relative bg-black overflow-hidden">
        <video 
          ref={videoRef}
          src={src} 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none" 
          muted 
          playsInline 
          autoPlay
          loop
          disablePictureInPicture
          controls={false}
          onLoadedData={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-gray-200 overflow-hidden">
      <img 
        src={src} 
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
};

const Stories: React.FC<StoriesProps> = ({ onCreateStory, refreshKey, isUploading = false, uploadProgress = 0, pendingStory }) => {
  const { t, language } = useLanguage();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Viewer State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // Video States
  const [isBuffering, setIsBuffering] = useState(true); 
  const [isVideoPlaying, setIsVideoPlaying] = useState(false); 
  const [isVideoVisible, setIsVideoVisible] = useState(false); // To prevent flash
  
  // Viewers List State
  const [isViewersModalOpen, setIsViewersModalOpen] = useState(false);
  const [viewersList, setViewersList] = useState<Viewer[]>([]);
  const [isLoadingViewers, setIsLoadingViewers] = useState(false);
  
  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const isTransitioningRef = useRef(false); // CRITICAL: Prevents double skipping
  
  const currentUserId = localStorage.getItem('userId');
  const myName = localStorage.getItem('userName') || 'مستخدم';
  const myAvatar = localStorage.getItem('userAvatar');

  // --- HELPER: Fix Media URLs ---
  const getMediaUrl = (url: string | undefined) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    const base = API_BASE_URL.replace(/\/+$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
  };

  const getTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);

    if (seconds < 60) return language === 'ar' ? `الآن` : `Just now`;
    if (minutes < 60) return language === 'ar' ? `منذ ${minutes} د` : `${minutes}m ago`;
    if (hours < 24) return language === 'ar' ? `منذ ${hours} س` : `${hours}h ago`;
    
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric'});
  };

  const getUserId = (user: any) => {
      if (!user) return '';
      if (typeof user === 'string') return user;
      return user._id || user.id || '';
  };

  useEffect(() => {
    const fetchStories = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const [feedRes, myStoriesRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/v1/stories/all`),
            fetch(`${API_BASE_URL}/api/v1/stories/user/${currentUserId}`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        let rawStories: Story[] = [];

        if (feedRes.ok) {
          const data = await feedRes.json();
          const groups = data.storyGroups || data.usersWithStories || [];
          if (Array.isArray(groups)) {
             groups.forEach((item: any) => {
                const storyUser = item.user || { _id: item._id, name: item.name, avatar: item.avatar };
                if (item.stories && Array.isArray(item.stories)) {
                    item.stories.forEach((s: any) => rawStories.push({ ...s, user: storyUser }));
                }
             });
          } else if (Array.isArray(data)) {
             rawStories = [...rawStories, ...data];
          }
        }

        if (myStoriesRes.ok) {
            const myData = await myStoriesRes.json();
            const myStoriesList = Array.isArray(myData) ? myData : (myData.stories || []);
            myStoriesList.forEach((s: any) => {
                const storyWithUser = { ...s, user: s.user || { _id: currentUserId, name: myName, avatar: myAvatar } };
                rawStories.push(storyWithUser);
            });
        }
          
        const uniqueStoriesMap = new Map();
        rawStories.forEach(s => { const id = s._id || (s as any).id; if (id) uniqueStoriesMap.set(id, s); });
        const uniqueStories = Array.from(uniqueStoriesMap.values()) as Story[];

        const groupsMap = new Map<string, StoryGroup>();
        const myGroup: StoryGroup = { user: { id: currentUserId || 'me', _id: currentUserId || 'me', name: myName, avatar: myAvatar || '' }, stories: [], hasUnseen: false, isUser: true };

        uniqueStories.forEach((story: Story) => {
            const storyUserId = getUserId(story.user);
            const isMe = currentUserId && String(storyUserId) === String(currentUserId);
            if (isMe) {
                if (!story.user.avatar && myAvatar) story.user.avatar = myAvatar;
                if (!myGroup.stories.some(s => s._id === story._id)) myGroup.stories.push(story);
            } else {
                if (!groupsMap.has(storyUserId)) {
                    groupsMap.set(storyUserId, { user: { ...story.user, id: storyUserId }, stories: [], hasUnseen: true, isUser: false });
                }
                const group = groupsMap.get(storyUserId);
                if (group && !group.stories.some(s => s._id === story._id)) group.stories.push(story);
            }
        });

        const sortByDate = (a: Story, b: Story) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        myGroup.stories.sort(sortByDate);
        groupsMap.forEach(g => g.stories.sort(sortByDate));

        const finalGroups = Array.from(groupsMap.values());
        if (myGroup.stories.length > 0) finalGroups.unshift(myGroup);

        setStoryGroups(finalGroups);
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchStories();
  }, [refreshKey, currentUserId, myName, myAvatar, isUploading]);

  const handleCreateClick = (e: React.MouseEvent) => { 
      e.stopPropagation();
      if (onCreateStory) onCreateStory(); 
  };

  const openViewer = async (groupIndex: number) => {
    const group = storyGroups[groupIndex];
    if (!group || !group.stories.length) return;

    if (isUploading && groupIndex === 0 && group.stories.length === 0) return;

    window.dispatchEvent(new CustomEvent('story-viewer-toggle', { detail: { isOpen: true } }));
    setActiveGroupIndex(groupIndex);
    setActiveStoryIndex(0); 
    setViewerOpen(true);
    setProgress(0);
    setIsPaused(false);
    isTransitioningRef.current = false;
    
    setIsVideoPlaying(false);
    setIsBuffering(true);
    setIsVideoVisible(false); // Hide video initially
    
    if (isUploading && groupIndex === 0) return;

    const userId = getUserId(group.user);
    const token = localStorage.getItem('token');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/stories/user/${userId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        const fullStories = Array.isArray(data) ? data : (data.stories || []);
        const updatedGroups = [...storyGroups];
        if (Array.isArray(fullStories)) {
            fullStories.sort((a: Story, b: Story) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            const mappedStories = fullStories.map((s:any) => ({ ...s, user: s.user || group.user }));
            if (updatedGroups[groupIndex]) {
               updatedGroups[groupIndex].stories = mappedStories;
               setStoryGroups(updatedGroups);
            }
        }
      }
    } catch (error) { console.error(error); }
  };

  const closeViewer = () => {
    window.dispatchEvent(new CustomEvent('story-viewer-toggle', { detail: { isOpen: false } }));
    setViewerOpen(false);
    setActiveGroupIndex(0);
    setActiveStoryIndex(0);
    setProgress(0);
    setIsPaused(false);
    setIsBuffering(false);
    setIsVideoPlaying(false);
    setIsVideoVisible(false);
    setIsDeleteModalOpen(false);
    setIsViewersModalOpen(false);
    isTransitioningRef.current = false;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
  };

  // Reset video state when story changes
  useEffect(() => { 
      setIsVideoPlaying(false); 
      setIsBuffering(true); 
      setIsVideoVisible(false); 
      isTransitioningRef.current = false;
  }, [activeStoryIndex, activeGroupIndex]);

  const handleDeleteClick = () => { setIsPaused(true); setIsDeleteModalOpen(true); };
  
  const handleConfirmDelete = async () => {
      setIsDeleting(true);
      const currentGroup = storyGroups[activeGroupIndex];
      const currentStory = currentGroup?.stories[activeStoryIndex];
      if (!currentStory) return;

      const token = localStorage.getItem('token');
      
      try {
          const response = await fetch(`${API_BASE_URL}/api/v1/stories/${currentStory._id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
              const updatedStories = currentGroup.stories.filter(s => s._id !== currentStory._id);
              if (updatedStories.length === 0) {
                  closeViewer();
                  setStoryGroups(prev => prev.filter((_, i) => i !== activeGroupIndex));
              } else {
                  const updatedGroups = [...storyGroups];
                  updatedGroups[activeGroupIndex].stories = updatedStories;
                  setStoryGroups(updatedGroups);
                  // Safety check for index
                  if (activeStoryIndex >= updatedStories.length) {
                      setActiveStoryIndex(Math.max(0, updatedStories.length - 1));
                  }
                  setIsDeleteModalOpen(false);
                  setIsPaused(false);
              }
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsDeleting(false);
      }
  };

  const handleShowViewers = async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsPaused(true);
      setIsViewersModalOpen(true);
      setIsLoadingViewers(true);
      
      const currentGroup = storyGroups[activeGroupIndex];
      const currentStory = currentGroup?.stories[activeStoryIndex];
      if (!currentStory) return;

      const token = localStorage.getItem('token');

      try {
          if (currentStory.views && currentStory.views.length > 0 && typeof currentStory.views[0] !== 'string') {
              setViewersList(currentStory.views as any[]);
              setIsLoadingViewers(false);
              return;
          }

          const response = await fetch(`${API_BASE_URL}/api/v1/stories/${currentStory._id}/viewers`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
              const data = await response.json();
              if (data.viewers) {
                  setViewersList(data.viewers);
              } else {
                  setViewersList([]);
              }
          }
      } catch (e) {
          console.error(e);
          setViewersList([]);
      } finally {
          setIsLoadingViewers(false);
      }
  };

  const currentGroup = storyGroups[activeGroupIndex];
  const currentStory = currentGroup?.stories?.[activeStoryIndex];

  // --- TRANSITION LOGIC ---
  const handleNext = useCallback(() => { 
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;

      const currentGroup = storyGroups[activeGroupIndex]; 
      if (!currentGroup) { closeViewer(); return; }

      if (activeStoryIndex < currentGroup.stories.length - 1) { 
          setActiveStoryIndex(prev => prev + 1); 
          setProgress(0); 
      } else { 
          if (activeGroupIndex < storyGroups.length - 1) { 
              setActiveGroupIndex(prev => prev + 1); 
              setActiveStoryIndex(0); 
              setProgress(0); 
          } else { 
              closeViewer(); 
          } 
      } 
  }, [activeStoryIndex, activeGroupIndex, storyGroups]);

  const handlePrev = useCallback(() => { 
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;

      if (activeStoryIndex > 0) { 
          setActiveStoryIndex(prev => prev - 1); 
          setProgress(0); 
      } else if (activeGroupIndex > 0) { 
          const prevGroup = storyGroups[activeGroupIndex - 1];
          setActiveGroupIndex(prev => prev - 1); 
          setActiveStoryIndex(prevGroup.stories.length - 1); 
          setProgress(0); 
      } else { 
          closeViewer(); 
      } 
  }, [activeStoryIndex, activeGroupIndex, storyGroups]);

  // --- TRIM & PLAYBACK LOGIC ---
  const onVideoTimeUpdate = () => { 
      if (videoRef.current && !isPaused && !isBuffering) { 
          const currentTime = videoRef.current.currentTime;
          
          const start = (currentStory as any)?.trimData?.start ?? (currentStory as any)?.trimStart ?? 0;
          const end = (currentStory as any)?.trimData?.end ?? (currentStory as any)?.trimEnd ?? videoRef.current.duration;
          
          // Trimming Logic: End video if we passed the trim end
          if (currentTime >= end) {
              videoRef.current.pause();
              handleNext();
              return;
          }

          // Safety: Correct time if it drifted before start
          if (currentTime < start) {
              videoRef.current.currentTime = start;
          }

          const totalDuration = Math.max(0.1, end - start);
          const elapsed = Math.max(0, currentTime - start);
          const percent = Math.min(100, (elapsed / totalDuration) * 100);
          setProgress(percent); 
      } 
  };

  const onVideoLoadedMetadata = () => {
      if (videoRef.current) {
          const start = (currentStory as any)?.trimData?.start ?? (currentStory as any)?.trimStart ?? 0;
          // Set start time immediately to avoid flash of frame 0
          videoRef.current.currentTime = start;
          setIsVideoVisible(true); // Show video only after seeking to correct start
          
          if (!isPaused) {
              videoRef.current.play().catch(() => {});
          }
      }
  };

  const onVideoPlay = () => {
      setIsBuffering(false);
      setIsVideoPlaying(true);
  };

  const onVideoEnded = () => {
      // Primary handler is onTimeUpdate for trimming, but this catches full plays
      handleNext();
  };
  
  const onVideoWaiting = () => setIsBuffering(true);
  
  const recordView = async (storyId: string) => {
      const token = localStorage.getItem('token');
      try {
          await fetch(`${API_BASE_URL}/api/v1/stories/${storyId}/view`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
      } catch (e) { console.error(e); }
  };
  
  // MAIN EFFECT FOR STORY PLAYBACK
  useEffect(() => {
    if (!viewerOpen) return;
    const currentGroup = storyGroups[activeGroupIndex];
    if (!currentGroup?.stories?.length) { closeViewer(); return; }
    
    const currentStory = currentGroup.stories[activeStoryIndex];
    if (!currentStory) return; 

    const isVideo = currentStory.media?.type === 'video' || (typeof currentStory.media?.type === 'string' && currentStory.media.type.includes('video'));
    
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    
    // Mark as viewed
    if (!currentGroup.isUser && currentStory._id) { 
        const viewedKey = `viewed_story_${currentStory._id}`; 
        if (!sessionStorage.getItem(viewedKey)) { 
            recordView(currentStory._id); 
            sessionStorage.setItem(viewedKey, 'true'); 
        } 
    }
    
    if (isVideo) { 
        setProgress(0);
        // Video logic is handled by event listeners on the <video> tag
        // We do NOT seek here, we seek in onLoadedMetadata to avoid race conditions
    } else { 
        // IMAGE LOGIC
        setIsBuffering(false); 
        setIsVideoPlaying(true); 
        const duration = 5000; 
        if (!isPaused) { 
            if (progress === 0 || progress >= 100) { 
                startTimeRef.current = Date.now(); 
                setProgress(0); 
            } else { 
                const elapsed = (progress / 100) * duration; 
                startTimeRef.current = Date.now() - elapsed; 
            } 
            progressTimerRef.current = setInterval(() => { 
                const now = Date.now(); 
                const elapsed = now - startTimeRef.current; 
                const pct = Math.min((elapsed / duration) * 100, 100); 
                setProgress(pct); 
                if (pct >= 100) { 
                    clearInterval(progressTimerRef.current); 
                    handleNext(); 
                } 
            }, 50); 
        } 
    }
    return () => clearInterval(progressTimerRef.current);
  }, [viewerOpen, activeGroupIndex, activeStoryIndex, storyGroups, isPaused, handleNext]);

  // --- SAFE USER PREVIEW LOGIC ---
  const myStoryGroup = storyGroups.find(g => g.isUser);
  const myLatestStory = myStoryGroup?.stories?.[myStoryGroup.stories.length - 1];
  const userHasStories = !!myLatestStory;

  return (
    <>
      <div className="bg-white py-4 mb-2 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 px-3 min-w-max">
          
          {/* Create Story Button */}
          <div 
            onClick={handleCreateClick}
            className="relative w-24 h-40 flex-shrink-0 rounded-xl overflow-hidden cursor-pointer group border border-gray-100 shadow-sm bg-white transition-transform active:scale-95"
          >
             <div className="h-3/4 w-full relative bg-gray-50">
                <Avatar name={myName} src={myAvatar ? (myAvatar.startsWith('http') ? myAvatar : getMediaUrl(myAvatar)) : null} className="w-full h-full rounded-none object-cover" textClassName="text-2xl" />
                <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors" />
             </div>
             <div className="h-1/4 w-full bg-white relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 rounded-full p-0.5 border-2 border-white z-10">
                    <Plus size={16} className="text-white" strokeWidth={3} />
                </div>
                <div className="w-full h-full flex items-end justify-center pb-1.5">
                    <span className="text-[10px] font-bold text-gray-900">{t('create_story')}</span>
                </div>
             </div>
          </div>

          {/* User's Story Preview */}
          {(isUploading || userHasStories) && (
             <div 
               onClick={() => !isUploading && openViewer(0)} 
               className="relative w-24 h-40 flex-shrink-0 rounded-xl overflow-hidden cursor-pointer group border border-gray-100 shadow-sm transition-transform active:scale-95 bg-white"
             >
                 {isUploading && pendingStory ? (
                     <>
                        <div className="absolute inset-0 w-full h-full">
                            {pendingStory.type === 'text' ? (
                                <div className={`w-full h-full ${pendingStory.color || 'bg-blue-500'} flex items-center justify-center`}>
                                    <p className="text-white text-[8px] px-1 truncate">{pendingStory.content}</p>
                                </div>
                            ) : (
                                <StoryThumbnail 
                                    src={pendingStory.content} 
                                    type={pendingStory.type} 
                                    alt="preview" 
                                />
                            )}
                        </div>
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
                             <div className="relative w-12 h-12 flex items-center justify-center">
                                {/* SVG Circular Progress */}
                                <svg className="transform -rotate-90 w-12 h-12">
                                    <circle
                                        cx="24"
                                        cy="24"
                                        r="18"
                                        stroke="rgba(255,255,255,0.3)"
                                        strokeWidth="3"
                                        fill="transparent"
                                    />
                                    <circle
                                        cx="24"
                                        cy="24"
                                        r="18"
                                        stroke="#3b82f6" 
                                        strokeWidth="3"
                                        fill="transparent"
                                        strokeDasharray={113} 
                                        strokeDashoffset={113 - (uploadProgress / 100) * 113}
                                        strokeLinecap="round"
                                        className="transition-all duration-300 ease-out"
                                    />
                                </svg>
                             </div>
                        </div>
                        <span className="absolute bottom-2 right-2 text-white font-bold text-[10px] drop-shadow-md z-40">
                            {t('sending')} {Math.round(uploadProgress)}%
                        </span>
                     </>
                 ) : myLatestStory ? (
                     <>
                        <div className="absolute inset-0 w-full h-full">
                            {myLatestStory.media?.url ? (
                                <StoryThumbnail 
                                    src={getMediaUrl(myLatestStory.media.url)} 
                                    type={myLatestStory.media.type || 'image'} 
                                    alt={myName} 
                                />
                            ) : (
                                <div className={`w-full h-full ${myLatestStory.backgroundColor || 'bg-blue-500'} flex items-center justify-center`}>
                                    <p className="text-white text-[8px] px-1 truncate">{myLatestStory.text}</p>
                                </div>
                            )}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
                        <div className="absolute top-2 left-2 p-0.5 rounded-full border-2 border-blue-500 z-10 bg-transparent">
                            <Avatar name={myName} src={myAvatar ? (myAvatar.startsWith('http') ? myAvatar : getMediaUrl(myAvatar)) : null} className="w-8 h-8 rounded-full border border-white" textClassName="text-[10px]" />
                        </div>
                        <span className="absolute bottom-2 right-2 text-white font-bold text-[10px] drop-shadow-md z-10 truncate max-w-[90%] text-right leading-tight">
                            {t('your_story')}
                        </span>
                     </>
                 ) : null}
             </div>
          )}

          {/* Other Users' Stories */}
          {storyGroups.map((group, idx) => {
             if (group.isUser) return null;
             const displayName = group.user.name;
             const displayAvatar = group.user.avatar;
             const latestStory = group.stories[group.stories.length - 1];
             if (!latestStory) return null;

             const hasMedia = latestStory.media && latestStory.media.url;
             const mediaUrl = hasMedia ? getMediaUrl(latestStory.media?.url) : '';

             return (
              <div key={group.user.id || idx} onClick={() => openViewer(idx)} className="relative w-24 h-40 flex-shrink-0 rounded-xl overflow-hidden cursor-pointer group shadow-sm border border-gray-100 transition-transform active:scale-95 bg-white" >
                 <div className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-105">
                     {hasMedia ? (
                        <StoryThumbnail src={mediaUrl} type={latestStory.media?.type as string} alt={displayName} />
                     ) : (
                        <div className={`w-full h-full ${latestStory.backgroundColor || 'bg-gradient-to-br from-blue-500 to-purple-600'} flex items-center justify-center p-2`}>
                            <p className="text-white text-[8px] line-clamp-4 text-center">{latestStory.text}</p>
                        </div>
                     )}
                 </div>
                 <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
                 <div className={`absolute top-2 left-2 p-0.5 rounded-full border-2 ${group.hasUnseen ? 'border-blue-500' : 'border-white'} z-10 bg-transparent`}>
                     <Avatar name={displayName} src={displayAvatar ? (displayAvatar.startsWith('http') ? displayAvatar : getMediaUrl(displayAvatar)) : null} className="w-8 h-8 rounded-full border border-white" textClassName="text-[10px]" />
                 </div>
                 <span className="absolute bottom-2 right-2 text-white font-bold text-[10px] shadow-black drop-shadow-md z-10 truncate max-w-[90%] text-right leading-tight">
                    {displayName}
                 </span>
              </div>
             );
          })}
        </div>
      </div>

      {viewerOpen && currentStory && currentGroup && createPortal(
          <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in duration-200">
             
             <div className="absolute top-0 left-0 right-0 z-[100] pt-safe px-2 py-3 flex gap-1 pointer-events-none">
                {currentGroup.stories.map((s, i) => {
                    let width = '0%';
                    if (i < activeStoryIndex) width = '100%';
                    else if (i === activeStoryIndex) width = `${progress}%`;
                    return (
                        <div key={s._id || i} className="h-0.5 bg-white/30 flex-1 rounded-full overflow-hidden">
                            <div className="h-full bg-white transition-all duration-75 ease-linear" style={{ width }} />
                        </div>
                    );
                })}
             </div>

             <div className="absolute top-8 left-0 right-0 z-[100] px-4 flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                   <Avatar name={currentGroup.user.name} src={currentGroup.user.avatar ? (currentGroup.user.avatar.startsWith('http') ? currentGroup.user.avatar : getMediaUrl(currentGroup.user.avatar)) : null} className="w-9 h-9 border border-white/20" />
                   <div>
                       <h4 className="text-white font-bold text-sm shadow-black drop-shadow-md">{currentGroup.user.name}</h4>
                       <span className="text-white/70 text-xs shadow-black drop-shadow-md">{getTimeAgo(currentStory.createdAt)}</span>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                    {currentGroup.isUser && (
                         <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }} className="p-2 hover:bg-white/10 rounded-full"><Trash2 size={20} className="text-white" /></button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); closeViewer(); }} className="p-2 hover:bg-white/10 rounded-full"><X size={24} className="text-white" /></button>
                </div>
             </div>
             
             <div className="flex-1 relative bg-black flex items-center justify-center">
                 {/* Only show loader if we explicitly need to buffer and video isn't visible yet */}
                 {isBuffering && !isVideoVisible && (
                     <div className="absolute inset-0 z-50 flex items-center justify-center bg-black pointer-events-none">
                         <Loader2 size={48} className="text-white animate-spin" />
                     </div>
                 )}

                 {/* BACKGROUND BLUR IF CONTAIN MODE - Robust Check */}
                 {((currentStory.objectFit || (currentStory as any).object_fit || 'cover') === 'contain') && currentStory.media?.url && (
                    <div 
                        className="absolute inset-0 w-full h-full bg-cover bg-center blur-xl opacity-30 scale-125 pointer-events-none"
                        style={{ 
                            backgroundImage: `url(${getMediaUrl(currentStory.media.url)})`,
                            zIndex: 0 
                        }}
                    />
                 )}

                 {currentStory.text ? (
                     <div className={`w-full h-full flex items-center justify-center p-8 ${currentStory.backgroundColor || 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                         <p className="text-white text-2xl font-bold text-center leading-relaxed whitespace-pre-wrap">{currentStory.text}</p>
                     </div>
                 ) : (
                     (currentStory.media?.type === 'video' || (typeof currentStory.media?.type === 'string' && currentStory.media.type.includes('video'))) ? (
                        <div className="relative w-full h-full flex items-center justify-center z-10 overflow-hidden">
                           <video 
                              key={currentStory._id} 
                              ref={videoRef}
                              src={getMediaUrl(currentStory.media!.url)}
                              autoPlay={!isPaused} 
                              playsInline
                              // Hide video until we seeked to correct start time to prevent flash
                              className={`w-full h-full transition-opacity duration-200 ${isVideoVisible ? 'opacity-100' : 'opacity-0'}`}
                              style={{
                                  objectFit: (currentStory.objectFit || (currentStory as any).object_fit || 'cover') as any, 
                                  transform: `scale(${currentStory.mediaScale || (currentStory as any).media_scale || 1})`,
                                  filter: currentStory.filter || 'none'
                              }}
                              controls={false}
                              disablePictureInPicture
                              controlsList="nodownload nofullscreen noremoteplayback"
                              // No Loop - handle end manually for next story
                              onTimeUpdate={onVideoTimeUpdate}
                              onLoadedMetadata={onVideoLoadedMetadata}
                              onEnded={onVideoEnded}
                              onWaiting={onVideoWaiting}
                              onPlaying={onVideoPlay}
                           />
                           {/* Render Overlays */}
                           {currentStory.overlays && currentStory.overlays.map((overlay: any) => (
                               <div
                                  key={overlay.id}
                                  className="absolute pointer-events-none flex items-center justify-center select-none"
                                  style={{
                                    left: overlay.x,
                                    top: overlay.y,
                                    transform: `translate(-50%, -50%) scale(${overlay.scale})`,
                                    zIndex: 20
                                  }}
                                >
                                  {overlay.type === 'text' ? (
                                    <span 
                                      className="text-2xl font-bold whitespace-nowrap drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                                      style={{ color: overlay.color || '#fff' }}
                                    >
                                      {overlay.content}
                                    </span>
                                  ) : (
                                    <span className="text-4xl drop-shadow-md">{overlay.content}</span>
                                  )}
                                </div>
                           ))}
                        </div>
                     ) : (
                        <div className="relative w-full h-full flex items-center justify-center z-10 overflow-hidden">
                            <img 
                                src={getMediaUrl(currentStory.media?.url)} 
                                alt="story" 
                                className="w-full h-full transition-all duration-300"
                                style={{
                                    objectFit: (currentStory.objectFit || (currentStory as any).object_fit || 'cover') as any,
                                    transform: `scale(${currentStory.mediaScale || (currentStory as any).media_scale || 1})`,
                                    filter: currentStory.filter || 'none'
                                }}
                            />
                            {/* Render Overlays */}
                            {currentStory.overlays && currentStory.overlays.map((overlay: any) => (
                               <div
                                  key={overlay.id}
                                  className="absolute pointer-events-none flex items-center justify-center select-none"
                                  style={{
                                    left: overlay.x,
                                    top: overlay.y,
                                    transform: `translate(-50%, -50%) scale(${overlay.scale})`,
                                    zIndex: 20
                                  }}
                                >
                                  {overlay.type === 'text' ? (
                                    <span 
                                      className="text-2xl font-bold whitespace-nowrap drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                                      style={{ color: overlay.color || '#fff' }}
                                    >
                                      {overlay.content}
                                    </span>
                                  ) : (
                                    <span className="text-4xl drop-shadow-md">{overlay.content}</span>
                                  )}
                                </div>
                           ))}
                        </div>
                     )
                 )}
                 <div className="absolute inset-0 z-10 flex">
                     <div className="w-1/3 h-full" onClick={handlePrev}></div>
                     <div className="w-2/3 h-full" onClick={handleNext}></div>
                 </div>
             </div>
             
             {currentGroup.isUser && (
                <div className="absolute bottom-4 left-0 right-0 z-[100] flex justify-center pb-safe">
                    <button onClick={handleShowViewers} className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full text-white hover:bg-black/60 transition-colors">
                        <Eye size={16} />
                        <span className="text-sm font-bold">{currentStory.views?.length || 0}</span>
                    </button>
                </div>
             )}
          </div>,
          document.body
      )}

      {isDeleteModalOpen && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm relative z-10 animate-in zoom-in-95">
             <h3 className="text-lg font-bold text-center mb-2">{t('delete')}؟</h3>
             <p className="text-gray-500 text-center text-sm mb-6">{t('confirm')}</p>
             <div className="flex gap-3">
                <button onClick={handleConfirmDelete} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">{isDeleting ? t('loading') : t('delete')}</button>
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold">{t('cancel')}</button>
             </div>
          </div>
        </div>,
        document.body
      )}
      
      {isViewersModalOpen && createPortal(
        <div className="fixed inset-0 z-[300] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsViewersModalOpen(false); setIsPaused(false); }} />
            <div className="bg-white w-full max-w-md h-[60vh] rounded-t-2xl relative z-10 animate-slide-up-fast flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800">{t('story_viewers')}</h3>
                    <button onClick={() => { setIsViewersModalOpen(false); setIsPaused(false); }} className="p-1 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                    {isLoadingViewers ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" /></div>
                    ) : viewersList.length > 0 ? (
                        viewersList.map((viewer: any, idx) => {
                            // Ensure name fallback handles all edge cases and localization
                            const viewerName = viewer.user?.name || viewer.user?.username || (language === 'ar' ? 'مستخدم' : 'User');
                            return (
                                <div key={idx} className="flex items-center gap-3 mb-4">
                                    <Avatar name={viewerName} src={viewer.user?.avatar ? (viewer.user.avatar.startsWith('http') ? viewer.user.avatar : getMediaUrl(viewer.user.avatar)) : null} className="w-10 h-10 border border-gray-100" />
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-900">{viewerName}</h4>
                                        <span className="text-xs text-gray-500">{getTimeAgo(viewer.viewedAt)}</span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center text-gray-400 py-10 flex flex-col items-center">
                            <Eye size={40} className="mb-2 opacity-30" />
                            <p className="text-sm font-medium">{t('story_no_viewers')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Stories;
