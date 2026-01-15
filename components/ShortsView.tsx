
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Heart, MessageCircle, Share2, Music, UserPlus, 
  Download, Link, Send, X,
  Play, Loader2, Flag, ArrowRight, ChevronDown, Trash2, Copy, MoreHorizontal, Sparkles, Edit2, Globe, Lock, Repeat, Check, ToggleLeft, ToggleRight, Save, CornerDownLeft, MapPin
} from 'lucide-react';
import { API_BASE_URL } from '../constants';
import Avatar from './Avatar';
import { useLanguage } from '../contexts/LanguageContext';

interface TextOverlay {
  id: number;
  content: string;
  x: number;
  y: number;
  scale: number;
  color: string;
}

interface StickerOverlay {
  id: number;
  content: string;
  x: number;
  y: number;
  scale: number;
}

interface ShortVideo {
  id: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
  };
  videoUrl: string | null;
  likes: number;
  comments: number;
  description: string;
  music: string;
  isLiked: boolean;
  isFollowed: boolean;
  category?: string;
  privacy: 'public' | 'private' | 'friends';
  allowComments: boolean;
  allowDownloads: boolean;
  allowRepost: boolean;
  thumbnail: string | null;
  views: number;
  textOverlays?: TextOverlay[];
  stickerOverlays?: StickerOverlay[];
  videoFilter?: string;
  audioSettings?: { isMuted: boolean; volume: number };
  repostsCount?: number;
  isReposted?: boolean;
  
  // New Fields
  location?: string;
  hashtags?: string[];
  mentions?: { username: string }[];
  websiteLink?: string;
  videoPromotion?: { isPromoted: boolean };
}

interface Comment {
  _id: string;
  text: string;
  user: {
    _id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  likes: number;
  isLiked?: boolean;
  repliesCount?: number;
  replies?: Comment[];
  pending?: boolean;
}

interface ShortsViewProps {
  initialShortId: string | null;
  onViewedInitialShort: () => void;
  isActive: boolean;
  onReport: (type: 'post' | 'comment' | 'reply' | 'video', id: string, name: string) => void;
  initialCategory?: 'forYou' | 'haraj' | 'jobs' | 'friends'; 
  onProfileClick?: (userId: string) => void;
  preloadedShorts?: ShortVideo[];
  fromProfile?: boolean;
  onDelete?: (shortId: string) => void;
}

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};

