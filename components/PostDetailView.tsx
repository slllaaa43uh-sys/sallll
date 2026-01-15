
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, Send, MoreHorizontal, ThumbsUp, MessageCircle, Share2, Loader2, Heart,
  X, EyeOff, Link as LinkIcon, Flag, Trash2, ArrowRight, ChevronDown, Copy, Reply
} from 'lucide-react';
import Avatar from './Avatar';
import { API_BASE_URL } from '../constants';
import { Post } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface PostDetailViewProps {
  notification: any;
  onBack: () => void;
  onProfileClick?: (userId: string) => void;
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

interface CachedPostData {
    post: Post;
    comments: Comment[];
    isLiked: boolean;
    likesCount: number;
    scrollPosition: number;
}

// --- GLOBAL CACHE ---
const postDetailsCache = new Map<string, CachedPostData>();

// Function to clear cache on logout
export const clearPostDetailsCache = () => {
  postDetailsCache.clear();
};

const PostDetailView: React.FC<PostDetailViewProps> = ({ notification, onBack, onProfileClick }) => {
  const { t, language } = useLanguage();
  const currentUserId = localStorage.getItem('userId');
  const targetId = notification.targetId;
  const containerRef = useRef<HTMLDivElement>(null);

  // Retrieve from cache if exists
  const cachedData = targetId ? postDetailsCache.get(targetId) : undefined;

  const [commentText, setCommentText] = useState('');
  
  // Initialize state from cache if available
  const [post, setPost] = useState<Post | null>(cachedData?.post || null);
  const [comments, setComments] = useState<Comment[]>(cachedData?.comments || []);
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [isLoadingComments, setIsLoadingComments] = useState(!cachedData);
  
  // Post Interaction State
  const [isLiked, setIsLiked] = useState(cachedData?.isLiked || false);
  const [localLikesCount, setLocalLikesCount] = useState(cachedData?.likesCount || 0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Modal State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isDeletePostModalOpen, setIsDeletePostModalOpen] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);

  // REPLIES DRAWER STATE
  const [viewingRepliesFor, setViewingRepliesFor] = useState<Comment | null>(null);
  const [replyingToUser, setReplyingToUser] = useState<{id: string, name: string} | null>(null);
  
  // Comment Actions State
  const [activeCommentAction, setActiveCommentAction] = useState<Comment | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null); // For drawer input
  const isOwner = post && post.user._id === currentUserId;

  // Refs to hold latest state for callbacks, breaking dependency cycles
  const postStateRef = useRef({ post, isLiked, localLikesCount });
  postStateRef.current = { post, isLiked, localLikesCount };

  const updateCache = (newPost: Post | null, newComments: Comment[], newIsLiked: boolean, newLikesCount: number) => {
      if (targetId && newPost) {
          const existing = postDetailsCache.get(targetId);
          postDetailsCache.set(targetId, {
              post: newPost,
              comments: newComments,
              isLiked: newIsLiked,
              likesCount: newLikesCount,
              scrollPosition: existing?.scrollPosition || 0
          });
      }
  };

  useLayoutEffect(() => {
    if (containerRef.current && cachedData?.scrollPosition) {
        containerRef.current.scrollTop = cachedData.scrollPosition;
    }
  }, [isLoading, cachedData]);

  useEffect(() => {
    const container = containerRef.current;
    return () => {
        if (container && targetId && post) {
            const currentCache = postDetailsCache.get(targetId);
            if (currentCache) {
                postDetailsCache.set(targetId, {
                    ...currentCache,
                    scrollPosition: container.scrollTop
                });
            }
        }
    };
  }, [targetId, post]);

  // Clear reply state when drawer closes
  useEffect(() => {
    if (!viewingRepliesFor) {
        setReplyingToUser(null);
        setCommentText('');
    }
  }, [viewingRepliesFor]);

  // Sync viewingRepliesFor with main comments list to ensure updates propagate
  useEffect(() => {
    if (viewingRepliesFor) {
        const updatedParent = comments.find(c => c._id === viewingRepliesFor._id);
        if (updatedParent && updatedParent !== viewingRepliesFor) {
            setViewingRepliesFor(updatedParent);
        }
    }
  }, [comments, viewingRepliesFor]);

  const processApiComment = useCallback((c: any): Comment => {
    if (!c || typeof c !== 'object') return {
        _id: Math.random().toString(),
        text: 'Error loading comment',
        user: { _id: 'unknown', name: 'Unknown' },
        createdAt: new Date().toISOString(),
        likes: 0
    };

    const likesSource = Array.isArray(c.likes) ? c.likes : (Array.isArray(c.reactions) ? c.reactions : []);
    let count = likesSource.length;
    if (count === 0 && typeof c.likes === 'number') {
        count = c.likes;
    }

    // Updated Like Check Logic
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
      replies: c.replies ? c.replies.map((r: any) => processApiComment(r)) : []
    };
  }, [currentUserId]);

  const fetchComments = useCallback(async (idOfPost: string) => {
      // Note: Don't set full loading (setIsLoadingComments) for background refresh to avoid UI jump
      const token = localStorage.getItem('token');
      try {
          const response = await fetch(`${API_BASE_URL}/api/v1/posts/${idOfPost}`, { headers: { 'Authorization': `Bearer ${token}` } });
          
          if (response.ok) {
              const data = await response.json();
              const rawComments = data.post?.comments || [];
              const processedComments = rawComments.map(processApiComment).sort((a: Comment, b: Comment) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              
              setComments(processedComments);
              
              // --- FIX: Check for notification link to reply ---
              if (notification.replyId && notification.commentId) {
                  const parentComment = processedComments.find((c: Comment) => c._id === notification.commentId);
                  if (parentComment) {
                      setViewingRepliesFor(parentComment);
                  }
              }
              // -----------------------------------------------

              if (targetId && postStateRef.current.post) {
                updateCache(postStateRef.current.post, processedComments, postStateRef.current.isLiked, postStateRef.current.localLikesCount);
              }
          }
      } catch (error) {
          console.error("Error loading comments", error);
      } finally {
          setIsLoadingComments(false);
      }
  }, [processApiComment, targetId, notification]);

  useEffect(() => {
    const fetchPostDetails = async () => {
      if (!targetId) {
        setIsLoading(false);
        setIsLoadingComments(false);
        return;
      }
      
      // If we don't have cached data, set loading states.
      if (!cachedData) {
        setIsLoading(true);
        setIsLoadingComments(true);
      }
      
      const token = localStorage.getItem('token');
      try {
        const postRes = await fetch(`${API_BASE_URL}/api/v1/posts/${targetId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        
        if (postRes.ok) {
           const postData = await postRes.json();
           const apiPost = postData.post || postData;

           const postId = apiPost._id || apiPost.id;
           if (!postId) throw new Error("Post ID not found");
           
           const reactions = apiPost.reactions || [];
           const likeCount = reactions.filter((r: any) => !r.type || r.type === 'like').length;
           const userHasLiked = reactions.some((r: any) => String(r.user?._id || r.user) === String(currentUserId));

           const mappedPost: Post = {
              id: postId,
              user: {
                 id: apiPost.user?._id,
                 _id: apiPost.user?._id,
                 name: apiPost.user?.name || 'مستخدم',
                 avatar: apiPost.user?.avatar ? (apiPost.user.avatar.startsWith('http') ? apiPost.user.avatar : `${API_BASE_URL}${apiPost.user.avatar}`) : ''
              },
              timeAgo: new Date(apiPost.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US'),
              content: apiPost.text,
              image: apiPost.media?.[0]?.url ? (apiPost.media[0].url.startsWith('http') ? apiPost.media[0].url : `${API_BASE_URL}${apiPost.media[0].url}`) : undefined,
              likes: likeCount,
              comments: apiPost.comments?.length || 0,
              shares: apiPost.shares?.length || 0,
              location: apiPost.location,
              isFeatured: apiPost.isFeatured
           };
           
           setPost(mappedPost);
           setLocalLikesCount(likeCount);
           setIsLiked(userHasLiked);
           setIsImageLoaded(false);

           // Always fetch comments to check for new replies from notification
           fetchComments(postId);
        }
      } catch (error) {
         console.error("Error loading post details", error);
         setIsLoadingComments(false);
      } finally {
         setIsLoading(false);
      }
    };

    fetchPostDetails();
  }, [targetId, language, fetchComments, currentUserId]); 

  const handleLike = async () => {
    const newLiked = !isLiked;
    const newCount = isLiked ? localLikesCount - 1 : localLikesCount + 1;
    setIsLiked(newLiked);
    setLocalLikesCount(newCount);
    if (post) updateCache(post, comments, newLiked, newCount);

    try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/api/v1/posts/${notification.targetId}/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ reactionType: 'like' })
        });
    } catch (e) { console.error(e); }
  };

  const handleSendComment = async (isReplyDrawer: boolean = false) => {
    if (!commentText.trim() || !post) return;
    
    const token = localStorage.getItem('token');
    const myName = localStorage.getItem('userName') || 'أنا';
    const myAvatar = localStorage.getItem('userAvatar');
    const tempId = `temp-${Date.now()}`;
    
    // Auto-prepend mention if replying to specific user
    const textToSend = replyingToUser && !commentText.includes(`@${replyingToUser.name}`) 
        ? `@${replyingToUser.name} ${commentText}` 
        : commentText;
    
    const parentComment = isReplyDrawer ? viewingRepliesFor : null;
    const parentId = parentComment ? parentComment._id : null;
    const isReply = !!parentId;

    const optimisticComment: Comment = {
        _id: tempId,
        text: textToSend,
        user: { 
            _id: currentUserId || 'me', 
            name: myName, 
            avatar: myAvatar ? (myAvatar.startsWith('http') ? myAvatar : `${API_BASE_URL}${myAvatar}`) : undefined 
        },
        createdAt: new Date().toISOString(),
        likes: 0,
        isLiked: false,
        pending: true,
    };
    
    setCommentText('');
    setReplyingToUser(null);
    
    // Focus back
    if (isReplyDrawer) {
        setTimeout(() => replyInputRef.current?.focus(), 100);
    } else {
        setTimeout(() => commentInputRef.current?.blur(), 100);
    }

    // --- OPTIMISTIC UPDATE ---
    if (isReply && parentId) {
        const addOptimisticReply = (list: Comment[]): Comment[] => {
            return list.map(c => {
                if (c._id === parentId) {
                    return { 
                        ...c, 
                        replies: [...(c.replies || []), optimisticComment], 
                        repliesCount: (c.repliesCount || 0) + 1 
                    };
                }
                return c;
            });
        };
        setComments(prev => addOptimisticReply(prev));
        
        // Update local viewing state as well
        setViewingRepliesFor(prev => {
            if (prev && prev._id === parentId) {
                return {
                    ...prev,
                    replies: [...(prev.replies || []), optimisticComment],
                    repliesCount: (prev.repliesCount || 0) + 1
                };
            }
            return prev;
        });
    } else {
        setComments(prev => [optimisticComment, ...prev]);
    }

    try {
        const endpoint = isReply 
            ? `${API_BASE_URL}/api/v1/posts/${post.id}/comments/${parentId}/replies`
            : `${API_BASE_URL}/api/v1/posts/${post.id}/comments`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text: textToSend })
        });

        if (response.ok) {
            // SUCCESS: Refresh comments list from server
            await fetchComments(post.id);
        } else {
            handleCommentFailure(tempId, parentId);
        }
    } catch (e) {
        handleCommentFailure(tempId, parentId);
    }
  };

  const handleCommentFailure = (tempId: string, parentId: string | null) => {
      setComments(currentComments => {
          if (parentId) {
              return currentComments.map(c => {
                  if (c._id === parentId) {
                      return {
                          ...c,
                          replies: c.replies?.filter(r => r._id !== tempId),
                          repliesCount: Math.max(0, (c.repliesCount || 1) - 1)
                      };
                  }
                  return c;
              });
          } else {
              return currentComments.filter(c => c._id !== tempId);
          }
      });
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
            likes: Math.max(0, c.likes + (!c.isLiked ? 1 : -1))
        };
    };

    setComments(prevComments => prevComments.map(c => {
        if (c._id === commentId && !targetParentId) return toggleLikeInComment(c);
        if (targetParentId && c._id === targetParentId) {
             const updatedReplies = c.replies?.map(r => r._id === commentId ? toggleLikeInComment(r) : r);
             return { ...c, replies: updatedReplies };
        }
        return c;
    }));

    try {
        const token = localStorage.getItem('token');
        const endpoint = targetParentId 
            ? `${API_BASE_URL}/api/v1/posts/${post?.id}/comments/${targetParentId}/replies/${commentId}/like`
            : `${API_BASE_URL}/api/v1/posts/${post?.id}/comments/${commentId}/like`;

        await fetch(endpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            keepalive: true
        });
    } catch (error) { console.error("Failed to like comment", error); }
  };
  
  const handleTouchStart = (comment: Comment) => { longPressTimerRef.current = setTimeout(() => setActiveCommentAction(comment), 600); };
  const handleTouchEnd = () => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } };
  const handleTouchMove = () => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } };
  
  const handleCopyComment = () => { if (activeCommentAction) { navigator.clipboard.writeText(activeCommentAction.text); setActiveCommentAction(null); }};
  const handleReportComment = () => { alert(t('post_report_success')); setActiveCommentAction(null); };
  const handleDeleteComment = () => { if (activeCommentAction) { setCommentToDelete(activeCommentAction); setActiveCommentAction(null); }};
  
  const confirmDeleteComment = async () => {
    if (!commentToDelete || !post) return;
    const idToDelete = commentToDelete._id;
    
    const findParent = (list: Comment[], childId: string): Comment | null => {
        for (const c of list) {
            if (c.replies?.some(r => r._id === childId)) return c;
        }
        return null;
    };
    const parentComment = findParent(comments, idToDelete);

    if (parentComment) {
        setComments(prev => prev.map(c => c._id === parentComment._id ? {
            ...c,
            replies: c.replies?.filter(r => r._id !== idToDelete),
            repliesCount: Math.max(0, (c.repliesCount || 1) - 1)
        } : c));
    } else {
        setComments(prev => prev.filter(c => c._id !== idToDelete));
        if (viewingRepliesFor && viewingRepliesFor._id === idToDelete) setViewingRepliesFor(null);
    }

    setCommentToDelete(null); 

    try {
        const token = localStorage.getItem('token');
        const endpoint = parentComment
          ? `${API_BASE_URL}/api/v1/posts/${post.id}/comments/${parentComment._id}/replies/${idToDelete}`
          : `${API_BASE_URL}/api/v1/posts/${post.id}/comments/${idToDelete}`;
        await fetch(endpoint, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (error) { console.error(error); }
  };

  const handleNativeShare = async () => {
    if (!post) return;
    try {
        await navigator.share({ 
            title: `منشور بواسطة ${post.user.name}`, 
            text: post.content.substring(0, 100) + '...', 
            url: `${API_BASE_URL}/share/post/${post.id}` // Updated to backend sharing route
        });
        setIsShareOpen(false);
    } catch (err) {}
  };

  const handleDeletePost = () => { setIsMenuOpen(false); setIsDeletePostModalOpen(true); };
  const confirmDeletePost = async () => {
    if (!post) return;
    setIsDeletingPost(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/v1/posts/${post.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (response.ok) {
            if (targetId) postDetailsCache.delete(targetId);
            onBack();
        }
        else alert(t('delete') + " failed");
    } catch (e) {
        alert("Error deleting post");
    } finally {
        setIsDeletingPost(false);
        setIsDeletePostModalOpen(false);
    }
  };

  const isCommentOwner = activeCommentAction && activeCommentAction.user._id === currentUserId;

  const handleReplyClick = (e: React.MouseEvent, user: { id: string, name: string }) => {
      e.stopPropagation();
      setReplyingToUser(user);
      setTimeout(() => replyInputRef.current?.focus(), 100);
  };

  const renderReplyItem = (reply: Comment) => (
      <div 
        key={reply._id} 
        className={`flex gap-3 relative transition-opacity duration-300 ${reply.pending ? 'opacity-50' : 'opacity-100'} mb-4`}
        onTouchStart={() => handleTouchStart(reply)} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove} onMouseDown={() => handleTouchStart(reply)} onMouseUp={handleTouchEnd} onMouseLeave={handleTouchEnd}
      >
         <div className="absolute top-[-10px] bottom-0 right-[19px] w-[2px] bg-gray-200 -z-10" />
         <div className="flex-shrink-0 mt-0.5 relative z-10" onClick={(e) => { e.stopPropagation(); onProfileClick?.(reply.user._id); }}>
            <Avatar name={reply.user.name} src={reply.user.avatar} className="w-8 h-8 ring-2 ring-white" textClassName="text-xs" />
         </div>
         <div className="flex-1 min-w-0">
            <div className="bg-gray-50 p-3 rounded-2xl rounded-tr-none w-fit max-w-full">
                <h4 className="text-xs font-bold text-gray-900 mb-1 flex items-center gap-2">{reply.user.name}</h4>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed select-text">{reply.text}</p>
            </div>
            <div className="flex items-center gap-4 mt-1 px-2">
                <span className="text-[10px] text-gray-400">{reply.pending ? t('sending') : new Date(reply.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                <button onClick={(e) => handleReplyClick(e, {id: reply.user._id, name: reply.user.name})} className="text-[11px] font-bold text-gray-500 hover:text-gray-800">{t('reply')}</button>
            </div>
         </div>
         <div className="flex flex-col items-center gap-1 pt-1 w-6">
            <button 
                onClick={(e) => { e.stopPropagation(); handleCommentLike(reply._id, viewingRepliesFor?._id); }}
                onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
                className="p-1 active:scale-90 transition-transform"
            >
                <Heart size={14} className={reply.isLiked ? "text-red-500 fill-red-500" : "text-gray-400"} />
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); setActiveCommentAction(reply); }}
                onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
                className="p-1 text-gray-400 hover:text-gray-600"
            >
                <MoreHorizontal size={14} />
            </button>
         </div>
      </div>
  );

  const renderCommentItem = (comment: Comment) => {
    return (
      <div 
        key={comment._id} 
        className={`flex gap-3 transition-opacity duration-300 ${comment.pending ? 'opacity-50' : 'opacity-100'} mb-4`}
        onTouchStart={() => handleTouchStart(comment)} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove} onMouseDown={() => handleTouchStart(comment)} onMouseUp={handleTouchEnd} onMouseLeave={handleTouchEnd}
      >
         <div className="flex-shrink-0 mt-0.5 cursor-pointer relative flex flex-col items-center" onClick={(e) => { e.stopPropagation(); onProfileClick?.(comment.user._id); }}>
            <Avatar name={comment.user.name} src={comment.user.avatar} className="w-9 h-9 relative z-10" textClassName="text-sm" />
            {(comment.repliesCount || 0) > 0 && <div className="w-[2px] h-full bg-gray-200 mt-[-10px] mb-[-20px] z-0"></div>}
         </div>
         <div className="flex-1 min-w-0">
            <div className="bg-gray-100 p-3 rounded-2xl rounded-tr-none inline-block max-w-full">
                <h4 className="text-xs font-bold text-gray-900 mb-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); onProfileClick?.(comment.user._id); }}>{comment.user.name}</h4>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed select-text">{comment.text}</p>
            </div>
            <div className="flex items-center gap-4 mt-1.5 px-2">
                <span className="text-[10px] text-gray-400 font-medium">{comment.pending ? t('sending') : new Date(comment.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                <button onClick={(e) => { e.stopPropagation(); setViewingRepliesFor(comment); }} className="text-[11px] font-bold text-gray-500 hover:text-gray-800">{t('reply')}</button>
            </div>
            {(comment.repliesCount || 0) > 0 && (
              <div className="flex items-center gap-2 mt-2">
                  <div className="w-6 h-4 border-b-2 border-r-2 border-gray-200 rounded-br-xl rtl:border-l-2 rtl:border-r-0 rtl:rounded-bl-xl rtl:rounded-br-none"></div>
                  <button onClick={(e) => { e.stopPropagation(); setViewingRepliesFor(comment); }} className="text-gray-500 font-bold text-xs flex items-center gap-1 hover:bg-gray-50 px-2 py-1 rounded-full transition-colors">
                    <span>{t('view_replies')} ({comment.repliesCount})</span>
                  </button>
              </div>
            )}
         </div>
         <div className="flex flex-col items-center gap-2 pt-2 w-8">
            <button onClick={(e) => { e.stopPropagation(); handleCommentLike(comment._id); }} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} className="p-1 active:scale-90 transition-transform">
                <Heart size={16} className={comment.isLiked ? "text-red-500 fill-red-500" : "text-gray-400"} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setActiveCommentAction(comment); }} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} className="p-1 text-gray-400 hover:text-gray-600">
                <MoreHorizontal size={16} />
            </button>
         </div>
      </div>
    );
  };

  const contentReady = !!post;

  return (
    // Update z-index to 200 so it sits above the NotificationsView
    <div className="fixed inset-0 z-[200] bg-white flex flex-col w-full h-full overflow-x-hidden animate-in slide-in-from-bottom duration-300">
      
      {/* REPLIES DRAWER */}
      <div className={`fixed inset-y-0 right-0 w-full md:w-[480px] bg-white z-[210] transform transition-transform duration-300 ease-in-out flex flex-col ${viewingRepliesFor ? 'translate-x-0 shadow-2xl' : (language === 'ar' ? '-translate-x-full' : 'translate-x-full')}`}>
         <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10 pt-safe shadow-sm">
            <button onClick={() => setViewingRepliesFor(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><ArrowRight size={20} className={language === 'en' ? 'rotate-180' : ''} /></button>
            <h3 className="font-bold text-gray-800 text-sm">{t('reply')} {viewingRepliesFor ? `إلى ${viewingRepliesFor.user.name}` : ''}</h3>
         </div>
         
         <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-24 bg-white relative">
            {viewingRepliesFor && (
                <>
                    <div className="mb-4 relative">
                        <div className="absolute top-10 bottom-[-20px] right-[19px] w-[2px] bg-gray-200 z-0" />
                        <div className="flex gap-3 relative z-10">
                            <div onClick={(e) => { e.stopPropagation(); onProfileClick?.(viewingRepliesFor.user._id); }}>
                                <Avatar name={viewingRepliesFor.user.name} src={viewingRepliesFor.user.avatar} className="w-10 h-10 ring-4 ring-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="bg-gray-100 p-3 rounded-2xl rounded-tr-none w-fit max-w-full">
                                    <h4 className="font-bold text-sm text-gray-900 mb-1" onClick={(e) => { e.stopPropagation(); onProfileClick?.(viewingRepliesFor.user._id); }}>{viewingRepliesFor.user.name}</h4>
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed select-text">{viewingRepliesFor.text}</p>
                                </div>
                                <div className="text-xs text-gray-400 mt-1 px-2">{new Date(viewingRepliesFor.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}</div>
                            </div>
                            <div className="flex flex-col items-center gap-2 pt-1 w-8">
                                <button onClick={(e) => { e.stopPropagation(); handleCommentLike(viewingRepliesFor._id); }} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} className="p-1 active:scale-90 transition-transform">
                                    <Heart size={16} className={viewingRepliesFor.isLiked ? "text-red-500 fill-red-500" : "text-gray-400"} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setReplyingToUser({id: viewingRepliesFor.user._id, name: viewingRepliesFor.user.name}); replyInputRef.current?.focus(); }} className="p-1 text-gray-400 hover:text-blue-600 active:scale-90 transition-transform"><Reply size={16} /></button>
                                <button onClick={(e) => { e.stopPropagation(); setActiveCommentAction(viewingRepliesFor); }} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} className="p-1 text-gray-400 hover:text-gray-600 active:scale-90 transition-transform"><MoreHorizontal size={16} /></button>
                            </div>
                        </div>
                    </div>
                    <div className="pr-1 space-y-0">
                        {viewingRepliesFor.replies && viewingRepliesFor.replies.length > 0 ? viewingRepliesFor.replies.map((reply) => renderReplyItem(reply)) : <div className="text-center text-gray-400 py-4 text-xs italic">{t('no_replies')}</div>}
                    </div>
                </>
            )}
         </div>
         
         <div className="bg-white p-3 pb-safe border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            {replyingToUser && (
                <div className="flex items-center justify-between px-2 mb-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                    <span>{t('replying_to')} <span className="font-bold text-blue-600">{replyingToUser.name}</span></span>
                    <button onClick={() => setReplyingToUser(null)} className="p-1 hover:bg-gray-200 rounded-full"><X size={12} /></button>
                </div>
            )}
            <div className="flex items-end gap-2">
               <div className="flex-1 bg-gray-100 rounded-2xl flex items-center px-4 py-2">
                  <textarea ref={replyInputRef} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder={t('reply_placeholder')} className="bg-transparent border-none outline-none w-full text-sm placeholder:text-gray-500 !resize-none max-h-20 py-1" rows={1} />
               </div>
               <button onClick={() => handleSendComment(true)} disabled={!commentText.trim()} className={`p-3 rounded-full transition-colors mb-0.5 ${!commentText.trim() ? 'text-gray-300 bg-gray-50' : 'text-white bg-blue-600 shadow-md hover:bg-blue-700'}`}>
                  <Send size={18} style={{ transform: language === 'en' ? 'scaleX(-1)' : 'none' }} />
               </button>
            </div>
         </div>
      </div>

      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10 pt-safe shadow-sm w-full">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"><ArrowLeft className={language === 'ar' ? 'rotate-180' : ''} size={24} /></button>
        <h2 className="text-lg font-bold text-gray-800">{t('post_details_title')}</h2>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto no-scrollbar pb-24 w-full">
        {!contentReady && isLoading ? (
             <div className="flex items-center justify-center pt-32"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
        ) : !post ? (
             <div className="flex flex-col items-center justify-center pt-32 gap-4"><p className="text-gray-500">Post not found</p><button onClick={onBack} className="text-blue-600 font-bold">Back</button></div>
        ) : (
          <>
            <div className="bg-white mb-0 py-4 w-full">
              <div className="px-4 flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={post.user.name} src={post.user.avatar} className="w-10 h-10" />
                    <div><h3 className="font-bold text-gray-900 text-sm">{post.user.name}</h3><span className="text-xs text-gray-500">{post.timeAgo} • {post.location || 'عام'}</span></div>
                  </div>
                  <button onClick={() => setIsMenuOpen(true)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><MoreHorizontal size={20} /></button>
              </div>
              <div className="px-4 mb-3"><p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p></div>
              {post.image && (
                <div className="relative w-full aspect-[4/3] bg-gray-100 mb-3">
                  {!isImageLoaded && <div className="absolute inset-0 bg-gray-200 animate-pulse"></div>}
                  <img src={post.image} alt="Post" className={`w-full h-full object-cover transition-opacity duration-300 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setIsImageLoaded(true)} />
                </div>
              )}
              <div className="px-4 flex justify-between items-center pb-2 border-b border-gray-100 text-xs text-gray-500 mb-2">
                  <div className="flex items-center gap-1"><div className="bg-blue-500 p-0.5 rounded-full"><ThumbsUp size={10} className="text-white fill-white" /></div><span>{localLikesCount}</span></div>
                  <div>{comments.length} تعليق</div>
              </div>
              <div className="px-4 flex justify-between items-center">
                  <button onClick={handleLike} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${isLiked ? 'text-blue-600' : 'text-gray-600'}`}><ThumbsUp size={18} className={isLiked ? "fill-current" : ""} /><span className="text-sm font-bold">{t('like')}</span></button>
                  <button onClick={() => commentInputRef.current?.focus()} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-gray-600"><MessageCircle size={18} /><span className="text-sm font-bold">{t('comment')}</span></button>
                  <button onClick={() => setIsShareOpen(true)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-gray-600"><Share2 size={18} /><span className="text-sm font-bold">{t('share')}</span></button>
              </div>
            </div>
            <div className="bg-white p-4 min-h-[200px] space-y-2 w-full">
              <h4 className="font-bold text-gray-800 text-sm mb-4">{t('comment')} ({comments.length})</h4>
              {isLoadingComments && comments.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="animate-spin text-blue-600" size={30} />
                </div>
              ) : comments.length > 0 ? (
                comments.map((comment) => renderCommentItem(comment))
              ) : (
                <div className="text-center text-gray-400 py-10">
                  <MessageCircle size={32} className="mx-auto mb-2 text-gray-300" />
                  <p>{t('no_comments')}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {contentReady && !viewingRepliesFor && (
        <div className="fixed bottom-0 left-0 right-0 bg-white p-3 pb-safe z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] w-full">
            <div className="flex items-end gap-2">
                <Avatar name={localStorage.getItem('userName') || 'أ'} src={localStorage.getItem('userAvatar')} className="w-8 h-8 self-center" />
                <div className="flex-1 bg-gray-100 rounded-2xl flex items-center px-4 py-2 relative">
                    <textarea ref={commentInputRef} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder={t('post_placeholder')} className="bg-transparent border-none outline-none w-full text-sm placeholder:text-gray-500 !resize-none max-h-20 py-1" rows={1} />
                </div>
                <button onClick={() => handleSendComment(false)} disabled={!commentText.trim()} className={`p-3 rounded-full transition-colors mb-0.5 ${!commentText.trim() ? 'text-gray-300 bg-gray-50' : 'text-white bg-blue-600 shadow-md hover:bg-blue-700'}`}>
                <Send size={18} style={{ transform: language === 'en' ? 'scaleX(-1)' : 'none' }} />
                </button>
            </div>
        </div>
      )}

      {isShareOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center" onClick={() => setIsShareOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="bg-white w-full max-w-md rounded-t-2xl relative z-10 animate-slide-in-from-bottom duration-300 pb-safe" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1" onClick={() => setIsShareOpen(false)}><div className="w-12 h-1.5 bg-gray-300 rounded-full"></div></div>
            <div className="p-5">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-gray-800 font-bold text-center flex-1">{t('share')}</h3>
                <button onClick={() => setIsShareOpen(false)} className="bg-gray-100 p-1 rounded-full hover:bg-gray-200"><X size={20} className="text-gray-600" /></button>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                 <button onClick={handleNativeShare} className="flex flex-col items-center gap-2 group">
                    <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors"><Share2 size={24} className="text-blue-600" /></div>
                    <span className="text-xs text-gray-600 font-medium">{t('share')}</span>
                 </button>
                 <button className="flex flex-col items-center gap-2 group" onClick={() => { navigator.clipboard.writeText(`${API_BASE_URL}/share/post/${post?.id}`); setIsShareOpen(false); alert(t('copy_link') + " (تم النسخ)"); }}>
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition-colors"><LinkIcon size={24} className="text-gray-600" /></div>
                    <span className="text-xs text-gray-600 font-medium">{t('copy_link')}</span>
                 </button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {isMenuOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center" onClick={() => setIsMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="bg-white w-full max-w-md rounded-t-2xl pb-safe relative z-10 animate-slide-in-fast" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto my-3" />
            <div className="px-4 pb-6 flex flex-col gap-2">
                <button onClick={() => { onBack(); setIsMenuOpen(false); }} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl"><EyeOff size={22} className="text-gray-700" /><span className="font-bold text-gray-800 text-sm">{t('post_hide')}</span></button>
                {isOwner ? (
                  <button onClick={handleDeletePost} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl"><Trash2 size={22} className="text-red-600" /><span className="font-bold text-red-600 text-sm">{t('delete')}</span></button>
                ) : (
                  <button onClick={() => { alert(t('post_report_success')); setIsMenuOpen(false); }} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl"><Flag size={22} className="text-red-600" /><span className="font-bold text-red-600 text-sm">{t('report')}</span></button>
                )}
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
                    <button onClick={handleCopyComment} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl w-full"><Copy size={20} className="text-blue-600" /><span className="font-bold text-gray-700">{t('copy_text')}</span></button>
                    {isCommentOwner ? (
                        <button onClick={handleDeleteComment} className="flex items-center gap-4 p-3 hover:bg-red-50 rounded-xl w-full"><Trash2 size={20} className="text-red-600" /><span className="font-bold text-red-600">{t('delete')}</span></button>
                    ) : (
                        <button onClick={handleReportComment} className="flex items-center gap-4 p-3 hover:bg-red-50 rounded-xl w-full"><Flag size={20} className="text-red-600" /><span className="font-bold text-red-600">{t('report')}</span></button>
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
                   <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-1 shadow-inner"><Trash2 size={36} className="text-red-500" strokeWidth={2.5} /></div>
                   <div><h3 className="text-2xl font-black text-gray-900 mb-2">{t('delete')}?</h3><p className="text-gray-500 text-base leading-relaxed font-medium px-4">{t('post_delete_confirm')}</p></div>
                   <div className="flex gap-3 w-full mt-4">
                      <button onClick={confirmDeleteComment} className="flex-1 bg-red-600 text-white py-3.5 rounded-2xl font-bold text-base hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-200">{t('yes')}</button>
                      <button onClick={() => setCommentToDelete(null)} className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold text-base hover:bg-gray-200 active:scale-95 transition-all">{t('no')}</button>
                   </div>
                </div>
             </div>
           </div>, document.body
      )}

    </div>
  );
};

export default PostDetailView;
