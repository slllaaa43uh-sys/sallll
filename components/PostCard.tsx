
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Post } from '../types';
import { API_BASE_URL } from '../constants';
import { 
  MessageCircle, Share2, MoreHorizontal, ThumbsUp, 
  X, EyeOff, Link, Flag, Send, Trash2, Copy, Repeat, 
  Bookmark, Phone, Mail, Loader2, ArrowRight, CornerDownLeft, Heart, ChevronDown, Star, Tag, Minus, Play,
  CheckCircle, Clock, Briefcase, Volume2, VolumeX, Languages, Settings, Check, Image as ImageIcon, AlertCircle
} from 'lucide-react';
import Avatar from './Avatar';
import MediaGrid from './MediaGrid';
import { useLanguage } from '../contexts/LanguageContext';
import { getDisplayLocation } from '../data/locations';

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
  isLiked: boolean; 
  replies?: Comment[]; 
  pending?: boolean; 
}

interface PostCardProps {
  post: Post;
  variant?: 'feed' | 'profile';
  onDelete?: () => void;
  onReport?: (type: 'post' | 'comment' | 'reply', id: string, name: string) => void;
  onProfileClick?: (userId: string) => void;
  isActive?: boolean;
}

const TARGET_LANGUAGES = [
  { code: "zh", label: "中文" }, 
  { code: "ur", label: "اردو" }, 
  { code: "hi", label: "हिन्दी" }, 
  { code: "ne", label: "नेपाली" }, 
  { code: "bn", label: "বাংলা" }, 
  { code: "tr", label: "Türkçe" }, 
  { code: "ru", label: "Русский" }, 
  { code: "am", label: "አማርኛ" }, 
  { code: "so", label: "Soomaali" }, 
  { code: "fr", label: "Français" }, 
  { code: "sw", label: "Kiswahili" }, 
  { code: "en", label: "English" }, 
  { code: "swb", label: "Shikomor" }, 
  { code: "lg", label: "Luganda" }, 
  { code: "es", label: "Español" }, 
  { code: "it", label: "Italiano" }, 
  { code: "en-US", label: "English (US)" }, 
  { code: "pt-BR", label: "Português (Brasil)" }, 
  { code: "ja", label: "日本語" }, 
  { code: "ko", label: "한국어" }, 
  { code: "ko", label: "조선말" }, 
  { code: "fa", label: "فارسی" }, 
];