const ShortsView: React.FC<ShortsViewProps> = ({ 
  initialShortId, 
  onViewedInitialShort, 
  isActive, 
  onReport, 
  onProfileClick,
  preloadedShorts,
  fromProfile = false,
  onDelete
}) => {
  const { t, language } = useLanguage();

  // --- CACHING STATE ---
  const [shortsCache, setShortsCache] = useState<Record<string, ShortVideo[]>>({});
  
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [activeShortIdForShare, setActiveShortIdForShare] = useState<string | null>(null);
  
  // Edit Video State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editPrivacy, setEditPrivacy] = useState<'private' | 'public'>('public');
  const [editAllowComments, setEditAllowComments] = useState(true);
  const [editAllowDownloads, setEditAllowDownloads] = useState(true);
  const [editAllowRepost, setEditAllowRepost] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [expandedShortId, setExpandedShortId] = useState<string | null>(null);
  
  const [shorts, setShorts] = useState<ShortVideo[]>(preloadedShorts || []);
  const [loading, setLoading] = useState(!preloadedShorts || preloadedShorts.length === 0);
  
  const [showPlayIcon, setShowPlayIcon] = useState<number | null>(null);
  const [bufferingIndex, setBufferingIndex] = useState<number | null>(null);
  
  const [readyVideos, setReadyVideos] = useState<Set<string>>(new Set());

  const [currentVideoIndex, setCurrentVideoIndex] = useState<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState("00:00");
  const [durationDisplay, setDurationDisplay] = useState("00:00");
  const [isScrubbing, setIsScrubbing] = useState(false);
  
  const isScrubbingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const scrubberContainerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  
  const [isScrolling, setIsScrolling] = useState(false);
  const [isDraggingFeed, setIsDraggingFeed] = useState(false);
  const scrollTimeoutRef = useRef<any>(null);
  const touchStartYRef = useRef<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef(new Map<number, HTMLVideoElement | null>());

  const [activeShortIdForComments, setActiveShortIdForComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  
  // REPLY UI STATE
  const [replyingToUser, setReplyingToUser] = useState<{id: string, name: string} | null>(null);

  const [activeCommentAction, setActiveCommentAction] = useState<Comment | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentUserId = localStorage.getItem('userId');
  const isAr = language === 'ar';

  // --- GLOBAL EVENT LISTENER FOR FOLLOW SYNC ---
  useEffect(() => {
    const handleGlobalFollowChange = (event: CustomEvent) => {
        if (event.detail && event.detail.userId) {
            setShorts(prevShorts => prevShorts.map(short => {
                if (short.user.id === event.detail.userId) {
                    return { ...short, isFollowed: event.detail.isFollowed };
                }
                return short;
            }));
            
            setShortsCache(prev => {
                const newCache = { ...prev };
                Object.keys(newCache).forEach(key => {
                    newCache[key] = newCache[key].map(s => 
                        s.user.id === event.detail.userId ? { ...s, isFollowed: event.detail.isFollowed } : s
                    );
                });
                return newCache;
            });
        }
    };

    window.addEventListener('user-follow-change', handleGlobalFollowChange as EventListener);

    return () => {
        window.removeEventListener('user-follow-change', handleGlobalFollowChange as EventListener);
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (preloadedShorts && preloadedShorts.length > 0) {
        setLoading(false);
        
        if (initialShortId) {
            const index = preloadedShorts.findIndex(s => s.id === initialShortId);
            if (index !== -1 && containerRef.current) {
                setTimeout(() => {
                    if (containerRef.current) {
                        const height = containerRef.current.clientHeight;
                        containerRef.current.scrollTop = index * height;
                    }
                }, 50);
            }
        }
        return;
    }

    const token = localStorage.getItem('token');
    
    if (!token) {
        setLoading(false);
        return;
    }

    const justPosted = localStorage.getItem('just_posted_short');
    if (justPosted) {
        setShortsCache({});
        localStorage.removeItem('just_posted_short');
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('shorts_cache_timestamp_')) {
                localStorage.removeItem(key);
            }
        });
    }

    setLoading(true);

    try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const promises = [];

        promises.push(fetch(`${API_BASE_URL}/api/v1/posts/shorts/for-you`, { headers }).then(res => res.json()));

        if (initialShortId && !fromProfile) {
            promises.push(fetch(`${API_BASE_URL}/api/v1/posts/${initialShortId}`, { headers }).then(res => res.json()));
        }

        const results = await Promise.all(promises);
        const feedData = results[0];
        const targetData = initialShortId && results[1] ? results[1] : null;

        let postsArray = feedData.posts || (Array.isArray(feedData) ? feedData : []);
        
        if (targetData) {
            const targetPost = targetData.post || targetData;
            if (targetPost && (targetPost._id || targetPost.id)) {
                postsArray = postsArray.filter((p: any) => (p._id || p.id) !== (targetPost._id || targetPost.id));
                postsArray.unshift(targetPost);
            }
        }

        if (!Array.isArray(postsArray)) {
            if (shorts.length === 0) setShorts([]);
            return;
        }

        let mappedShorts: ShortVideo[] = postsArray
            .filter((item: any) => item.isShort === true || (initialShortId && (item._id === initialShortId || item.id === initialShortId)))
            .map((item: any): ShortVideo => {
                const videoMedia = item.media?.find((m:any) => m.type === 'video') || item.media?.[0];
                let videoUrl = videoMedia?.url || null;
                if (videoUrl && !videoUrl.startsWith('http')) {
                    videoUrl = `${API_BASE_URL}${videoUrl}`;
                }

                const reactions = item.reactions || [];
                const likesCount = reactions.filter((r: any) => !r.type || r.type === 'like').length;
                const isLiked = reactions.some((r: any) => {
                    const rUserId = r.user?._id || r.user;
                    return rUserId && currentUserId && String(rUserId) === String(currentUserId);
                });

                const userId = item.user?._id || '';
                const cachedFollowStatus = localStorage.getItem(`follow_status_${userId}`);
                const isFollowed = cachedFollowStatus ? JSON.parse(cachedFollowStatus) : false;

                const coverUrl = item.coverImage?.url 
                    ? (item.coverImage.url.startsWith('http') ? item.coverImage.url : `${API_BASE_URL}${item.coverImage.url}`)
                    : (videoMedia?.thumbnail ? (videoMedia.thumbnail.startsWith('http') ? videoMedia.thumbnail : `${API_BASE_URL}${videoMedia.thumbnail}`) : null);

                // Map repost data
                const isReposted = item.isReposted || false;
                const repostsCount = item.repostsCount || 0;

                const displayTitle = item.title || '';
                const displayText = item.content || '';
                const combinedDesc = displayTitle ? (displayText ? `${displayTitle}\n${displayText}` : displayTitle) : displayText;

                return {
                    id: item._id || item.id,
                    user: {
                        id: userId,
                        name: item.user?.name || 'مستخدم',
                        username: item.user?.username || `@${item.user?.name?.replace(/\s/g, '') || 'user'}`,
                        avatar: item.user?.avatar ? (item.user.avatar.startsWith('http') ? item.user.avatar : `${API_BASE_URL}${item.user.avatar}`) : null
                    },
                    videoUrl: videoUrl,
                    likes: likesCount,
                    comments: item.comments?.length || 0,
                    description: combinedDesc,
                    music: 'Original Sound',
                    isLiked: isLiked,
                    isFollowed: isFollowed,
                    category: item.category,
                    privacy: item.privacy || 'public',
                    allowComments: item.allowComments !== false,
                    allowDownloads: item.allowDownloads !== false,
                    allowRepost: item.allowRepost !== false,
                    thumbnail: coverUrl,
                    views: item.viewCount || item.views || 0,
                    textOverlays: item.textOverlays || [],
                    stickerOverlays: item.stickerOverlays || [],
                    videoFilter: item.videoFilter || 'none',
                    audioSettings: item.audioSettings || { isMuted: false, volume: 100 },
                    repostsCount: repostsCount,
                    isReposted: isReposted,
                    // New Fields Mapping
                    location: item.location,
                    hashtags: item.hashtags,
                    mentions: item.mentions,
                    websiteLink: item.websiteLink,
                    videoPromotion: item.videoPromotion || (item.promotion ? { isPromoted: true } : undefined)
                };
            })
            .filter((s): s is ShortVideo => {
                if (!s.videoUrl) return false;
                if (s.privacy === 'private' && s.user.id !== currentUserId) {
                    return false;
                }
                return true;
            });
        
        if (!fromProfile) {
             mappedShorts = mappedShorts.filter((s) => s.user.id !== currentUserId || (initialShortId && s.id === initialShortId));
        }

        if (mappedShorts.length > 0) {
            setShorts(mappedShorts);
        } else {
            setShorts([]);
        }
        
        if (containerRef.current) containerRef.current.scrollTop = 0;

    } catch (err) {
        console.error("Fetch failed", err);
    } finally {
        setLoading(false);
    }
  }, [currentUserId, initialShortId, preloadedShorts, fromProfile]);

  useEffect(() => {
      fetchData();
  }, [fetchData]);

  const handleVideoLoad = (id: string) => {
      setReadyVideos(prev => {
          const newSet = new Set(prev);
          newSet.add(id);
          return newSet;
      });
  };

  const handleScroll = () => {
      if (!containerRef.current) return;
      const { scrollTop, clientHeight } = containerRef.current;
      const index = Math.round(scrollTop / clientHeight);
      
      if (currentVideoIndex !== index) {
          if (currentVideoIndex !== null) {
              const prevVideo = videoRefs.current.get(currentVideoIndex);
              if (prevVideo) {
                  prevVideo.pause();
                  prevVideo.currentTime = 0;
              }
          }
          
          setCurrentVideoIndex(index);
          setShowPlayIcon(null);
          
          const nextVideo = videoRefs.current.get(index);
          if (nextVideo) {
              nextVideo.play().catch(() => {});
          }
      }
  };

  const handleFeedTouchStart = (e: React.TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY;
      setIsDraggingFeed(true);
  };

  const handleFeedTouchMove = (e: React.TouchEvent) => {
      if (!isDraggingFeed) return;
  };

  const handleFeedTouchEnd = () => {
      setIsDraggingFeed(false);
  };

  const handleVideoPress = (e: React.MouseEvent | React.TouchEvent, index: number) => {
      e.stopPropagation();
      const video = videoRefs.current.get(index);
      if (video) {
          if (video.paused) {
              video.play().catch(() => {});
              setShowPlayIcon(null);
          } else {
              video.pause();
              setShowPlayIcon(index);
          }
      }
  };

  const handleShareClick = (e: React.MouseEvent, shortId: string) => {
      e.stopPropagation();
      setActiveShortIdForShare(shortId);
      setIsShareOpen(true);
  };

  const handleReportClick = (e: React.MouseEvent, short: ShortVideo) => {
      e.stopPropagation();
      if (onReport) {
          onReport('video', short.id, short.user.name);
      }
  };

  const renderEmptyState = () => (
      <div className="flex flex-col items-center justify-center h-full text-white pb-20">
          <Play size={48} className="text-gray-600 mb-4" />
          <p className="text-gray-400 font-bold">{t('shorts_empty')}</p>
      </div>
  );

  const handlePointerDown = (e: React.PointerEvent) => {
      isScrubbingRef.current = true;
      setIsScrubbing(true);
      
      if (currentVideoIndex !== null) {
          const video = videoRefs.current.get(currentVideoIndex);
          if (video && !video.paused) {
              wasPlayingRef.current = true;
              video.pause();
          } else {
              wasPlayingRef.current = false;
          }
      }
      handlePointerMove(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isScrubbingRef.current || !progressBarRef.current || !scrubberContainerRef.current || currentVideoIndex === null) return;
      
      const rect = scrubberContainerRef.current.getBoundingClientRect();
      let percent = (e.clientX - rect.left) / rect.width;
      percent = Math.max(0, Math.min(1, percent));
      
      progressBarRef.current.style.width = `${percent * 100}%`;
      
      const video = videoRefs.current.get(currentVideoIndex);
      if (video && video.duration) {
          video.currentTime = percent * video.duration;
          setCurrentTimeDisplay(formatTime(video.currentTime));
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (!isScrubbingRef.current) return;
      isScrubbingRef.current = false;
      setIsScrubbing(false);
      
      if (currentVideoIndex !== null && wasPlayingRef.current) {
          const video = videoRefs.current.get(currentVideoIndex);
          if (video) video.play().catch(() => {});
      }
  };

  const handleDownload = async () => { 
    if (!activeShortIdForShare) return;
    const short = shorts.find(s => s.id === activeShortIdForShare);
    if (!short || !short.videoUrl) return;
    alert(t('loading') || "جاري التنزيل...");
    try {
        const response = await fetch(short.videoUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `video_${short.id}.mp4`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setIsShareOpen(false);
    } catch (error) {
        console.error("Download failed", error);
        alert("فشل التنزيل، يرجى المحاولة لاحقاً");
    }
  };

  const handleDeleteVideo = async () => { 
      if (!activeShortIdForShare) return;
      const token = localStorage.getItem('token');
      setIsShareOpen(false);
      try {
          const response = await fetch(`${API_BASE_URL}/api/v1/posts/${activeShortIdForShare}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
          if (response.ok) {
              setShorts(prev => prev.filter(s => s.id !== activeShortIdForShare));
              if (onDelete) onDelete(activeShortIdForShare);
              alert(t('delete_success'));
          } else { alert(t('delete_fail')); }
      } catch (error) { alert("Error deleting video"); }
  };

  const handleEditClick = () => { 
      setIsShareOpen(false); 
      if (activeShortIdForShare) { 
          const short = shorts.find(s => s.id === activeShortIdForShare); 
          if (short) { 
              setEditPrivacy((short.privacy === 'private' ? 'private' : 'public')); 
              setEditAllowComments(short.allowComments); 
              setEditAllowDownloads(short.allowDownloads); 
              setEditAllowRepost(short.allowRepost); 
          } 
      } 
      setIsEditModalOpen(true); 
  };

  const handleSaveSettings = async () => { 
      if (!activeShortIdForShare) return;
      setIsSavingSettings(true);
      const token = localStorage.getItem('token');
      try {
          const payload = { privacy: editPrivacy, allowComments: editAllowComments, allowDownloads: editAllowDownloads, allowRepost: editAllowRepost };
          const response = await fetch(`${API_BASE_URL}/api/v1/posts/${activeShortIdForShare}/short-settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
          if (response.ok) {
              setShorts(prev => prev.map(s => { if (s.id === activeShortIdForShare) { return { ...s, ...payload }; } return s; }));
              setIsEditModalOpen(false);
              alert(t('save') + " " + t('done'));
          } else { alert(t('error_occurred')); }
      } catch (e) { console.error(e); alert(t('error_occurred')); } finally { setIsSavingSettings(false); }
  };

  const handleNativeShare = async () => { 
    if (!activeShortIdForShare) return;
    const short = shorts.find(s => s.id === activeShortIdForShare);
    if (!short) return;
    try { 
        await navigator.share({ 
            title: `فيديو بواسطة ${short.user.name}`, 
            text: short.description, 
            url: `${API_BASE_URL}/share/short/${short.id}`
        }); 
        setIsShareOpen(false); 
    } catch (err) {}
  };

  const handleRepost = async () => { 
      if (!activeShortIdForShare) return;
      const token = localStorage.getItem('token');
      setIsShareOpen(false);
      const updateRepostState = (list: ShortVideo[], isReposted: boolean, increment: number) => { return list.map(s => { if (s.id === activeShortIdForShare) { return { ...s, isReposted: isReposted, repostsCount: Math.max(0, (s.repostsCount || 0) + increment) }; } return s; }); };
      setShorts(prev => updateRepostState(prev, true, 1));
      setShortsCache(prev => { const newCache = { ...prev }; Object.keys(newCache).forEach(key => { newCache[key] = updateRepostState(newCache[key], true, 1); }); return newCache; });
      try { const response = await fetch(`${API_BASE_URL}/api/v1/posts/${activeShortIdForShare}/repost`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ content: '' }) }); if (response.ok) { alert(t('repost_success')); } else { setShorts(prev => updateRepostState(prev, false, -1)); setShortsCache(prev => { const newCache = { ...prev }; Object.keys(newCache).forEach(key => { newCache[key] = updateRepostState(newCache[key], false, -1); }); return newCache; }); alert(t('repost_fail')); } } catch (error) { setShorts(prev => updateRepostState(prev, false, -1)); setShortsCache(prev => { const newCache = { ...prev }; Object.keys(newCache).forEach(key => { newCache[key] = updateRepostState(newCache[key], false, -1); }); return newCache; }); console.error("Repost error", error); alert(t('repost_error')); }
  };

  const handleUndoRepost = async () => {
      if (!activeShortIdForShare) return;
      const token = localStorage.getItem('token');
      setIsShareOpen(false);
      
      const updateRepostState = (list: ShortVideo[], isReposted: boolean, increment: number) => { 
          return list.map(s => { 
              if (s.id === activeShortIdForShare) { 
                  return { ...s, isReposted: isReposted, repostsCount: Math.max(0, (s.repostsCount || 0) + increment) }; 
              } 
              return s; 
          }); 
      };

      setShorts(prev => updateRepostState(prev, false, -1));
      setShortsCache(prev => { 
          const newCache = { ...prev }; 
          Object.keys(newCache).forEach(key => { newCache[key] = updateRepostState(newCache[key], false, -1); }); 
          return newCache; 
      });

      try {
          const response = await fetch(`${API_BASE_URL}/api/v1/posts/${activeShortIdForShare}/repost`, { 
              method: 'DELETE', 
              headers: { 'Authorization': `Bearer ${token}` } 
          });
          
          if (!response.ok) {
              setShorts(prev => updateRepostState(prev, true, 1));
              setShortsCache(prev => { 
                  const newCache = { ...prev }; 
                  Object.keys(newCache).forEach(key => { newCache[key] = updateRepostState(newCache[key], true, 1); }); 
                  return newCache; 
              });
              alert(t('error_occurred'));
          }
      } catch (error) {
          setShorts(prev => updateRepostState(prev, true, 1));
          setShortsCache(prev => { 
              const newCache = { ...prev }; 
              Object.keys(newCache).forEach(key => { newCache[key] = updateRepostState(newCache[key], true, 1); }); 
              return newCache; 
          });
          console.error("Undo repost error", error);
          alert(t('error_occurred'));
      }
  };

  const handleCopyLink = () => { 
      if (activeShortIdForShare) { 
          navigator.clipboard.writeText(`${API_BASE_URL}/share/short/${activeShortIdForShare}`); 
          setIsShareOpen(false); 
          alert(t('copy_link') + ' Done!'); 
      } 
  };

  const handleFollow = async (e: React.MouseEvent, userId: string) => {
      e.stopPropagation();
      const token = localStorage.getItem('token');
      if (!token || !userId || userId === currentUserId) return;

      setShorts(prev => prev.map(s => {
          if (s.user.id === userId) {
              return { ...s, isFollowed: true };
          }
          return s;
      }));
      setShortsCache(prev => {
          const newCache = { ...prev };
          Object.keys(newCache).forEach(key => {
              newCache[key] = newCache[key].map(s => 
                  s.user.id === userId ? { ...s, isFollowed: true } : s
              );
          });
          return newCache;
      });
      localStorage.setItem(`follow_status_${userId}`, 'true');
      window.dispatchEvent(new CustomEvent('user-follow-change', { detail: { userId: userId, isFollowed: true } }));
      try {
          const response = await fetch(`${API_BASE_URL}/api/v1/follow/${userId}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
          if (!response.ok) {
              const revertLogic = (list: ShortVideo[]) => list.map(s => s.user.id === userId ? { ...s, isFollowed: false } : s);
              setShorts(prev => revertLogic(prev));
              setShortsCache(prev => {
                  const newCache = { ...prev };
                  Object.keys(newCache).forEach(key => { newCache[key] = revertLogic(newCache[key]); });
                  return newCache;
              });
              localStorage.setItem(`follow_status_${userId}`, 'false');
              window.dispatchEvent(new CustomEvent('user-follow-change', { detail: { userId: userId, isFollowed: false } }));
          }
      } catch (error) { console.error("Follow failed", error); }
  };

  const handleLike = async (e: React.MouseEvent, shortId: string) => {
    e.stopPropagation();
    const updateShortLike = (list: ShortVideo[]) => list.map(short => {
        if (short.id === shortId) {
            const newLiked = !short.isLiked;
            return { ...short, isLiked: newLiked, likes: Math.max(0, short.likes + (newLiked ? 1 : -1)) };
        }
        return short;
    });
    setShorts(prev => updateShortLike(prev));
    setShortsCache(prev => {
        const newCache = { ...prev };
        Object.keys(newCache).forEach(key => { newCache[key] = updateShortLike(newCache[key]); });
        return newCache;
    });
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        await fetch(`${API_BASE_URL}/api/v1/posts/${shortId}/react`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ reactionType: 'like' }) });
    } catch (error) { console.error("Like failed", error); }
  };

  const processApiComment = useCallback((c: any, userId: string): Comment => {
    if (!c || typeof c !== 'object') return {
        _id: Math.random().toString(),
        text: 'Error loading comment',
        user: { _id: 'unknown', name: 'Unknown' },
        createdAt: new Date().toISOString(),
        likes: 0
    };

    const likesSource = Array.isArray(c.likes) ? c.likes : (Array.isArray(c.reactions) ? c.reactions : []);
    let count = likesSource.length;
    if (count === 0 && typeof c.likes === 'number') count = c.likes;

    const isLiked = likesSource.some((item: any) => {
        const itemId = typeof item === 'object' ? (item.user?._id || item.user || item._id) : item;
        return String(itemId) === String(currentUserId);
    }) || (!!c.isLiked) || (!!c.userHasLiked);

    return {
      _id: c._id || c.id,
      text: c.text,
      user: {
        _id: c.user?._id || c.user?.id || 'unknown',
        name: c.user?.name || 'مستخدم',
        avatar: c.user?.avatar
      },
      createdAt: c.createdAt,
      likes: count,
      isLiked: isLiked,
      repliesCount: Array.isArray(c.replies) ? c.replies.length : (c.repliesCount || 0),
      replies: c.replies ? c.replies.map((r: any) => processApiComment(r, userId)) : []
    };
  }, [currentUserId]);

  const fetchComments = useCallback(async (postId: string, forceLoader = false) => {
      if (forceLoader) setIsLoadingComments(true);
      try {
          const token = localStorage.getItem('token');
          const userId = localStorage.getItem('userId') || '';

          const response = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
              const data = await response.json();
              const rawComments = data.post?.comments || [];
              
              const processed = rawComments.map((c: any) => processApiComment(c, userId));
              processed.sort((a: Comment, b: Comment) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              setComments(processed);
          }
      } catch (error) {
          console.error("Failed comments", error);
      } finally {
          setIsLoadingComments(false);
      }
  }, [processApiComment]);

  const handleOpenComments = (e: React.MouseEvent, shortId: string) => {
      e.stopPropagation();
      setActiveShortIdForComments(shortId);
      setIsCommentsOpen(true);
      setReplyingTo(null);
      setReplyingToUser(null);
      setCommentText('');
      if (activeShortIdForComments !== shortId) {
          setComments([]); 
          fetchComments(shortId, true);
      } else {
          fetchComments(shortId, false);
      }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedComments(prev => {
        const next = new Set(prev);
        if (next.has(commentId)) {
            next.delete(commentId);
        } else {
            next.add(commentId);
        }
        return next;
    });
  };

  const handleSendComment = async () => {
      if (!commentText.trim() || !activeShortIdForComments) return;
      
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId') || 'me';
      const userAvatar = localStorage.getItem('userAvatar');
      const tempId = `temp-${Date.now()}`;
      
      // Determine if replying based on replyingTo (Comment obj) or replyingToUser ({id, name})
      // If replyingTo is set, it's a nested reply context.
      const parentId = replyingTo ? replyingTo._id : null;
      const isReply = !!parentId;

      // Ensure text sent to server contains mention if applicable
      const textToSend = replyingToUser 
        ? `@${replyingToUser.name} ${commentText}`
        : commentText;

      const optimisticComment: Comment = {
          _id: tempId,
          text: textToSend, // Display text exactly as user typed (plus mention for context if needed, usually backend returns formatted)
          user: {
              _id: userId,
              name: localStorage.getItem('userName') || 'أنا',
              avatar: userAvatar ? (userAvatar.startsWith('http') ? userAvatar : `${API_BASE_URL}${userAvatar}`) : undefined
          },
          createdAt: new Date().toISOString(),
          likes: 0,
          isLiked: false,
          pending: false // OPTIMISTIC: Set to false so it looks sent immediately
      };

      setCommentText('');
      setReplyingTo(null);
      setReplyingToUser(null);

      const updateCommentCount = (increment: number) => {
          const updateFn = (list: ShortVideo[]) => list.map(s => 
              s.id === activeShortIdForComments ? { ...s, comments: Math.max(0, s.comments + increment) } : s
          );
          setShorts(prev => updateFn(prev));
          setShortsCache(prev => {
              const newCache = { ...prev };
              Object.keys(newCache).forEach(key => { newCache[key] = updateFn(newCache[key]); });
              return newCache;
          });
      };

      if (isReply && parentId) {
         setExpandedComments(prev => new Set(prev).add(parentId));
         setComments(prev => prev.map(c => {
             if (c._id === parentId) {
                 return {
                     ...c,
                     replies: [...(c.replies || []), optimisticComment],
                     repliesCount: (c.repliesCount || 0) + 1
                 };
             }
             return c;
         }));
      } else {
         setComments(prev => [optimisticComment, ...prev]);
         updateCommentCount(1);
      }

      try {
          const endpoint = isReply 
            ? `${API_BASE_URL}/api/v1/posts/${activeShortIdForComments}/comments/${parentId}/replies`
            : `${API_BASE_URL}/api/v1/posts/${activeShortIdForComments}/comments`;

          const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ text: textToSend })
          });
          
          if (response.ok) {
             const data = await response.json();
             const realCommentData = data.comment || data.reply;
             
             if (realCommentData) {
                 // Replace temp ID with real ID
                 if (isReply && parentId) {
                     setComments(prev => prev.map(c => {
                         if (c._id === parentId) {
                             return {
                                 ...c,
                                 replies: c.replies?.map(r => r._id === tempId ? { ...r, _id: realCommentData._id || realCommentData.id } : r)
                             };
                         }
                         return c;
                     }));
                 } else {
                     setComments(prev => prev.map(c => c._id === tempId ? { ...c, _id: realCommentData._id || realCommentData.id } : c));
                 }
             }
          } else {
              handleCommentFailure(tempId, isReply, parentId);
          }
      } catch (e) {
          handleCommentFailure(tempId, isReply, parentId);
      }
  };

  const handleCommentFailure = (tempId: string, isReply: boolean, parentId: string | null) => {
      if (isReply && parentId) {
           setComments(prev => prev.map(c => c._id === parentId ? {
               ...c,
               replies: c.replies?.filter(r => r._id !== tempId),
               repliesCount: Math.max(0, (c.repliesCount || 1) - 1)
           } : c));
      } else {
           setComments(prev => prev.filter(c => c._id !== tempId));
           const revertFn = (list: ShortVideo[]) => list.map(s => s.id === activeShortIdForComments ? { ...s, comments: Math.max(0, s.comments - 1) } : s);
           setShorts(prev => revertFn(prev));
           setShortsCache(prev => {
                const newCache = { ...prev };
                Object.keys(newCache).forEach(key => { newCache[key] = revertFn(newCache[key]); });
                return newCache;
           });
      }
  };

  const handleCommentLike = async (commentId: string, parentId?: string) => {
    let targetParentId = parentId;
    if (!targetParentId) {
        const parent = comments.find(c => c.replies?.some(r => r._id === commentId));
        if (parent) targetParentId = parent._id;
    }

    const toggleLikeInComment = (c: Comment) => {
        const newIsLiked = !c.isLiked;
        return {
            ...c,
            isLiked: newIsLiked,
            likes: Math.max(0, c.likes + (newIsLiked ? 1 : -1))
        };
    };

    setComments(prevComments => prevComments.map(c => {
        if (c._id === commentId && !targetParentId) {
            return toggleLikeInComment(c);
        }
        if (targetParentId && c._id === targetParentId) {
             const updatedReplies = c.replies?.map(r => r._id === commentId ? toggleLikeInComment(r) : r);
             return { ...c, replies: updatedReplies };
        }
        return c;
    }));

    try {
        const token = localStorage.getItem('token');
        const endpoint = targetParentId 
            ? `${API_BASE_URL}/api/v1/posts/${activeShortIdForComments}/comments/${targetParentId}/replies/${commentId}/like`
            : `${API_BASE_URL}/api/v1/posts/${activeShortIdForComments}/comments/${commentId}/like`;

        await fetch(endpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            keepalive: true
        });
    } catch (error) {
        console.error("Failed to like comment", error);
    }
  };

  const handleTouchStart = (comment: Comment) => {
    longPressTimerRef.current = setTimeout(() => {
        setActiveCommentAction(comment);
    }, 600); 
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
    }
  };

  const handleDeleteComment = () => {
    if (activeCommentAction) {
        setCommentToDelete(activeCommentAction);
        setActiveCommentAction(null);
    }
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete || !activeShortIdForComments) return;

    const commentId = commentToDelete._id;
    let isReply = false;
    let parentId = undefined;

    const parent = comments.find(c => c.replies?.some(r => r._id === commentId));
    if (parent) {
        isReply = true;
        parentId = parent._id;
    }

    const updateCommentCount = (decrement: number) => {
        const updateFn = (list: ShortVideo[]) => list.map(s => 
            s.id === activeShortIdForComments ? { ...s, comments: Math.max(0, s.comments - decrement) } : s
        );
        setShorts(prev => updateFn(prev));
        setShortsCache(prev => {
            const newCache = { ...prev };
            Object.keys(newCache).forEach(key => { newCache[key] = updateFn(newCache[key]); });
            return newCache;
        });
    };

    if (isReply && parentId) {
        setComments(prev => prev.map(c => c._id === parentId ? {
            ...c,
            replies: c.replies?.filter(r => r._id !== commentId),
            repliesCount: Math.max(0, (c.repliesCount || 1) - 1)
        } : c));
    } else {
        setComments(prev => prev.filter(c => c._id !== commentId));
        updateCommentCount(1);
    }

    setCommentToDelete(null);

    try {
        const token = localStorage.getItem('token');
        const endpoint = (isReply && parentId)
          ? `${API_BASE_URL}/api/v1/posts/${activeShortIdForComments}/comments/${parentId}/replies/${commentId}`
          : `${API_BASE_URL}/api/v1/posts/${activeShortIdForComments}/comments/${commentId}`;

        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error("Failed to delete");
        }
    } catch (error) {
        console.error("Failed to delete comment", error);
        fetchComments(activeShortIdForComments);
    }
  };

  const handleReplyClick = (e: React.MouseEvent, user: { id: string, name: string }, commentObj: Comment) => {
      e.stopPropagation();
      setReplyingToUser(user);
      setReplyingTo(commentObj); // Set parent comment reference for API call
      setTimeout(() => inputRef.current?.focus(), 100); 
  };

  const isCommentOwner = activeCommentAction && (
      activeCommentAction.user._id === currentUserId || 
      activeCommentAction.user._id === 'me'
  );

  const handleReportComment = () => {
      if (activeCommentAction && onReport) {
          let isReply = false;
          for (const c of comments) {
              if (c.replies?.some(r => r._id === activeCommentAction._id)) {
                  isReply = true;
                  break;
              }
          }
          onReport(isReply ? 'reply' : 'comment', activeCommentAction._id, activeCommentAction.user.name);
          setActiveCommentAction(null);
      }
  };

  const renderCommentItem = (comment: Comment, isReply = false, parent: Comment | null = null) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedComments.has(comment._id);

    return (
      <div 
        key={comment._id} 
        className={`flex flex-col mb-4 ${isReply ? 'mt-2 mr-8 pl-0 border-r-2 border-gray-100 pr-2' : ''} transition-opacity duration-300 ${comment.pending ? 'opacity-100' : 'opacity-100'}`}
      >
        <div 
            className="flex gap-3 relative group"
            onTouchStart={() => handleTouchStart(comment)}
            onTouchEnd={handleTouchEnd}
            onMouseDown={() => handleTouchStart(comment)}
            onMouseUp={handleTouchEnd}
        >
            <div 
              className="flex-shrink-0 mt-0.5 cursor-pointer" 
              onClick={(e) => { 
                e.stopPropagation(); 
                setIsCommentsOpen(false); 
                onProfileClick?.(comment.user._id); 
              }}
            >
                <Avatar
                name={comment.user.name}
                src={comment.user.avatar ? (comment.user.avatar.startsWith('http') ? comment.user.avatar : `${API_BASE_URL}${comment.user.avatar}`) : null}
                className={isReply ? "w-7 h-7" : "w-9 h-9"}
                textClassName="text-xs"
                />
            </div>
            
            <div className="flex-1 min-w-0">
                <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-tr-none inline-block max-w-full relative">
                    <h4 
                        className="text-xs font-bold text-gray-900 mb-0.5 cursor-pointer" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setIsCommentsOpen(false);
                          onProfileClick?.(comment.user._id); 
                        }}
                    >
                        {comment.user.name}
                    </h4>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed select-text text-start">
                        {comment.text}
                    </p>
                </div>
                
                <div className="flex items-center gap-4 mt-1 px-1">
                    <span className="text-[10px] text-gray-400">
                        {new Date(comment.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    
                    {!comment.pending && (
                        <button 
                            onClick={(e) => {
                                handleReplyClick(e, {id: comment.user._id, name: comment.user.name}, isReply && parent ? parent : comment);
                            }}
                            className="text-[11px] font-bold text-gray-500 hover:text-gray-800"
                        >
                            {t('reply')}
                        </button>
                    )}

                    {!comment.pending && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isReply && parent) {
                                    handleCommentLike(comment._id, parent._id);
                                } else {
                                    handleCommentLike(comment._id);
                                }
                            }}
                            className={`flex items-center gap-1 text-[11px] font-bold ${comment.isLiked ? 'text-red-500' : 'text-gray-500'}`}
                        >
                            {comment.isLiked ? (
                                <Heart size={12} className="fill-red-500 text-red-500" />
                            ) : (
                                <Heart size={12} />
                            )}
                            {comment.likes > 0 && <span>{comment.likes}</span>}
                        </button>
                    )}
                </div>

                {/* --- REPLIES TOGGLE BUTTON (INLINE) --- */}
                {hasReplies && !isReply && (
                    <div className="mt-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); toggleReplies(comment._id); }}
                            className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            <div className="w-6 h-[1px] bg-gray-300"></div>
                            {isExpanded ? (
                                <span>{t('hide_replies')}</span>
                            ) : (
                                <span>{t('view_replies')} ({comment.replies!.length})</span>
                            )}
                            {isExpanded ? <ChevronDown size={14} className="rotate-180" /> : <ChevronDown size={14} />}
                        </button>
                    </div>
                )}
            </div>

            {/* --- THREE DOTS --- */}
            {!comment.pending && (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveCommentAction(comment);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 self-start transition-colors"
                >
                    <MoreHorizontal size={16} />
                </button>
            )}
        </div>

        {/* --- REPLIES LIST --- */}
        {hasReplies && isExpanded && (
            <div className="flex flex-col animate-in slide-in-from-top-2 duration-200">
                {comment.replies!.map((reply) => renderCommentItem(reply, true, comment))}
            </div>
        )}
      </div>
    );
  };

  const handleCopyComment = () => {
      if (activeCommentAction) {
          navigator.clipboard.writeText(activeCommentAction.text);
          setActiveCommentAction(null);
      }
  };

  // Derived variables for share modal
  const activeShortForShare = activeShortIdForShare ? shorts.find(s => s.id === activeShortIdForShare) : null;
  const isVideoOwner = activeShortForShare ? (activeShortForShare.user.id === currentUserId || activeShortForShare.user.id === 'me') : false;

  // Effects for playback sync
  useEffect(() => {
      if (loading || shorts.length === 0) return;
      
      // Auto play the first one if not set
      if (currentVideoIndex === null) {
          setCurrentVideoIndex(0);
      } else {
          const video = videoRefs.current.get(currentVideoIndex);
          if (video && isActive && !isShareOpen && !isCommentsOpen && !isEditModalOpen) {
              // Ensure playing
              // FIX: Explicitly check for null, as 0 (index 0) evaluates to falsy in !showPlayIcon
              if (video.paused && showPlayIcon === null) video.play().catch(() => {});
              
              // Progress Loop
              const updateLoop = () => {
                  if (!isScrubbingRef.current && video && !video.paused && progressBarRef.current) {
                      const pct = (video.currentTime / video.duration) * 100;
                      progressBarRef.current.style.width = `${pct}%`;
                      setCurrentTimeDisplay(formatTime(video.currentTime));
                      setDurationDisplay(formatTime(video.duration));
                  }
                  rafRef.current = requestAnimationFrame(updateLoop);
              };
              rafRef.current = requestAnimationFrame(updateLoop);
          } else if (video && (!isActive || isShareOpen || isCommentsOpen || isEditModalOpen)) {
              video.pause();
          }
      }
      return () => {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
  }, [currentVideoIndex, isActive, loading, isShareOpen, isCommentsOpen, isEditModalOpen, showPlayIcon]);

  return (
    <>
    {/* CONTENT AREA: FIXED INSET-0 and 100dvh for Full Screen */}
    <div className="fixed inset-0 z-[50] bg-black h-[100dvh]">
        {loading ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-white z-40">
                <Loader2 className="w-10 h-10 animate-spin text-white mb-4" />
            </div>
        ) : shorts.length > 0 ? (
            <div 
              ref={containerRef} 
              onScroll={handleScroll}
              onTouchStart={handleFeedTouchStart}
              onTouchMove={handleFeedTouchMove}
              onTouchEnd={handleFeedTouchEnd}
              className="h-full w-full flex flex-col overflow-y-scroll snap-y snap-mandatory no-scrollbar relative"
            >
              {shorts.map((short, index) => {
                const isExpanded = expandedShortId === short.id;
                const isOwner = short.user.id === currentUserId || short.user.id === 'me';
                const isReady = readyVideos.has(short.id);

                return (
                  <div 
                    key={`${short.id}-${index}`} 
                    className="h-[100dvh] w-full snap-start flex-shrink-0 relative flex items-center justify-center bg-black"
                    style={{ scrollSnapStop: 'always' }}
                    onClick={(e) => handleVideoPress(e, index)}
                  >
                    {!isReady && (
                        <div className="absolute inset-0 z-20 bg-black flex items-center justify-center">
                            {short.thumbnail ? (
                                <img 
                                    src={short.thumbnail} 
                                    alt="" 
                                    className="w-full h-full object-cover blur-md scale-110 opacity-50" 
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-800 animate-pulse" />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center">
                                 <Loader2 className="w-10 h-10 text-white/50 animate-spin" />
                            </div>
                        </div>
                    )}

                    <div className="absolute inset-0 bg-transparent z-10">
                        <video
                            ref={(el) => { videoRefs.current.set(index, el); }}
                            data-index={index}
                            src={short.videoUrl!}
                            loop
                            playsInline
                            webkit-playsinline="true"
                            poster={short.thumbnail || ""}
                            className={`w-full h-full object-cover transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`}
                            onWaiting={() => setBufferingIndex(index)}
                            onPlaying={() => { setBufferingIndex(null); handleVideoLoad(short.id); }}
                            onPause={() => setBufferingIndex(null)}
                            onLoadedData={() => handleVideoLoad(short.id)}
                            style={{ filter: short.videoFilter && short.videoFilter !== 'none' ? short.videoFilter : undefined }}
                        />
                        {/* Render Text Overlays */}
                        {short.textOverlays?.map((text) => (
                          <div
                            key={`text-${text.id}`}
                            className="absolute pointer-events-none z-20 whitespace-nowrap font-bold select-none"
                            style={{
                              left: text.x,
                              top: text.y,
                              transform: `translate(-50%, -50%) scale(${text.scale})`,
                              color: text.color,
                              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                              fontSize: '2rem' 
                            }}
                          >
                            {text.content}
                          </div>
                        ))}
                        
                        {/* Render Sticker Overlays */}
                        {short.stickerOverlays?.map((sticker) => (
                          <div
                            key={`sticker-${sticker.id}`}
                            className="absolute pointer-events-none z-20 select-none"
                            style={{
                              left: sticker.x,
                              top: sticker.y,
                              transform: `translate(-50%, -50%) scale(${sticker.scale})`,
                              fontSize: '3rem'
                            }}
                          >
                            {sticker.content}
                          </div>
                        ))}
                    </div>
                    
                    {bufferingIndex === index && isReady && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                            <Loader2 className="w-12 h-12 text-white animate-spin drop-shadow-md" strokeWidth={3} />
                        </div>
                    )}
                    
                    {showPlayIcon === index && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                            <div className="bg-black/40 p-4 rounded-full">
                                <Play size={60} className="text-white/80 fill-white/80" />
                            </div>
                        </div>
                    )}
                    
                    {short.videoPromotion?.isPromoted && (
                        <div className="absolute top-20 left-4 z-30 bg-amber-500/80 text-white px-2 py-1 rounded text-xs font-bold backdrop-blur-md">
                            {t('promoted')}
                        </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none z-20"></div>

                    <div 
                        className={`absolute flex flex-col items-center gap-6 z-30 ${isAr ? 'left-4' : 'right-4'} ${fromProfile ? 'bottom-20' : 'bottom-24'}`} 
                        onClick={(e) => e.stopPropagation()}
                    >
                      <div className="relative mb-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); onProfileClick?.(short.user.id); }}>
                          <div className="w-12 h-12 rounded-full border border-white overflow-hidden shadow-lg">
                            <Avatar name={short.user.name} src={short.user.avatar} className="w-full h-full" />
                          </div>
                      </div>

                      <button 
                        onClick={(e) => handleLike(e, short.id)}
                        className="flex flex-col items-center gap-1 group"
                      >
                        <Heart 
                            size={30} 
                            className={`drop-shadow-lg active:scale-90 transition-all duration-300 ${
                                short.isLiked 
                                ? 'text-white fill-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] scale-110' 
                                : 'text-white fill-white/10'
                            }`} 
                        />
                        <span className="text-white text-xs font-bold shadow-black drop-shadow-md">{short.likes}</span>
                      </button>

                      <button 
                        onClick={(e) => {
                            if (!short.allowComments && !isOwner) {
                                alert(t('comments_disabled_creator'));
                                return;
                            }
                            handleOpenComments(e, short.id);
                        }}
                        className={`flex flex-col items-center gap-1 group ${!short.allowComments && !isOwner ? 'opacity-50' : ''}`}
                      >
                        <MessageCircle size={30} className="text-white drop-shadow-lg active:scale-90 transition-transform fill-white/10" />
                        <span className="text-white text-xs font-bold shadow-black drop-shadow-md">{short.comments}</span>
                      </button>
                      
                      <button 
                        onClick={(e) => handleShareClick(e, short.id)}
                        className="flex flex-col items-center gap-1 group">
                        <Share2 size={30} className="text-white drop-shadow-lg active:scale-90 transition-transform fill-white/10" />
                        <span className="text-white text-xs font-bold shadow-black drop-shadow-md">{t('share')}</span>
                      </button>

                      {!isOwner && (
                        <button 
                            onClick={(e) => handleReportClick(e, short)}
                            className="flex flex-col items-center gap-1 group"
                        >
                            <Flag size={28} className="text-white drop-shadow-lg active:scale-90 transition-transform fill-white/10" />
                        </button>
                      )}
                      
                        <div className="mt-4">
                          <div className="w-10 h-10 bg-gray-900 rounded-full border-[3px] border-gray-800 flex items-center justify-center animate-[spin_5s_linear_infinite] shadow-lg shadow-black/50">
                              <div className="w-6 h-6 rounded-full overflow-hidden">
                                <Avatar name={short.user.name} src={short.user.avatar} className="w-full h-full" />
                              </div>
                          </div>
                        </div>

                    </div>

                    <div 
                      className={`absolute left-0 right-0 z-20 transition-all duration-300 ${
                        isExpanded 
                          ? 'h-[50vh] bg-black/90 rounded-t-2xl bottom-0' 
                          : `h-auto ${fromProfile ? 'bottom-0 pb-10' : 'bottom-0 pb-28'}`
                      }`}
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      <div className={`pt-4 flex flex-col ${isExpanded ? 'h-full overflow-y-auto pb-4' : ''} ${isAr ? 'items-start text-right pr-4 pl-20' : 'items-start text-left pl-4 pr-20'}`}>
                          
                          <div className="flex items-center gap-2 mb-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); onProfileClick?.(short.user.id); }}>
                            <h3 className="text-white font-bold text-base shadow-black drop-shadow-md">{short.user.username}</h3>
                            {short.category && (
                                <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-md backdrop-blur-sm">
                                    {t(short.category)}
                                </span>
                            )}
                          </div>

                          <p 
                            className={`text-white text-sm leading-relaxed dir-auto ${isAr ? 'text-right' : 'text-left'} ${isExpanded ? '' : 'line-clamp-2'}`}
                            onClick={() => setExpandedShortId(isExpanded ? null : short.id)}
                          >
                            {short.description}
                          </p>

                          {(short.hashtags?.length > 0 || short.mentions?.length > 0) && (
                              <div className="flex flex-wrap gap-2 mt-1 text-sm font-bold text-blue-400 dir-ltr text-right">
                                  {short.mentions?.map((m, i) => <span key={`m-${i}`}>@{m.username}</span>)}
                                  {short.hashtags?.map((h, i) => <span key={`h-${i}`}>#{h}</span>)}
                              </div>
                          )}

                          <div className="flex flex-col gap-1 mt-2">
                              {short.websiteLink && (
                                  <a href={short.websiteLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-white/90 bg-white/20 p-1.5 rounded-lg w-fit hover:bg-white/30 transition-colors backdrop-blur-sm">
                                      <Link size={12} />
                                      <span className="truncate max-w-[200px]">{short.websiteLink}</span>
                                  </a>
                              )}
                              {short.location && (
                                  <div className="flex items-center gap-1 text-xs text-gray-300">
                                      <MapPin size={12} />
                                      <span>{short.location}</span>
                                  </div>
                              )}
                          </div>

                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedShortId(isExpanded ? null : short.id);
                            }}
                            className="text-gray-300 text-xs font-semibold mt-1 hover:text-white"
                          >
                            {isExpanded ? t('close') : t('post_next')}
                          </button>
                          
                          {!isExpanded && (
                            <div className="flex items-center gap-2 mt-3 w-3/4 overflow-hidden">
                                <Music size={14} className="text-white" />
                                <p className="text-white text-xs whitespace-nowrap animate-pulse">{short.music}</p>
                            </div>
                          )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
        ) : (
            renderEmptyState()
        )}
    </div>

    <div 
        ref={scrubberContainerRef}
        className={`fixed left-0 right-0 z-[60] h-6 flex items-end px-2 transition-opacity duration-200 touch-none dir-ltr ${
            fromProfile ? 'bottom-0 mb-safe' : 'bottom-[49px] mb-safe'
        } ${
            (isScrolling || isDraggingFeed) && !isScrubbing ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        }`}
        style={{ direction: 'ltr' }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
    >
        <div className="relative w-full h-full flex items-end pb-2 group cursor-pointer">
            <div className="absolute inset-x-0 h-10 bottom-0 z-10"></div>
            <div className="absolute left-0 right-0 h-1 bg-white/30 rounded-full transition-all backdrop-blur-sm"></div>
            <div 
                ref={progressBarRef}
                className="absolute left-0 h-1 bg-white rounded-full transition-none shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                style={{ width: '0%' }}
            >
            <div className={`absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 ${isScrubbing ? 'scale-125' : ''} transition-transform z-20`}>
                {isScrubbing && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] font-bold py-1 px-2 rounded-md whitespace-nowrap backdrop-blur-md border border-white/20">
                        {currentTimeDisplay}
                    </div>
                )}
            </div>
            </div>
        </div>
    </div>
    
    {/* Share Modal */}
    {isShareOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center">
          <div 
            className="absolute inset-0 bg-black/60 transition-opacity"
            onClick={() => setIsShareOpen(false)}
          />
          <div className="bg-white w-full max-w-md rounded-t-2xl relative z-10 animate-in slide-in-from-bottom duration-300 pb-safe">
            <div className="flex justify-center pt-3 pb-1" onClick={() => setIsShareOpen(false)}>
              <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
            </div>
            
            <div className="p-5">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-gray-800 font-bold text-center flex-1">{t('share')}</h3>
                <button onClick={() => setIsShareOpen(false)} className="bg-gray-100 p-1 rounded-full hover:bg-gray-200">
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-4">
                 
                 <button 
                    onClick={handleNativeShare}
                    className="flex flex-col items-center gap-2 group"
                 >
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <Share2 size={22} className="text-blue-600" />
                    </div>
                    <span className="text-[10px] text-gray-600 font-bold">{t('share')}</span>
                 </button>

                 <button 
                    onClick={handleCopyLink}
                    className="flex flex-col items-center gap-2 group"
                 >
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                      <Copy size={22} className="text-gray-700" />
                    </div>
                    <span className="text-[10px] text-gray-600 font-bold">{t('copy')}</span>
                 </button>

                 <button 
                    onClick={() => {
                        if (activeShortForShare && !activeShortForShare.allowDownloads && !isVideoOwner) {
                            alert(t('downloads_disabled_creator'));
                            return;
                        }
                        handleDownload();
                    }}
                    className={`flex flex-col items-center gap-2 group ${activeShortForShare && !activeShortForShare.allowDownloads && !isVideoOwner ? 'opacity-50' : ''}`}
                 >
                    <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center group-hover:bg-green-100 transition-colors">
                      <Download size={22} className="text-green-600" />
                    </div>
                    <span className="text-[10px] text-gray-600 font-bold">{t('download')}</span>
                 </button>

                 <button 
                    onClick={() => {
                        if (activeShortForShare?.isReposted) {
                            handleUndoRepost();
                        } else {
                            if (activeShortForShare && !activeShortForShare.allowRepost && !isVideoOwner) {
                                alert(t('repost_disabled_creator'));
                                return;
                            }
                            handleRepost();
                        }
                    }}
                    className={`flex flex-col items-center gap-2 group ${activeShortForShare && !activeShortForShare.isReposted && !activeShortForShare.allowRepost && !isVideoOwner ? 'opacity-50' : ''}`}
                 >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${activeShortForShare?.isReposted ? 'bg-green-100 group-hover:bg-green-200' : 'bg-purple-50 group-hover:bg-purple-100'}`}>
                      {activeShortForShare?.isReposted ? <Check size={22} className="text-green-600" /> : <Repeat size={22} className="text-purple-600" />}
                    </div>
                    <span className="text-[10px] text-gray-600 font-bold">{activeShortForShare?.isReposted ? t('undo_repost') : t('repost')}</span>
                 </button>

                 {isVideoOwner && (
                     <button 
                        onClick={handleEditClick}
                        className="flex flex-col items-center gap-2 group"
                     >
                        <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                          <Edit2 size={22} className="text-purple-600" />
                        </div>
                        <span className="text-[10px] text-gray-600 font-bold">{t('edit')}</span>
                     </button>
                 )}

                 {isVideoOwner && (
                     <button 
                        onClick={handleDeleteVideo}
                        className="flex flex-col items-center gap-2 group"
                     >
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center group-hover:bg-red-100 transition-colors">
                          <Trash2 size={22} className="text-red-600" />
                        </div>
                        <span className="text-[10px] text-gray-600 font-bold">{t('delete')}</span>
                     </button>
                 )}

              </div>
            </div>
          </div>
        </div>,
        document.body
    )}

    {/* EDIT MODAL */}
    {isEditModalOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={() => !isSavingSettings && setIsEditModalOpen(false)} />
            <div className="bg-white w-full max-w-md h-[70vh] rounded-t-3xl relative z-10 animate-in slide-in-from-bottom duration-300 flex flex-col p-6 pb-safe">
                
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                        {t('edit_video_settings')}
                    </h3>
                    <button onClick={() => setIsEditModalOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                        <X size={20} className="text-gray-600" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
                    {/* Privacy Section */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{t('who_can_watch')}</h4>
                        <div className="space-y-3">
                            <button 
                                onClick={() => setEditPrivacy('public')}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                                    editPrivacy === 'public' 
                                    ? 'bg-blue-50 border-blue-500 text-blue-700' 
                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${editPrivacy === 'public' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                        <Globe size={24} />
                                    </div>
                                    <div className="text-start">
                                        <h4 className="font-bold text-sm">{t('privacy_public')}</h4>
                                    </div>
                                </div>
                                {editPrivacy === 'public' && <div className="w-4 h-4 bg-blue-600 rounded-full"></div>}
                            </button>

                            <button 
                                onClick={() => setEditPrivacy('private')}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                                    editPrivacy === 'private' 
                                    ? 'bg-gray-100 border-gray-400 text-gray-900' 
                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${editPrivacy === 'private' ? 'bg-gray-300' : 'bg-gray-100'}`}>
                                        <Lock size={24} />
                                    </div>
                                    <div className="text-start">
                                        <h4 className="font-bold text-sm">{t('privacy_private')}</h4>
                                    </div>
                                </div>
                                {editPrivacy === 'private' && <div className="w-4 h-4 bg-gray-800 rounded-full"></div>}
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full"></div>

                    {/* Permissions Section (Toggles) */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{t('settings_control_panel')}</h4>
                        <div className="space-y-2">
                            {/* Comments Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3 text-gray-700">
                                    <MessageCircle size={20} />
                                    <span className="font-bold text-sm">{t('allow_comments')}</span>
                                </div>
                                <button onClick={() => setEditAllowComments(!editAllowComments)} className="transition-transform active:scale-90">
                                    {editAllowComments ? <ToggleRight size={36} className="text-green-600" /> : <ToggleLeft size={36} className="text-gray-300" />}
                                </button>
                            </div>

                            {/* Downloads Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3 text-gray-700">
                                    <Download size={20} />
                                    <span className="font-bold text-sm">{t('allow_downloads')}</span>
                                </div>
                                <button onClick={() => setEditAllowDownloads(!editAllowDownloads)} className="transition-transform active:scale-90">
                                    {editAllowDownloads ? <ToggleRight size={36} className="text-green-600" /> : <ToggleLeft size={36} className="text-gray-300" />}
                                </button>
                            </div>

                            {/* Repost Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3 text-gray-700">
                                    <Repeat size={20} />
                                    <span className="font-bold text-sm">{t('allow_duet')}</span>
                                </div>
                                <button onClick={() => setEditAllowRepost(!editAllowRepost)} className="transition-transform active:scale-90">
                                    {editAllowRepost ? <ToggleRight size={36} className="text-green-600" /> : <ToggleLeft size={36} className="text-gray-300" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                    <button 
                        onClick={handleSaveSettings}
                        disabled={isSavingSettings}
                        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                    >
                        {isSavingSettings ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        {isSavingSettings ? t('saving') : t('save')}
                    </button>
                </div>

            </div>
        </div>,
        document.body
    )}

    {/* COMMENTS MODAL */}
    {isCommentsOpen && createPortal(
         <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={() => setIsCommentsOpen(false)} />
            <div className="bg-white w-full max-w-md h-[65vh] rounded-t-2xl sm:rounded-2xl relative z-10 animate-slide-up-fast shadow-2xl flex flex-col overflow-hidden">
               
               <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white z-20">
                   <div className="w-8"></div>
                   <h3 className="font-bold text-gray-800">{t('comment')}</h3>
                   <button onClick={() => setIsCommentsOpen(false)} className="bg-gray-100 p-1 rounded-full hover:bg-gray-200">
                       <X size={20} className="text-gray-600" />
                   </button>
               </div>

               <div className="flex-1 overflow-y-auto no-scrollbar p-4">
                 {isLoadingComments && comments.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-40 gap-2">
                      <Loader2 size={30} className="text-blue-600 animate-spin" />
                   </div>
                 ) : comments.length > 0 ? (
                   comments.map((comment) => renderCommentItem(comment))
                 ) : (
                   <div className="flex flex-col items-center justify-center h-full min-h-[250px] animate-in fade-in zoom-in duration-300">
                     <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100 shadow-sm">
                        <MessageCircle size={48} className="text-gray-300" strokeWidth={1} />
                     </div>
                     <h3 className="text-gray-800 font-bold text-sm mb-1">{t('no_comments')}</h3>
                   </div>
                 )}
               </div>

               <div className="p-3 border-t border-gray-100 bg-white pb-safe z-40 relative">
                  {replyingToUser && (
                        <div className="flex items-center justify-between px-2 mb-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-1">
                                <CornerDownLeft size={12} />
                                <span>{t('replying_to')} <span className="font-bold text-blue-600">{replyingToUser.name}</span></span>
                            </div>
                            <button onClick={() => { setReplyingToUser(null); setReplyingTo(null); }} className="p-1 hover:bg-gray-200 rounded-full"><X size={12} /></button>
                        </div>
                  )}
                  <div className="flex items-center gap-2">
                     <div className="w-8 h-8 flex-shrink-0">
                        <Avatar 
                            name={localStorage.getItem('userName') || 'أنا'} 
                            src={localStorage.getItem('userAvatar') ? (localStorage.getItem('userAvatar')!.startsWith('http') ? localStorage.getItem('userAvatar') : `${API_BASE_URL}${localStorage.getItem('userAvatar')}`) : null} 
                            className="w-8 h-8" 
                        />
                     </div>
                     <div className="flex-1 bg-gray-100 rounded-full flex items-center px-4 py-2 h-10">
                        <input 
                           ref={inputRef}
                           type="text" 
                           value={commentText}
                           onChange={(e) => setCommentText(e.target.value)}
                           onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                           placeholder={replyingToUser ? t('reply_placeholder') : t('post_placeholder')}
                           className="bg-transparent border-none outline-none w-full text-sm placeholder:text-gray-500 dir-auto text-start h-full"
                           autoFocus={!!replyingToUser}
                        />
                     </div>
                     <button 
                        onClick={handleSendComment} 
                        disabled={!commentText.trim()} 
                        className={`h-10 w-10 flex items-center justify-center rounded-full transition-colors ${!commentText.trim() ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50 bg-transparent'}`}
                     >
                        <Send size={20} style={{ transform: language === 'en' ? 'scaleX(-1)' : 'none' }} />
                     </button>
                  </div>
               </div>
            </div>
         </div>, document.body
      )}

      {activeCommentAction && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-end justify-center">
             <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setActiveCommentAction(null)} />
             <div className="bg-white w-full max-w-md rounded-t-2xl pb-safe relative z-10 p-4 animate-slide-up-fast">
                 <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
                 <div className="flex flex-col gap-2">
                    <button 
                        onClick={handleCopyComment}
                        className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl w-full"
                    >
                        <Copy size={20} className="text-blue-600" />
                        <span className="font-bold text-gray-700">{t('copy_text')}</span>
                    </button>

                    {isCommentOwner ? (
                        <button onClick={handleDeleteComment} className="flex items-center gap-4 p-3 hover:bg-red-50 rounded-xl w-full"><Trash2 size={20} className="text-red-600" /><span className="font-bold text-red-600">{t('delete')}</span></button>
                    ) : (
                        <button onClick={handleReportComment} className="flex items-center gap-4 p-3 hover:bg-red-50 rounded-xl w-full">
                            <Flag size={20} className="text-red-600" />
                            <span className="font-bold text-red-600">{t('report')}</span>
                        </button>
                    )}
                 </div>
             </div>
          </div>, document.body
      )}

      {commentToDelete && createPortal(
           <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setCommentToDelete(null)} />
             <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100">
                <div className="flex flex-col items-center text-center gap-4 pt-2">
                   <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-1 shadow-inner">
                      <Trash2 size={36} className="text-red-500" strokeWidth={2.5} />
                   </div>
                   <div>
                     <h3 className="text-2xl font-black text-gray-900 mb-2">{t('delete')}?</h3>
                     <p className="text-gray-500 text-base leading-relaxed font-medium px-4">
                        {t('post_delete_confirm')}
                     </p>
                   </div>
                   <div className="flex gap-3 w-full mt-4">
                      <button 
                        onClick={confirmDeleteComment} 
                        className="flex-1 bg-red-600 text-white py-3.5 rounded-2xl font-bold text-base hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-200"
                      >
                        {t('yes')}
                      </button>
                      <button 
                        onClick={() => setCommentToDelete(null)} 
                        className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold text-base hover:bg-gray-200 active:scale-95 transition-all"
                      >
                        {t('no')}
                      </button>
                   </div>
                </div>
             </div>
           </div>, document.body
      )}
    </>
  );
};

export default ShortsView;
