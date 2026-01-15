
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, Heart, MoreHorizontal, Play, X, ArrowRight, Send, Loader2, Flag, Copy, Trash2
} from 'lucide-react';
import Avatar from './Avatar';
import { API_BASE_URL } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

interface VideoDetailViewProps {
  notification: any;
  onBack: () => void;
  onProfileClick?: (userId: string) => void;
  onReport?: (type: 'post' | 'comment' | 'reply' | 'video', id: string, name: string) => void;
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

const VideoDetailView: React.FC<VideoDetailViewProps> = ({ notification, onBack, onProfileClick, onReport }) => {
  const { language, t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentUserId = localStorage.getItem('userId');
  
  const [videoData, setVideoData] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  
  // Always keep comments open in this view
  const [isCommentsOpen, setIsCommentsOpen] = useState(true); 

  const [viewingRepliesFor, setViewingRepliesFor] = useState<Comment | null>(null);
  const [commentText, setCommentText] = useState('');
  
  // Reply & Action States
  const [replyingToUser, setReplyingToUser] = useState<{id: string, name: string} | null>(null);
  const [activeCommentAction, setActiveCommentAction] = useState<Comment | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const isAr = language === 'ar';

  const processApiComment = useCallback((c: any): Comment => {
    const realId = c._id || c.id;
    const likesSource = Array.isArray(c.likes) ? c.likes : (Array.isArray(c.reactions) ? c.reactions : []);
    const isLiked = likesSource.some((item: any) => {
        const itemId = typeof item === 'string' ? item : (item._id || item.id || item.user?._id || item.user);
        return String(itemId) === String(currentUserId);
    }) || !!c.isLiked;

    return {
      _id: realId,
      text: c.text,
      user: {
        _id: c.user?._id || c.user?.id || 'unknown',
        name: c.user?.name || 'User',
        avatar: c.user?.avatar
      },
      createdAt: c.createdAt,
      likes: typeof c.likes === 'number' ? c.likes : likesSource.length,
      isLiked: isLiked,
      repliesCount: c.repliesCount || (c.replies ? c.replies.length : 0),
      replies: c.replies ? c.replies.map((r: any) => processApiComment(r)) : []
    };
  }, [currentUserId]);

  const fetchComments = useCallback(async (postId: string) => {
    setIsLoadingComments(true);
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            const rawComments = data.post?.comments || [];
            const processed = rawComments.map(processApiComment);
            processed.sort((a: Comment, b: Comment) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setComments(processed);

            if (notification.commentId) {
                setTimeout(() => {
                    const targetComment = processed.find(c => c._id === notification.commentId);
                    if (targetComment) {
                        if (notification.replyId) {
                            setViewingRepliesFor(targetComment);
                        }
                    } else {
                        const parent = processed.find(c => c.replies?.some(r => r._id === notification.commentId));
                        if (parent) {
                            setViewingRepliesFor(parent);
                        }
                    }
                }, 300);
            }
        }
    } catch (e) { console.error(e); }
    finally { setIsLoadingComments(false); }
  }, [processApiComment, notification]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      try {
          const response = await fetch(`${API_BASE_URL}/api/v1/posts/${notification.targetId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
              const data = await response.json();
              const post = data.post || data;
              setVideoData(post);
              fetchComments(post._id || post.id);
              setIsCommentsOpen(true);
          }
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    };
    fetchData();
  }, [notification.targetId, notification.notificationType, notification.replyId, fetchComments]);

  const togglePlay = () => {
    if (videoRef.current) {
        if (isPlaying) videoRef.current.pause();
        else videoRef.current.play();
        setIsPlaying(!isPlaying);
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !videoData) return;
    const token = localStorage.getItem('token');
    
    // Logic matches Home Feed exactly
    const parentId = viewingRepliesFor?._id;
    const isReply = !!parentId;

    const textToSend = replyingToUser 
        ? `@${replyingToUser.name} ${commentText}`
        : commentText;

    const tempId = `temp-${Date.now()}`;
    const newComment: Comment = {
        _id: tempId,
        text: textToSend,
        user: {
            _id: currentUserId || 'me',
            name: localStorage.getItem('userName') || 'Me',
            avatar: localStorage.getItem('userAvatar') || undefined
        },
        createdAt: new Date().toISOString(),
        likes: 0,
        isLiked: false,
        pending: true
    };

    if (isReply && viewingRepliesFor) {
        setViewingRepliesFor(prev => prev ? {
            ...prev,
            replies: [...(prev.replies || []), newComment],
            repliesCount: (prev.repliesCount || 0) + 1
        } : null);
        setComments(prev => prev.map(c => c._id === viewingRepliesFor._id ? {
            ...c,
            replies: [...(c.replies || []), newComment],
            repliesCount: (c.repliesCount || 0) + 1
        } : c));
    } else {
        setComments(prev => [newComment, ...prev]);
    }

    setCommentText('');
    setReplyingToUser(null);

    try {
        const endpoint = isReply 
            ? `${API_BASE_URL}/api/v1/posts/${videoData._id || videoData.id}/comments/${parentId}/replies`
            : `${API_BASE_URL}/api/v1/posts/${videoData._id || videoData.id}/comments`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text: textToSend })
        });

        if (response.ok) {
            fetchComments(videoData._id || videoData.id);
        }
    } catch (e) { console.error(e); }
  };

  const handleCommentLike = async (commentId: string, parentId?: string) => {
    let targetParentId = parentId;
    if (!targetParentId) {
        const parent = comments.find(c => c.replies?.some(r => r._id === commentId));
        if (parent) targetParentId = parent._id;
    }

    const toggleLike = (c: Comment) => ({
        ...c,
        isLiked: !c.isLiked,
        likes: Math.max(0, c.likes + (c.isLiked ? -1 : 1))
    });

    setComments(prev => prev.map(c => {
        if (c._id === commentId && !targetParentId) return toggleLike(c);
        if (targetParentId && c._id === targetParentId) {
            return {
                ...c,
                replies: c.replies?.map(r => r._id === commentId ? toggleLike(r) : r)
            };
        }
        return c;
    }));

    if (viewingRepliesFor) {
        if (viewingRepliesFor._id === commentId && !targetParentId) setViewingRepliesFor(toggleLike(viewingRepliesFor));
        else if (targetParentId && viewingRepliesFor._id === targetParentId) {
            setViewingRepliesFor(prev => prev ? {
                ...prev,
                replies: prev.replies?.map(r => r._id === commentId ? toggleLike(r) : r)
            } : null);
        }
    }

    try {
        const token = localStorage.getItem('token');
        const endpoint = targetParentId 
            ? `${API_BASE_URL}/api/v1/posts/${videoData._id || videoData.id}/comments/${targetParentId}/replies/${commentId}/like`
            : `${API_BASE_URL}/api/v1/posts/${videoData._id || videoData.id}/comments/${commentId}/like`;

        await fetch(endpoint, {
            method: 'POST', // CHANGED TO POST
            headers: { 'Authorization': `Bearer ${token}` },
            keepalive: true
        });
    } catch (error) { console.error("Failed to like comment", error); }
  };

  const handleReplyClick = (e: React.MouseEvent, user: { id: string, name: string }) => {
      e.stopPropagation();
      setReplyingToUser(user);
      setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleCopyComment = () => {
      if (activeCommentAction) {
          navigator.clipboard.writeText(activeCommentAction.text);
          setActiveCommentAction(null);
      }
  };

  const handleDeleteComment = async () => {
      if (!activeCommentAction || !videoData) return;
      const commentId = activeCommentAction._id;
      let parentId = undefined;
      const parent = comments.find(c => c.replies?.some(r => r._id === commentId));
      if (parent) parentId = parent._id;

      if (parentId) {
          setComments(prev => prev.map(c => c._id === parentId ? {
              ...c,
              replies: c.replies?.filter(r => r._id !== commentId),
              repliesCount: Math.max(0, (c.repliesCount || 1) - 1)
          } : c));
          if (viewingRepliesFor && viewingRepliesFor._id === parentId) {
              setViewingRepliesFor(prev => prev ? {
                  ...prev,
                  replies: prev.replies?.filter(r => r._id !== commentId),
                  repliesCount: Math.max(0, (prev.repliesCount || 1) - 1)
              } : null);
          }
      } else {
          setComments(prev => prev.filter(c => c._id !== commentId));
      }
      
      setActiveCommentAction(null);

      try {
          const token = localStorage.getItem('token');
          const endpoint = parentId
            ? `${API_BASE_URL}/api/v1/posts/${videoData.id}/comments/${parentId}/replies/${commentId}`
            : `${API_BASE_URL}/api/v1/posts/${videoData.id}/comments/${commentId}`;
          await fetch(endpoint, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      } catch (e) {
          fetchComments(videoData.id); 
      }
  };

  const renderCommentItem = (comment: Comment, isReplyView?: boolean) => {
    return (
      <div 
        key={comment._id} 
        className={`flex gap-3 p-2 rounded-xl transition-all duration-1000 bg-transparent mb-2`}
      >
         <div className="flex-shrink-0 cursor-pointer" onClick={() => onProfileClick?.(comment.user._id)}>
            <Avatar name={comment.user.name} src={comment.user.avatar} className="w-9 h-9" />
         </div>
         <div className="flex-1 min-w-0">
            <div className="bg-gray-100 p-2.5 rounded-2xl rounded-tr-none inline-block max-w-full">
                <h4 className="text-xs font-bold text-gray-900 mb-1">{comment.user.name}</h4>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{comment.text}</p>
            </div>
            <div className="flex items-center gap-4 mt-1 px-2">
                <span className="text-[10px] text-gray-400">{new Date(comment.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isReplyView) {
                            handleReplyClick(e, {id: comment.user._id, name: comment.user.name});
                        } else {
                            setViewingRepliesFor(comment);
                        }
                    }} 
                    className="text-[11px] font-bold text-gray-500 hover:text-gray-800"
                >
                    {t('reply')}
                </button>
            </div>
            {!isReplyView && (comment.repliesCount || 0) > 0 && (
                <button onClick={() => setViewingRepliesFor(comment)} className="text-blue-600 font-bold text-[10px] mt-2 block">
                    {t('view_replies')} ({comment.repliesCount})
                </button>
            )}
         </div>
         <div className="flex flex-col items-center gap-2 pt-2">
            <button 
                onClick={(e) => { e.stopPropagation(); handleCommentLike(comment._id, isReplyView ? viewingRepliesFor?._id : undefined); }}
                className="p-1 active:scale-90 transition-transform"
            >
                <Heart size={14} className={comment.isLiked ? "text-red-500 fill-red-500" : "text-gray-400"} />
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); setActiveCommentAction(comment); }}
                className="p-1 text-gray-400 hover:text-gray-600 active:scale-90 transition-transform"
            >
                <MoreHorizontal size={14} />
            </button>
         </div>
      </div>
    );
  };

  if (isLoading) {
      return (
          <div className="fixed inset-0 z-[150] bg-black flex items-center justify-center">
              <Loader2 className="animate-spin text-white" size={40} />
          </div>
      );
  }

  const videoUrl = videoData?.media?.find((m: any) => m.type === 'video')?.url || videoData?.media?.[0]?.url;
  const finalVideoUrl = videoUrl ? (videoUrl.startsWith('http') ? videoUrl : `${API_BASE_URL}${videoUrl}`) : null;
  const isCommentOwner = activeCommentAction && (activeCommentAction.user._id === currentUserId || activeCommentAction.user._id === 'me');

  return (
    <div className="fixed inset-0 z-[150] bg-black text-white flex flex-col animate-in zoom-in-95 duration-300">
      
      <div className="absolute top-0 left-0 right-0 z-20 p-4 pt-safe flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
         <button onClick={onBack} className="p-2 bg-white/20 rounded-full backdrop-blur-md hover:bg-white/30 transition-colors">
            <ArrowLeft className={isAr ? "" : "rotate-180"} size={24} />
         </button>
         <h3 className="font-bold text-sm shadow-black drop-shadow-md">{isAr ? "مشاهدة الفيديو" : "Watch Video"}</h3>
         <div className="w-8"></div>
      </div>

      <div className="flex-1 relative bg-gray-900" onClick={togglePlay}>
         {finalVideoUrl && (
            <video 
              ref={videoRef}
              src={finalVideoUrl} 
              loop 
              playsInline
              autoPlay
              className="w-full h-full object-contain"
            />
         )}
         {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
               <Play size={64} className="text-white/80 fill-white/80" />
            </div>
         )}
      </div>

      {isCommentsOpen && createPortal(
         <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center pointer-events-none">
            
            <div className="bg-white w-full max-w-md h-[70vh] rounded-t-2xl sm:rounded-2xl relative z-10 animate-slide-up-fast shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
               <div className="flex-1 relative overflow-hidden">
                  <div className={`absolute inset-0 flex flex-col bg-white transition-transform duration-300 ease-in-out ${viewingRepliesFor ? '-translate-x-full' : 'translate-x-0'}`}>
                      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white z-20">
                          <div className="w-8"></div>
                          <h3 className="font-bold text-gray-800 text-sm">{t('comment')}</h3>
                          <div className="w-8"></div>
                      </div>
                      <div className="flex-1 overflow-y-auto no-scrollbar p-4">
                         {isLoadingComments ? (
                             <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" /></div>
                         ) : comments.length > 0 ? (
                             comments.map(c => renderCommentItem(c))
                         ) : (
                             <div className="text-center text-gray-400 mt-10">{t('no_comments')}</div>
                         )}
                      </div>
                  </div>

                  <div className={`absolute inset-0 flex flex-col bg-white transition-transform duration-300 ease-in-out ${viewingRepliesFor ? 'translate-x-0' : 'translate-x-full'} z-30`}>
                     {viewingRepliesFor && (
                        <>
                           <div className="bg-white p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
                              <button onClick={() => setViewingRepliesFor(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <ArrowRight size={20} className={`text-gray-700 ${!isAr ? 'rotate-180' : ''}`} />
                              </button>
                              <h3 className="font-bold text-gray-800 text-sm">{t('view_replies')}</h3>
                              <div className="w-9"></div>
                           </div>
                           <div className="flex-1 overflow-y-auto no-scrollbar p-4 bg-gray-50/50">
                              {renderCommentItem(viewingRepliesFor, true)}
                              <div className="pr-2 mr-1 space-y-2 border-r border-gray-200">
                                 {viewingRepliesFor.replies?.map((reply) => renderCommentItem(reply, true))}
                              </div>
                           </div>
                        </>
                     )}
                  </div>
               </div>

               {/* EXACT MATCH OF SHORTS VIEW / MAIN PAGE COMMENT INPUT CONTAINER */}
               <div className="p-3 border-t border-gray-100 bg-white pb-safe z-40 relative">
                  {replyingToUser && (
                        <div className="flex items-center justify-between px-2 mb-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                            <span>{t('replying_to')} <span className="font-bold text-blue-600">{replyingToUser.name}</span></span>
                            <button onClick={() => setReplyingToUser(null)} className="p-1 hover:bg-gray-200 rounded-full"><X size={12} /></button>
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
                     <button onClick={handleSendComment} disabled={!commentText.trim()} className={`h-10 w-10 flex items-center justify-center rounded-full transition-colors ${!commentText.trim() ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50 bg-transparent'}`}>
                        <Send size={20} style={{ transform: language === 'en' ? 'scaleX(-1)' : 'none' }} />
                     </button>
                  </div>
               </div>
            </div>
         </div>, 
         document.body
      )}

      {/* Action Sheet Menu for Comments */}
      {activeCommentAction && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-end justify-center">
             <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setActiveCommentAction(null)} />
             <div className="bg-white w-full max-w-md rounded-t-2xl pb-safe relative z-10 p-4 animate-slide-up-fast">
                 <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
                 <div className="flex flex-col gap-2">
                    <button onClick={handleCopyComment} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl w-full">
                        <Copy size={20} className="text-blue-600" />
                        <span className="font-bold text-gray-700">{t('copy_text')}</span>
                    </button>
                    {isCommentOwner ? (
                        <button onClick={handleDeleteComment} className="flex items-center gap-4 p-3 hover:bg-red-50 rounded-xl w-full">
                            <Trash2 size={20} className="text-red-600" />
                            <span className="font-bold text-red-600">{t('delete')}</span>
                        </button>
                    ) : (
                        <button onClick={() => { 
                            if (onReport && activeCommentAction) {
                                onReport('comment', activeCommentAction._id, activeCommentAction.user.name);
                            }
                            setActiveCommentAction(null); 
                        }} className="flex items-center gap-4 p-3 hover:bg-red-50 rounded-xl w-full">
                            <Flag size={20} className="text-red-600" />
                            <span className="font-bold text-red-600">{t('report')}</span>
                        </button>
                    )}
                 </div>
             </div>
          </div>, document.body
      )}
    </div>
  );
};

export default VideoDetailView;