const PostCard: React.FC<PostCardProps> = ({ post, variant = 'feed', onDelete, onReport, onProfileClick, isActive = true }) => {
  const { t, language, translationTarget, setTranslationTarget } = useLanguage();
  const currentUserId = localStorage.getItem('userId');
  
  const [optimisticLiked, setOptimisticLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [commentsCount, setCommentsCount] = useState(post.comments);
  const [jobStatus, setJobStatus] = useState<'open' | 'negotiating' | 'hired'>(post.jobStatus || 'open');

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  
  const [isImageLoaded, setIsImageLoaded] = useState(true); 
  const [imageError, setImageError] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  
  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslationSheetOpen, setIsTranslationSheetOpen] = useState(false);

  const [isRepostModalOpen, setIsRepostModalOpen] = useState(false);
  const [repostText, setRepostText] = useState('');
  const [isReposting, setIsReposting] = useState(false);

  const [isDeletePostModalOpen, setIsDeletePostModalOpen] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null); 
  
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  const [activeCommentAction, setActiveCommentAction] = useState<Comment | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null); 
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const [isStoryOpen, setIsStoryOpen] = useState(false);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true); 
  const [isPlaying, setIsPlaying] = useState(false); 

  // --- Dynamic Time & Location Calculation ---
  const getDynamicTime = () => {
      if (!post.createdAt) return post.timeAgo; // Fallback to static string
      
      const date = new Date(post.createdAt);
      const now = new Date();
      const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (seconds < 60) return language === 'ar' ? 'الآن' : 'Just now';
      
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return language === 'ar' ? `${minutes} د` : `${minutes}m`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return language === 'ar' ? `${hours} س` : `${hours}h`;
      
      const days = Math.floor(hours / 24);
      if (days < 30) return language === 'ar' ? `${days} يوم` : `${days}d`;
      
      const months = Math.floor(days / 30);
      if (months < 12) return language === 'ar' ? `${months} شهر` : `${months}mo`;
      
      const years = Math.floor(months / 12);
      return language === 'ar' ? `${years} سنة` : `${years}y`;
  };

  const getDynamicLocation = () => {
      // If it's explicitly "General" or "عام" in backend, translate based on UI language
      if (post.location === 'عام' || post.location === 'General') {
          return t('location_general');
      }
      
      // If we have raw country/city data, translate dynamically
      if (post.country) {
          const loc = getDisplayLocation(post.country, post.city || null, language);
          if (loc.cityDisplay) {
              return `${loc.countryDisplay} | ${loc.cityDisplay}`;
          }
          return loc.countryDisplay;
      }

      // Fallback to static string
      return post.location || t('location_general');
  };

  const displayTime = getDynamicTime();
  const displayLocation = getDynamicLocation();

  // --- TIME HELPER FOR COMMENTS (Matches App.tsx logic) ---
  const getCommentRelativeTime = (dateStr: string) => {
      if (!dateStr) return 'الآن';
      const date = new Date(dateStr);
      const now = new Date();
      const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (seconds < 60) return 'الآن';
      
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} د`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} س`;
      
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days} يوم`;
      
      const months = Math.floor(days / 30);
      if (months < 12) return `${months} شهر`;
      
      const years = Math.floor(months / 12);
      return `${years} سنة`;
  };

  useEffect(() => {
    setOptimisticLiked(post.isLiked || false);
    setLikesCount(post.likes);
    setCommentsCount(post.comments);
    setJobStatus(post.jobStatus || 'open');
  }, [post.isLiked, post.likes, post.comments, post.id, post.jobStatus]);

  useEffect(() => {
    setImageError(false);
    setIsVideoReady(false);
    setVideoError(false);
    setIsPlaying(false);
  }, [post.id, post.image]);

  useEffect(() => {
    if (!isActive) {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isActive]);

  useEffect(() => {
    const handleStoryToggle = (e: CustomEvent) => {
        setIsStoryOpen(e.detail.isOpen);
        if (e.detail.isOpen && videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };
    window.addEventListener('story-viewer-toggle', handleStoryToggle as EventListener);
    return () => { window.removeEventListener('story-viewer-toggle', handleStoryToggle as EventListener); };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && isActive && !isStoryOpen) {
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {})
                            .catch(() => {
                                video.muted = true;
                                setIsMuted(true);
                                video.play().catch(() => {});
                            });
                    }
                } else {
                    video.pause();
                    setIsPlaying(false);
                }
            });
        },
        { threshold: 0.65 } 
    );
    observer.observe(video);
    return () => { if (video) observer.unobserve(video); };
  }, [post.id, isActive, isStoryOpen]); 

  const togglePlay = (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      const video = videoRef.current;
      if (video) {
          if (video.paused) {
              video.play().then(() => setIsPlaying(true)).catch(()=>{});
          } else {
              video.pause(); 
              setIsPlaying(false);
          }
      }
  };

  const toggleMute = (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      const video = videoRef.current;
      if (video) {
          const newMuted = !isMuted;
          video.muted = newMuted;
          setIsMuted(newMuted);
      }
  };

  const handleVideoPlaying = () => {
      setIsVideoReady(true); 
      setIsPlaying(true);
  };

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onProfileClick && post.user._id) {
        onProfileClick(post.user._id);
    }
  };

  const processApiComment = useCallback((c: any, userId: string): Comment => {
    const likesList = Array.isArray(c.likes) ? c.likes : [];
    const likesCount = likesList.length;
    
    const isLiked = likesList.some((like: any) => {
        const idToCheck = typeof like === 'object' ? (like.user?._id || like.user || like._id) : like;
        return String(idToCheck) === String(userId);
    });

    return {
      _id: c._id || c.id,
      text: c.text,
      user: {
        _id: c.user?._id || c.user?.id || 'unknown',
        name: c.user?.name || 'مستخدم',
        avatar: c.user?.avatar
      },
      createdAt: c.createdAt,
      likes: likesCount,
      isLiked: isLiked,
      replies: Array.isArray(c.replies) ? c.replies.map((r: any) => processApiComment(r, userId)) : []
    };
  }, []);

  const fetchComments = useCallback(async (forceLoader = false) => {
    if (forceLoader) setIsLoadingComments(true);
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId') || '';
      
      const response = await fetch(`${API_BASE_URL}/api/v1/posts/${post.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const rawComments = data.post?.comments || [];
        
        if (Array.isArray(rawComments)) {
            const processedComments = rawComments.map((c: any) => processApiComment(c, userId));
            processedComments.sort((a: Comment, b: Comment) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setComments(processedComments);
            setCommentsCount(processedComments.length);
        }
      }
    } catch (error) { console.error("Failed comments", error); } 
    finally { setIsLoadingComments(false); }
  }, [post.id, processApiComment]);

  useEffect(() => {
    if (isCommentsOpen) {
       const needsLoader = comments.length === 0;
       fetchComments(needsLoader);
    } else {
      setReplyingTo(null);
      setCommentText('');
    }
  }, [isCommentsOpen, fetchComments]); 

  const handleOpenComments = () => { if (comments.length === 0) setIsLoadingComments(true); setIsCommentsOpen(true); };

  const toggleReplies = (commentId: string) => {
    setExpandedComments(prev => {
        const next = new Set(prev);
        if (next.has(commentId)) next.delete(commentId);
        else next.add(commentId);
        return next;
    });
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    const token = localStorage.getItem('token');
    const textToSend = commentText;
    const tempId = `temp-${Date.now()}`;
    
    const optimisticComment: Comment = {
        _id: tempId,
        text: textToSend,
        user: {
            _id: localStorage.getItem('userId') || 'me',
            name: localStorage.getItem('userName') || 'أنا',
            avatar: localStorage.getItem('userAvatar') || undefined
        },
        createdAt: new Date().toISOString(),
        likes: 0,
        isLiked: false,
        replies: [],
        pending: true
    };

    if (replyingTo) {
        setExpandedComments(prev => new Set(prev).add(replyingTo._id));
        setComments(prev => prev.map(c => {
            if (c._id === replyingTo._id) {
                return { ...c, replies: [...(c.replies || []), optimisticComment] };
            }
            return c;
        }));
    } else {
        setComments(prev => [optimisticComment, ...prev]);
        setCommentsCount(prev => prev + 1);
    }

    setCommentText('');
    const wasReplyingTo = replyingTo; 
    setReplyingTo(null); 
    
    try {
      let url = `${API_BASE_URL}/api/v1/posts/${post.id}/comments`;
      if (wasReplyingTo) {
          url = `${API_BASE_URL}/api/v1/posts/${post.id}/comments/${wasReplyingTo._id}/replies`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text: textToSend })
      });

      if (response.ok) fetchComments(false); 
      else throw new Error("Failed");
    } catch (error) {
      if (wasReplyingTo) {
          setComments(prev => prev.map(c => {
              if (c._id === wasReplyingTo._id) return { ...c, replies: c.replies?.filter(r => r._id !== tempId) };
              return c;
          }));
      } else {
          setComments(prev => prev.filter(c => c._id !== tempId));
          setCommentsCount(prev => prev - 1);
      }
    }
  };

  const handleCommentLike = async (commentId: string, replyId?: string) => {
    const updateLikeInList = (list: Comment[]): Comment[] => {
        return list.map(c => {
            const isTarget = replyId ? c._id === replyId : c._id === commentId;
            if (isTarget) {
                return { ...c, isLiked: !c.isLiked, likes: c.isLiked ? Math.max(0, c.likes - 1) : c.likes + 1 };
            }
            if (c.replies && c.replies.length > 0) {
                return { ...c, replies: updateLikeInList(c.replies) };
            }
            return c;
        });
    };
    setComments(prev => updateLikeInList(prev));
    try {
      const token = localStorage.getItem('token');
      let targetUrl = '';
      if (replyId) targetUrl = `${API_BASE_URL}/api/v1/posts/${post.id}/comments/${commentId}/replies/${replyId}/like`;
      else targetUrl = `${API_BASE_URL}/api/v1/posts/${post.id}/comments/${commentId}/like`;
      await fetch(targetUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (error) { fetchComments(); }
  };

  const handleCopyComment = () => { if (activeCommentAction) { navigator.clipboard.writeText(activeCommentAction.text); setActiveCommentAction(null); } };
  const handleReportComment = () => { if (activeCommentAction && onReport) { let isReply = false; for (const c of comments) { if (c.replies?.some(r => r._id === activeCommentAction._id)) { isReply = true; break; } } onReport(isReply ? 'reply' : 'comment', activeCommentAction._id, activeCommentAction.user.name); setActiveCommentAction(null); } };
  const handleDeleteComment = () => { if (activeCommentAction) { setCommentToDelete(activeCommentAction); setActiveCommentAction(null); } };

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;
    setIsDeletingComment(true);
    const targetId = commentToDelete._id;
    let parentId: string | null = null;
    let isReply = false;
    const topLevelComment = comments.find(c => c._id === targetId);
    if (!topLevelComment) {
        for (const c of comments) {
            if (c.replies?.some(r => r._id === targetId)) { isReply = true; parentId = c._id; break; }
        }
    }
    
    try {
        const token = localStorage.getItem('token');
        let url = '';
        if (isReply && parentId) url = `${API_BASE_URL}/api/v1/posts/${post.id}/comments/${parentId}/replies/${targetId}`;
        else url = `${API_BASE_URL}/api/v1/posts/${post.id}/comments/${targetId}`;
        
        const response = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        
        if (response.ok) {
            if (isReply && parentId) {
                setComments(prev => prev.map(c => {
                    if (c._id === parentId) return { ...c, replies: c.replies?.filter(r => r._id !== targetId) };
                    return c;
                }));
            } else {
                setComments(prev => prev.filter(c => c._id !== targetId));
                setCommentsCount(prev => Math.max(0, prev - 1));
            }
            setCommentToDelete(null); 
        } else {
            alert(t('delete_fail'));
            setCommentToDelete(null);
        }
    } catch (e) { 
        alert(t('delete_fail'));
        setCommentToDelete(null); 
    } finally { 
        setIsDeletingComment(false); 
    }
  };

  const handleLike = async () => {
    const previousState = optimisticLiked;
    const newState = !previousState;
    setOptimisticLiked(newState);
    setLikesCount(prev => newState ? prev + 1 : Math.max(0, prev - 1));
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const response = await fetch(`${API_BASE_URL}/api/v1/posts/${post.id}/react`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ reactionType: 'like' }), keepalive: true });
        if (!response.ok) throw new Error("Failed");
    } catch (error) {
        setOptimisticLiked(previousState);
        setLikesCount(prev => previousState ? prev + 1 : Math.max(0, prev - 1));
    }
  };
  
  const handleNativeShare = async () => {
    if (navigator.share) {
        try { 
            await navigator.share({ 
                title: `منشور بواسطة ${post.user.name}`, 
                text: post.content.substring(0, 100), 
                url: `${API_BASE_URL}/share/post/${post.id}` // Updated to backend sharing route
            }); 
            setIsShareOpen(false); 
        } catch (err) {}
    } else { 
        navigator.clipboard.writeText(`${API_BASE_URL}/share/post/${post.id}`); // Fallback for copy
        alert(t('copy_link') + " (تم النسخ)"); 
    }
  };

  const handleRepostClick = () => { setIsShareOpen(false); setIsRepostModalOpen(true); };
  const handleRepostSubmit = async () => {
      setIsReposting(true);
      const token = localStorage.getItem('token');
      // Fix: repost logic. If originalPost exists, we repost the originalPost id.
      // Otherwise we repost this post.id
      const targetPostId = post.originalPost ? (post.originalPost.id || post.originalPost._id) : (post.id || post._id);
      
      try {
          const response = await fetch(`${API_BASE_URL}/api/v1/posts/${targetPostId}/repost`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ content: repostText }) });
          if (response.ok) { alert(t('repost_success')); setIsRepostModalOpen(false); setRepostText(''); } else { alert(t('repost_fail')); }
      } catch (error) { alert(t('repost_error')); } finally { setIsReposting(false); }
  };

  const handleTranslate = async () => {
      if (isTranslated) { setIsTranslated(false); return; }
      if (translatedText) { setIsTranslated(true); return; }
      setIsTranslating(true);
      try {
          const target = translationTarget; 
          const textToTranslate = post.content;
          const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=ar|${target}`);
          const data = await response.json();
          if (data.responseData && data.responseData.translatedText) { setTranslatedText(data.responseData.translatedText); setIsTranslated(true); } else { alert("Error"); }
      } catch (error) { alert("Failed"); } finally { setIsTranslating(false); }
  };

  const renderPostContent = (p: Post) => (
      <>
        {p.content && (
            <div className="px-4 mb-2">
                <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap dir-auto text-start">
                    {isTranslated && translatedText ? translatedText : p.content}
                </p>
                <div className="flex items-center justify-between mt-2">
                    <button onClick={handleTranslate} disabled={isTranslating} className="text-blue-600 text-[10px] font-bold flex items-center gap-1 hover:underline disabled:opacity-50">
                        {isTranslating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                        {isTranslating ? t('translating') : (isTranslated ? t('show_original') : t('translate_post'))}
                    </button>
                    <button onClick={() => setIsTranslationSheetOpen(true)} className="text-gray-400 p-1 hover:bg-gray-100 rounded-full"><Settings size={12} /></button>
                </div>
            </div>
        )}

        {(() => {
            const singleVideoUrl = (p.media?.length === 1 && p.media[0].type === 'video') ? p.media[0].url : (p.image && p.image.match(/\.(mp4|webm|mov|avi)$/i) ? p.image : null);

            if (singleVideoUrl) {
                return (
                  <div onClick={togglePlay} className="relative mb-3 w-full aspect-square overflow-hidden bg-black border border-gray-100 dark:border-gray-800 group cursor-pointer">
                    {!isVideoReady && !videoError && <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-100 dark:bg-gray-900"></div>}
                    {videoError && <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-400 z-30"><AlertCircle size={32} /><span className="text-xs mt-2 font-medium">فشل تحميل الفيديو</span></div>}
                    <video key={p.id} ref={videoRef} src={singleVideoUrl} playsInline loop muted={isMuted} className={`w-full h-full object-contain transition-opacity duration-500 ${isVideoReady ? 'opacity-100' : 'opacity-0'}`} onPlaying={handleVideoPlaying} onPause={() => setIsPlaying(false)} onError={() => setVideoError(true)} />
                    {!isPlaying && isVideoReady && !videoError && <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none bg-black/20"><div className="w-14 h-14 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20 shadow-lg"><Play size={28} className="text-white fill-white ml-1" /></div></div>}
                    {isVideoReady && !videoError && <button onClick={toggleMute} className="absolute bottom-4 left-4 z-30 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all backdrop-blur-sm shadow-sm">{isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>}
                  </div>
                );
            } 
            
            if (p.media && p.media.length > 0) {
                return <div className="mb-3"><MediaGrid media={p.media} maxDisplay={3} variant={variant} /></div>;
            }
            
            if (p.image) {
                const containerClass = variant === 'feed'
                    ? "relative mb-3 w-full aspect-square overflow-hidden rounded-lg"
                    : "relative mb-3 w-full aspect-square overflow-hidden bg-gray-100 border border-gray-100 rounded-lg";

                return (
                  <div className={containerClass}>
                    {!isImageLoaded && !imageError && <div className="absolute inset-0 flex items-center justify-center z-10"><ImageIcon className="text-gray-300 dark:text-gray-600 animate-pulse" size={48} /></div>}
                    {imageError && <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-400 z-10"><AlertCircle size={32} /><span className="text-xs mt-2 font-medium">فشل تحميل الصورة</span></div>}
                    <img 
                        src={p.image} 
                        alt="Post content" 
                        className={`w-full h-full object-cover transition-opacity duration-300 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={() => setIsImageLoaded(true)}
                        onError={() => setImageError(true)}
                        decoding="async"
                        loading="lazy"
                    />
                  </div>
                );
            }
            return null;
        })()}
      </>
  );

  const renderSharedPost = (original: Post) => (
      <div className="mx-4 mb-3 border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="p-3 flex items-center gap-2 bg-gray-50 border-b border-gray-100">
              <Avatar name={original.user.name} src={original.user.avatar} className="w-8 h-8" textClassName="text-xs" />
              <div className="flex flex-col"><span className="font-bold text-xs text-gray-900">{original.user.name}</span><span className="text-[10px] text-gray-500">{original.timeAgo}</span></div>
          </div>
          {renderPostContent(original)}
      </div>
  );

  if (!isVisible) return null;

  const handleHidePost = async () => {
    setIsVisible(false); setIsMenuOpen(false);
    try { await fetch(`${API_BASE_URL}/api/v1/posts/${post.id}/hide`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }); } catch (e) { setIsVisible(true); }
  };
  
  const handleJobStatus = async (status: 'hired' | 'negotiating' | 'open') => {
    const oldStatus = jobStatus; setJobStatus(status); setIsMenuOpen(false);
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/posts/${post.id}/job-status`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ status }) });
        if (!response.ok) setJobStatus(oldStatus);
        else window.dispatchEvent(new CustomEvent('post-status-updated', { detail: { postId: post.id, jobStatus: status } }));
    } catch (e) { setJobStatus(oldStatus); }
  };

  const handleDeletePost = () => { setIsMenuOpen(false); if (onDelete) onDelete(); else setIsDeletePostModalOpen(true); };
  const confirmDeletePost = async () => {
    setIsDeletingPost(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/posts/${post.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        if (response.ok) { setIsVisible(false); setIsDeletePostModalOpen(false); } else { setIsDeletePostModalOpen(false); }
    } catch (e) { setIsDeletePostModalOpen(false); } finally { setIsDeletingPost(false); }
  };

  const handleReportPost = () => { if (onReport) { onReport('post', post.id, post.user.name); setIsMenuOpen(false); } };
  const handleContactClick = () => { setIsMenuOpen(false); setIsContactOpen(true); };
  const handleTouchStart = (comment: Comment) => { longPressTimerRef.current = setTimeout(() => { setActiveCommentAction(comment); }, 600); };
  const handleTouchEnd = () => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } };

  // --- RENDER ---
  const isCommentOwner = activeCommentAction && (
      activeCommentAction.user._id === currentUserId || 
      activeCommentAction.user._id === 'me'
  );

  // The post content to be shown in the repost modal
  const contentToRepost = post.originalPost || post;

  return (
    <div className="mb-3">
      <div className="bg-white shadow-sm py-4 relative">
        <div className="px-4 flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="relative cursor-pointer" onClick={handleAvatarClick}><Avatar name={post.user.name} src={post.user.avatar} className="w-10 h-10" /></div>
            <div>
              <div className="flex items-center gap-2"><h3 className="font-bold text-gray-900 text-sm cursor-pointer" onClick={handleAvatarClick}>{post.user.name}</h3>{post.originalPost && <span className="text-gray-400 text-xs flex items-center gap-1"><Repeat size={12} />{t('repost')}</span>}</div>
              {/* Dynamic Time and Location */}
              <div className="flex flex-col gap-0.5"><div className="flex items-center gap-1"><span className="text-xs text-gray-500">{displayTime}</span><span className="text-gray-300 text-[10px]">•</span><span className="text-xs text-gray-400">{displayLocation}</span></div></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMenuOpen(true)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><MoreHorizontal size={20} /></button>
            <button onClick={handleHidePost} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
          </div>
        </div>

        {(post.title || post.category || post.isFeatured) && (
          <div className="px-4 mb-2 flex flex-wrap items-center gap-2">
            {post.isFeatured && <span className="relative bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-amber-200 overflow-hidden"><span className="absolute inset-0 bg-white/40 animate-pulse"></span><span className="relative flex items-center gap-1"><Star size={10} className="fill-amber-700" /> {t('post_premium')}</span></span>}
            {post.title && <h4 className="font-bold text-sm text-blue-600 leading-tight">{t(post.title)}</h4>}
            {post.category && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium border border-gray-200 flex items-center gap-1"><Tag size={10} className="text-gray-400" />{t(post.category)}</span>}
          </div>
        )}

        {jobStatus === 'hired' && <div className="px-4 mb-2"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle size={12} />{t('status_hired')}</span></div>}
        {jobStatus === 'negotiating' && <div className="px-4 mb-2"><span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 w-fit"><Clock size={12} />{t('status_negotiating')}</span></div>}

        {post.originalPost ? <>{<div className="px-4 mb-2"><p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap dir-auto text-start">{post.content}</p></div>}{renderSharedPost(post.originalPost)}</> : renderPostContent(post)}

        <div className="px-4 flex justify-between items-center pb-2 border-b border-gray-100 text-xs text-gray-500 mb-2">
          <div className="flex items-center gap-1"><div className={`p-0.5 rounded-full transition-all duration-300 ${optimisticLiked ? 'bg-blue-500 scale-110' : 'bg-gray-400'}`}><ThumbsUp size={10} className="text-white fill-current" /></div><span key={likesCount} className="animate-in fade-in zoom-in duration-200 font-bold text-gray-600">{likesCount}</span></div>
          <div className="flex gap-3"><button onClick={handleOpenComments} className="hover:underline">{commentsCount} {t('comment')}</button><span>{post.repostsCount || 0} {t('share')}</span></div>
        </div>

        <div className="px-4 flex justify-between items-center">
          <button onClick={handleLike} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all active:scale-95 ${optimisticLiked ? 'text-blue-600' : 'text-gray-600'}`}><ThumbsUp size={18} className={`transition-transform duration-200 ${optimisticLiked ? 'fill-current scale-110' : ''}`} /><span className="text-sm font-medium">{optimisticLiked ? t('liked') : t('like')}</span></button>
          <button onClick={handleOpenComments} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"><MessageCircle size={18} /><span className="text-sm font-medium">{t('comment')}</span></button>
          <button onClick={handleRepostClick} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"><Repeat size={18} /><span className="text-sm font-medium">{t('repost')}</span></button>
        </div>
      </div>

      {/* --- REPOST PAGE (Full Screen) --- */}
      {isRepostModalOpen && createPortal(
        <div className="fixed inset-0 z-[20000] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between pt-safe bg-white z-10 sticky top-0">
                <button 
                    onClick={() => { setIsRepostModalOpen(false); setRepostText(''); }} 
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <X size={24} className="text-gray-700" />
                </button>
                <span className="font-bold text-lg text-gray-800">{t('repost')}</span>
                <button 
                    onClick={handleRepostSubmit} 
                    disabled={isReposting}
                    className="px-5 py-1.5 bg-green-600 text-white rounded-full font-bold text-sm shadow-md shadow-green-200 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isReposting && <Loader2 size={14} className="animate-spin" />}
                    {t('repost_button')}
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-10">
                {/* Input Area */}
                <div className="flex gap-3 mb-6">
                    <div className="flex-shrink-0">
                        <Avatar 
                            name={localStorage.getItem('userName') || 'أنا'} 
                            src={localStorage.getItem('userAvatar') ? (localStorage.getItem('userAvatar')!.startsWith('http') ? localStorage.getItem('userAvatar') : `${API_BASE_URL}${localStorage.getItem('userAvatar')}`) : null} 
                            className="w-10 h-10 border border-gray-100" 
                        />
                    </div>
                    <textarea 
                        value={repostText}
                        onChange={(e) => setRepostText(e.target.value)}
                        placeholder={t('write_thought')}
                        className="w-full h-24 p-2 text-base outline-none resize-none placeholder:text-gray-400 dir-auto text-start bg-transparent"
                        autoFocus
                    />
                </div>

                {/* Quoted Post Preview */}
                <div className="border border-gray-200 rounded-xl overflow-hidden mx-1 shadow-sm">
                    {/* Quoted Header */}
                    <div className="p-3 bg-gray-50 flex items-center gap-2 border-b border-gray-100">
                        <Avatar 
                            name={contentToRepost.user.name} 
                            src={contentToRepost.user.avatar} 
                            className="w-8 h-8" 
                            textClassName="text-xs" 
                        />
                        <div className="flex flex-col">
                            <span className="font-bold text-xs text-gray-900">{contentToRepost.user.name}</span>
                            <span className="text-[10px] text-gray-500">{contentToRepost.timeAgo}</span>
                        </div>
                    </div>
                    
                    {/* Quoted Content */}
                    <div className="bg-white">
                        {renderPostContent(contentToRepost)}
                    </div>
                </div>
            </div>
        </div>, document.body
      )}

      {/* --- MENU MODAL (OPTIONS) --- */}
      {isMenuOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMenuOpen(false)} />
          <div className="bg-white w-full max-w-md rounded-t-3xl relative z-10 animate-in slide-in-from-bottom duration-300 pb-safe shadow-2xl overflow-hidden">
             
             <div className="flex justify-center pt-3 pb-2" onClick={() => setIsMenuOpen(false)}>
               <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
             </div>

             <div className="p-5 pt-2 space-y-2">
                {/* SHARE & COPY BUTTONS (NEW) */}
                <button onClick={() => { handleNativeShare(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-2xl transition-colors text-gray-700 border border-gray-100">
                   <Share2 size={22} className="text-blue-600" />
                   <span className="font-bold">{t('share')}</span>
                </button>
                
                <button onClick={() => { 
                    navigator.clipboard.writeText(`${API_BASE_URL}/share/post/${post.id}`); 
                    alert(t('copy_link') + " (تم النسخ)"); 
                    setIsMenuOpen(false); 
                }} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-2xl transition-colors text-gray-700 border border-gray-100">
                   <Link size={22} className="text-purple-600" />
                   <span className="font-bold">{t('copy_link')}</span>
                </button>

                {post.user._id === currentUserId ? (
                   <>
                     {/* Job Status Section - Only show if it looks like a job or general post by me */}
                     <div className="bg-gray-50 rounded-2xl p-2 mb-2">
                         <button onClick={() => handleJobStatus('hired')} className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-xl transition-all text-green-700">
                            <div className="p-2 bg-green-100 rounded-full"><CheckCircle size={20} /></div>
                            <span className="font-bold text-sm">{t('status_mark_hired')}</span>
                            {jobStatus === 'hired' && <Check size={16} className="ml-auto" />}
                         </button>
                         <button onClick={() => handleJobStatus('negotiating')} className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-xl transition-all text-yellow-700">
                            <div className="p-2 bg-yellow-100 rounded-full"><Clock size={20} /></div>
                            <span className="font-bold text-sm">{t('status_mark_negotiating')}</span>
                            {jobStatus === 'negotiating' && <Check size={16} className="ml-auto" />}
                         </button>
                         {(jobStatus === 'hired' || jobStatus === 'negotiating') && (
                             <button onClick={() => handleJobStatus('open')} className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-xl transition-all text-blue-700">
                                <div className="p-2 bg-blue-100 rounded-full"><Briefcase size={20} /></div>
                                <span className="font-bold text-sm">{t('status_reopen')}</span>
                             </button>
                         )}
                     </div>

                     <button onClick={handleDeletePost} className="w-full flex items-center gap-3 p-4 bg-red-50 hover:bg-red-100 rounded-2xl transition-colors text-red-600 mb-2">
                        <Trash2 size={22} />
                        <span className="font-bold">{t('delete')}</span>
                     </button>
                   </>
                ) : (
                   <>
                     {/* RESTORING CONTACT BUTTON - FIX: Check jobStatus before showing */}
                     {(post.contactPhone || post.contactEmail) && jobStatus === 'open' && (
                        <button onClick={handleContactClick} className="w-full flex items-center gap-3 p-4 hover:bg-blue-50 rounded-2xl transition-colors text-blue-600 border border-gray-100 mb-2">
                            <Phone size={22} />
                            <span className="font-bold">{t('contact_header')}</span>
                        </button>
                     )}

                     <button onClick={handleHidePost} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-2xl transition-colors text-gray-700 border border-gray-100">
                        <EyeOff size={22} />
                        <span className="font-bold">{t('post_hide')}</span>
                     </button>
                     <button onClick={handleReportPost} className="w-full flex items-center gap-3 p-4 hover:bg-red-50 rounded-2xl transition-colors text-red-600 border border-gray-100">
                        <Flag size={22} />
                        <span className="font-bold">{t('report')}</span>
                     </button>
                   </>
                )}
                
                <button onClick={() => setIsMenuOpen(false)} className="w-full p-4 bg-gray-100 hover:bg-gray-200 rounded-2xl font-bold text-gray-800 transition-colors">
                   {t('cancel')}
                </button>
             </div>
          </div>
        </div>, document.body
      )}

      {isShareOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={() => setIsShareOpen(false)} />
          <div className="bg-white w-full max-w-md rounded-t-2xl relative z-10 animate-slide-up-fast pb-safe shadow-2xl p-5">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-gray-800 font-bold text-center flex-1">{t('share')}</h3>
                <button onClick={() => setIsShareOpen(false)} className="bg-gray-100 p-1 rounded-full hover:bg-gray-200"><X size={20} className="text-gray-600" /></button>
             </div>
             <div className="grid grid-cols-3 gap-4 mb-4">
                 <button onClick={handleNativeShare} className="flex flex-col items-center gap-2 group"><div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors"><Share2 size={24} className="text-blue-600" /></div><span className="text-xs text-gray-600 font-medium">{t('share')}</span></button>
                 <button onClick={handleRepostClick} className="flex flex-col items-center gap-2 group"><div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center group-hover:bg-green-100 transition-colors"><Repeat size={24} className="text-green-600" /></div><span className="text-xs text-gray-600 font-medium">{t('repost')}</span></button>
                 <button className="flex flex-col items-center gap-2 group" onClick={() => { navigator.clipboard.writeText(`${API_BASE_URL}/share/post/${post?.id}`); setIsShareOpen(false); alert(t('copy_link') + " (تم النسخ)"); }}><div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition-colors"><Link size={24} className="text-gray-600" /></div><span className="text-xs text-gray-600 font-medium">{t('copy_link')}</span></button>
             </div>
             <button onClick={() => setIsShareOpen(false)} className="w-full mt-4 p-3 bg-gray-100 rounded-xl font-bold">{t('cancel')}</button>
          </div>
        </div>, document.body
      )}
      
      {/* TRANSLATION SETTINGS SHEET */}
      {isTranslationSheetOpen && createPortal(
        <div className="fixed inset-0 z-[10002] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={() => setIsTranslationSheetOpen(false)} />
            <div className="bg-white w-full max-w-md h-[60vh] rounded-t-2xl relative z-10 animate-slide-up-fast flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-100"><h3 className="font-bold text-gray-800">{t('translation_settings')}</h3><button onClick={() => setIsTranslationSheetOpen(false)} className="bg-gray-100 p-1 rounded-full"><X size={20} /></button></div>
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100"><span className="text-xs text-gray-500 font-bold mb-2 block">{t('source_lang')}</span><div className="flex items-center justify-between"><span className="font-bold text-gray-800">{t('lang_ar')} (Auto)</span><Check size={18} className="text-gray-400" /></div></div>
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50 p-3 border-b border-gray-100"><span className="text-xs text-gray-500 font-bold">{t('target_lang')}</span></div>
                        <div className="max-h-[300px] overflow-y-auto">
                            {TARGET_LANGUAGES.map((lang) => (
                                <button key={lang.code} onClick={() => { setTranslationTarget(lang.code); setTranslatedText(null); setIsTranslated(false); setIsTranslationSheetOpen(false); }} className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors text-start ${translationTarget === lang.code ? 'bg-blue-50' : 'bg-white'}`}><span className={`font-bold text-sm ${translationTarget === lang.code ? 'text-blue-700' : 'text-gray-700'}`}>{lang.label}</span>{translationTarget === lang.code && <Check size={18} className="text-blue-600" />}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>, document.body
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
                   comments.map((comment) => (
                      <div key={comment._id} className="mb-4">
                          <div className="flex gap-3">
                              <Avatar name={comment.user.name} src={comment.user.avatar ? (comment.user.avatar.startsWith('http') ? comment.user.avatar : `${API_BASE_URL}${comment.user.avatar}`) : null} className="w-9 h-9" textClassName="text-sm" />
                              <div className="flex-1">
                                  <div className="bg-gray-100 p-3 rounded-2xl rounded-tr-none inline-block">
                                      <h4 className="font-bold text-xs text-gray-900 mb-1">{comment.user.name}</h4>
                                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.text}</p>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 px-1">
                                      <span className="text-[10px] text-gray-400">{getCommentRelativeTime(comment.createdAt)}</span>
                                      <button onClick={() => { setReplyingTo(comment); inputRef.current?.focus(); }} className="text-[11px] font-bold text-gray-500">{t('reply')}</button>
                                  </div>
                              </div>
                              <div className="pt-2 flex flex-col items-center gap-2">
                                  <button onClick={() => handleCommentLike(comment._id)} className="p-1">
                                      <Heart size={14} className={comment.isLiked ? "text-red-500 fill-red-500" : "text-gray-400"} />
                                  </button>
                                  <button onClick={() => setActiveCommentAction(comment)} className="p-1 text-gray-400 hover:text-gray-600">
                                      <MoreHorizontal size={14} />
                                  </button>
                              </div>
                          </div>
                          
                          {/* Replies */}
                          {comment.replies && comment.replies.length > 0 && expandedComments.has(comment._id) && (
                              <div className="mr-10 mt-2 space-y-3 pl-2 border-r-2 border-gray-100">
                                  {comment.replies.map(reply => (
                                      <div key={reply._id} className="flex gap-2">
                                          <Avatar name={reply.user.name} src={reply.user.avatar ? (reply.user.avatar.startsWith('http') ? reply.user.avatar : `${API_BASE_URL}${reply.user.avatar}`) : null} className="w-7 h-7" textClassName="text-xs" />
                                          <div className="flex-1">
                                              <div className="bg-gray-50 p-2 rounded-xl rounded-tr-none inline-block">
                                                  <h4 className="font-bold text-[10px] text-gray-900 mb-0.5">{reply.user.name}</h4>
                                                  <p className="text-xs text-gray-800">{reply.text}</p>
                                              </div>
                                              <div className="flex items-center gap-2 mt-0.5 px-1">
                                                  <span className="text-[9px] text-gray-400">{getCommentRelativeTime(reply.createdAt)}</span>
                                              </div>
                                          </div>
                                          <div className="flex flex-col items-center gap-1 pt-1">
                                              <button onClick={() => handleCommentLike(reply._id, comment._id)} className="p-0.5">
                                                  <Heart size={12} className={reply.isLiked ? "text-red-500 fill-red-500" : "text-gray-300"} />
                                              </button>
                                              <button onClick={() => setActiveCommentAction(reply)} className="p-0.5 text-gray-300 hover:text-gray-500">
                                                  <MoreHorizontal size={12} />
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                          
                          {comment.replies && comment.replies.length > 0 && (
                              <button onClick={() => toggleReplies(comment._id)} className="text-xs font-bold text-gray-500 mt-1 mr-12 flex items-center gap-1">
                                  <div className="w-4 h-[1px] bg-gray-300"></div>
                                  {expandedComments.has(comment._id) ? t('hide_replies') : `${t('view_replies')} (${comment.replies.length})`}
                              </button>
                          )}
                      </div>
                   ))
                 ) : (
                   <div className="flex flex-col items-center justify-center h-full min-h-[250px]">
                     <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <MessageCircle size={40} className="text-gray-300" strokeWidth={1} />
                     </div>
                     <h3 className="text-gray-500 font-bold text-sm">{t('no_comments')}</h3>
                   </div>
                 )}
               </div>

               <div className="p-3 border-t border-gray-100 bg-white pb-safe z-40 relative">
                  {replyingTo && (
                        <div className="flex items-center justify-between px-2 mb-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-1">
                                <CornerDownLeft size={12} />
                                <span>{t('replying_to')} <span className="font-bold text-blue-600">{replyingTo.user.name}</span></span>
                            </div>
                            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-gray-200 rounded-full"><X size={12} /></button>
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
                           placeholder={replyingTo ? t('reply_placeholder') : t('post_placeholder')}
                           className="bg-transparent border-none outline-none w-full text-sm placeholder:text-gray-500 dir-auto text-start h-full"
                           autoFocus={!!replyingTo}
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

      {/* DELETE CONFIRMATION MODAL */}
      {isDeletePostModalOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeletingPost && setIsDeletePostModalOpen(false)} />
            <div className="bg-white rounded-2xl w-full max-w-sm relative z-10 animate-in zoom-in-95 p-6 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={32} className="text-red-500" />
                </div>
                <h3 className="font-bold text-xl mb-2">{t('delete')}؟</h3>
                <p className="text-gray-500 text-sm mb-6">{t('post_delete_confirm')}</p>
                <div className="flex gap-3">
                    <button 
                        onClick={confirmDeletePost} 
                        disabled={isDeletingPost}
                        className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold flex justify-center items-center shadow-lg shadow-red-200"
                    >
                        {isDeletingPost ? <Loader2 className="animate-spin" size={20} /> : t('yes')}
                    </button>
                    <button 
                        onClick={() => setIsDeletePostModalOpen(false)} 
                        disabled={isDeletingPost}
                        className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold"
                    >
                        {t('no')}
                    </button>
                </div>
            </div>
        </div>, document.body
      )}

      {/* COMMENT ACTION SHEET (COPY/DELETE/REPORT) */}
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

      {/* NEW: COMMENT DELETE CONFIRMATION MODAL */}
      {commentToDelete && createPortal(
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => !isDeletingComment && setCommentToDelete(null)} />
            <div className="bg-white rounded-2xl w-full max-w-sm relative z-10 animate-in zoom-in-95 p-6 text-center shadow-2xl">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={32} className="text-red-500" />
                </div>
                <h3 className="font-bold text-xl mb-2">{t('delete')}؟</h3>
                <p className="text-gray-500 text-sm mb-6">{t('post_delete_confirm')}</p>
                <div className="flex gap-3">
                    <button 
                        onClick={confirmDeleteComment} 
                        disabled={isDeletingComment}
                        className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold flex justify-center items-center shadow-lg shadow-red-200"
                    >
                        {isDeletingComment ? <Loader2 className="animate-spin" size={20} /> : t('yes')}
                    </button>
                    <button 
                        onClick={() => setCommentToDelete(null)} 
                        disabled={isDeletingComment}
                        className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200"
                    >
                        {t('no')}
                    </button>
                </div>
            </div>
        </div>, document.body
      )}

      {/* CONTACT MODAL */}
      {isContactOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsContactOpen(false)} />
            <div className="bg-white w-full max-w-md rounded-t-3xl relative z-10 animate-slide-up-fast pb-safe p-6">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />
                <h3 className="font-bold text-xl text-center mb-6">{t('contact_header')}</h3>
                
                <div className="space-y-3">
                    {post.contactMethods?.includes('واتساب') && post.contactPhone && (
                        <a href={`https://wa.me/${post.contactPhone.replace(/\+/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 bg-green-50 rounded-2xl hover:bg-green-100 transition-colors group">
                            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-200 group-hover:scale-110 transition-transform">
                                <MessageCircle size={24} />
                            </div>
                            <div className="text-start">
                                <h4 className="font-bold text-gray-900">{t('contact_method_whatsapp')}</h4>
                                <p className="text-xs text-gray-500 mt-0.5 dir-ltr text-right">{post.contactPhone}</p>
                            </div>
                            <ArrowRight className={`mr-auto text-green-600 ${language === 'ar' ? 'rotate-180' : ''}`} />
                        </a>
                    )}

                    {post.contactMethods?.includes('اتصال') && post.contactPhone && (
                        <a href={`tel:${post.contactPhone}`} className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-colors group">
                            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                                <Phone size={24} />
                            </div>
                            <div className="text-start">
                                <h4 className="font-bold text-gray-900">{t('contact_method_call')}</h4>
                                <p className="text-xs text-gray-500 mt-0.5 dir-ltr text-right">{post.contactPhone}</p>
                            </div>
                            <ArrowRight className={`mr-auto text-blue-600 ${language === 'ar' ? 'rotate-180' : ''}`} />
                        </a>
                    )}

                    {post.contactMethods?.includes('بريد إلكتروني') && post.contactEmail && (
                        <a href={`mailto:${post.contactEmail}`} className="flex items-center gap-4 p-4 bg-orange-50 rounded-2xl hover:bg-orange-100 transition-colors group">
                            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform">
                                <Mail size={24} />
                            </div>
                            <div className="text-start">
                                <h4 className="font-bold text-gray-900">{t('contact_method_email')}</h4>
                                <p className="text-xs text-gray-500 mt-0.5">{post.contactEmail}</p>
                            </div>
                            <ArrowRight className={`mr-auto text-orange-600 ${language === 'ar' ? 'rotate-180' : ''}`} />
                        </a>
                    )}
                </div>
                
                <button onClick={() => setIsContactOpen(false)} className="w-full mt-6 py-4 bg-gray-100 rounded-xl font-bold text-gray-700 hover:bg-gray-200 transition-colors">
                    {t('cancel')}
                </button>
            </div>
        </div>, document.body
      )}

    </div>
  );
};

export default React.memo(PostCard);
