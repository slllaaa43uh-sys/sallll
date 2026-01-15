
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ThumbsUp, MessageCircle, UserPlus, Video, 
  ArrowRight, MoreHorizontal, Loader2, Bell, Check, Trash2, CheckCircle, Repeat
} from 'lucide-react';
import Avatar from './Avatar';
import { API_BASE_URL } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationsViewProps {
  onClose: () => void;
  onNotificationClick: (notification: any) => void;
  onProfileClick?: (userId: string) => void;
}

interface APINotification {
  _id: string;
  type: string;
  sender: {
    _id: string;
    name: string;
    avatar?: string;
  };
  post?: {
    _id: string;
    image?: string;
  } | string;
  short?: {
    _id: string;
    thumbnail?: string;
  } | string;
  comment?: any;
  reply?: any;
  message?: string;
  isRead: boolean;
  createdAt: string;
  entityId?: string;
  targetId?: string;
  postId?: string;
  shortId?: string;
}

let globalNotificationsCache: APINotification[] = [];
let hasLoadedNotificationsOnce = false;
let globalDisplayedCount = 10; 
let globalScrollPosition = 0;  

export const clearNotificationsCache = () => {
  globalNotificationsCache = [];
  hasLoadedNotificationsOnce = false;
  globalDisplayedCount = 10;
  globalScrollPosition = 0;
};

const FollowBackButton: React.FC<{ userId: string }> = ({ userId }) => {
    const { t } = useLanguage();
    const [isFollowed, setIsFollowed] = useState(() => {
        const cached = localStorage.getItem(`follow_status_${userId}`);
        return cached === 'true';
    });

    const handleFollow = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFollowed) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        setIsFollowed(true);
        localStorage.setItem(`follow_status_${userId}`, 'true');

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/follow/${userId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                setIsFollowed(false);
                localStorage.setItem(`follow_status_${userId}`, 'false');
            }
        } catch (error) {
            console.error("Follow back failed", error);
            setIsFollowed(false);
            localStorage.setItem(`follow_status_${userId}`, 'false');
        }
    };
    
    if (isFollowed) {
        return (
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                <Check size={14} />
                <span>{t('following')}</span>
            </div>
        );
    }

    return (
        <button
            onClick={handleFollow}
            className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-blue-700 transition-colors active:scale-95"
        >
            {t('follow_back')}
        </button>
    );
};


const NotificationsView: React.FC<NotificationsViewProps> = ({ onClose, onNotificationClick, onProfileClick }) => {
  const { t, language } = useLanguage();
  
  const INITIAL_BATCH = 10;
  const NEXT_BATCH = 10; 

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [allNotifications, setAllNotifications] = useState<APINotification[]>(globalNotificationsCache);
  const [displayedNotifications, setDisplayedNotifications] = useState<APINotification[]>(() => {
      if (globalNotificationsCache.length > 0) {
          return globalNotificationsCache.slice(0, globalDisplayedCount);
      }
      return [];
  });
  
  const [loading, setLoading] = useState(!hasLoadedNotificationsOnce);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  useLayoutEffect(() => {
    if (scrollContainerRef.current && hasLoadedNotificationsOnce && globalScrollPosition > 0) {
        scrollContainerRef.current.scrollTop = globalScrollPosition;
    }
  }, [displayedNotifications]); 

  useEffect(() => {
    const container = scrollContainerRef.current;
    return () => {
        if (container) {
            globalScrollPosition = container.scrollTop;
        }
    };
  }, []);

  const fetchNotifications = useCallback(async (isBackgroundUpdate = false) => {
    const token = localStorage.getItem('token');
    const currentUserId = localStorage.getItem('userId');

    if (!token) {
      setLoading(false);
      return;
    }

    if (!isBackgroundUpdate && !hasLoadedNotificationsOnce) {
        setLoading(true);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        let rawNotifications = Array.isArray(data) ? data : (data.notifications || []);

        if (currentUserId) {
          rawNotifications = rawNotifications.filter((n: any) => {
            const senderId = n.sender?._id || n.sender?.id;
            return String(senderId) !== String(currentUserId);
          });
        }

        const sorted = rawNotifications.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        globalNotificationsCache = sorted;
        hasLoadedNotificationsOnce = true;

        setAllNotifications(sorted);
        setDisplayedNotifications(sorted.slice(0, globalDisplayedCount));
      }
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(hasLoadedNotificationsOnce);
  }, [fetchNotifications]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const markAllReadOnOpen = async () => {
        try {
            await fetch(`${API_BASE_URL}/api/v1/notifications/read-all`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) {
            console.error("Failed to mark all read", e);
        }
    };
    markAllReadOnOpen();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    globalScrollPosition = scrollTop;

    if (scrollHeight - scrollTop <= clientHeight + 100) {
      if (!loadingMore && displayedNotifications.length < allNotifications.length) {
        loadMoreNotifications();
      }
    }
  };

  const loadMoreNotifications = async () => {
    setLoadingMore(true);
    const currentLength = displayedNotifications.length;
    const newCount = currentLength + NEXT_BATCH;
    globalDisplayedCount = newCount;
    const nextBatch = allNotifications.slice(currentLength, newCount);
    setDisplayedNotifications(prev => [...prev, ...nextBatch]);
    setLoadingMore(false);
  };

  const markAsRead = async (notifId: string, refreshFromServer = true) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (!refreshFromServer) {
        setDisplayedNotifications(prev => prev.map(n => n._id === notifId ? { ...n, isRead: true } : n));
        setAllNotifications(prev => prev.map(n => n._id === notifId ? { ...n, isRead: true } : n));
        globalNotificationsCache = globalNotificationsCache.map(n => n._id === notifId ? { ...n, isRead: true } : n);
        setActiveMenuId(null);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/notifications/${notifId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok && refreshFromServer) {
          await fetchNotifications(true);
      }
    } catch (error) {
      console.error("Failed to mark read", error);
    }
  };

  const markAllAsRead = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    setIsMenuOpen(false);
    setLoading(true);

    try {
       await fetch(`${API_BASE_URL}/api/v1/notifications/read-all`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
       });
       await fetchNotifications(true);
    } catch (e) { 
        console.error(e); 
        setLoading(false);
    }
  };

  const handleDeleteNotification = async () => {
      if (!notificationToDelete) return;
      setIsDeleting(true);
      const token = localStorage.getItem('token');
      
      try {
          const response = await fetch(`${API_BASE_URL}/api/v1/notifications/${notificationToDelete}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.ok) {
              setAllNotifications(prev => prev.filter(n => n._id !== notificationToDelete));
              setDisplayedNotifications(prev => prev.filter(n => n._id !== notificationToDelete));
              globalNotificationsCache = globalNotificationsCache.filter(n => n._id !== notificationToDelete);
          }
      } catch (error) {
          console.error("Failed to delete notification", error);
      } finally {
          setIsDeleting(false);
          setNotificationToDelete(null);
      }
  };

  const getNotificationMessage = (notif: APINotification) => {
    const senderName = notif.sender.name || 'مستخدم';
    
    switch (notif.type) {
        case 'like': 
        case 'post_like':
            return `${senderName} أعجب بمنشورك`;
        
        case 'comment':
        case 'post_comment':
            return `${senderName} علق على منشورك`;
        
        case 'reply':
        case 'post_reply':
            return `${senderName} رد على تعليقك`;
        
        case 'comment_like':
            return `${senderName} أعجب بتعليقك`;
        
        case 'reply_like':
            return `${senderName} أعجب بردك`;
        
        case 'repost':
            return `${senderName} أعاد نشر منشورك`;

        case 'follow':
        case 'new_follower':
            return `${senderName} بدأ في متابعتك`;
        
        case 'short_like':
            return `${senderName} أعجب بالفيديو الخاص بك`;
        
        case 'short_comment':
            return `${senderName} علق على الفيديو الخاص بك`;

        case 'short_reply':
            return `${senderName} رد على تعليقك في الفيديو`;
        
        case 'short_comment_like':
            return `${senderName} أعجب بتعليقك في الفيديو`;

        case 'short_reply_like':
            return `${senderName} أعجب بردك في الفيديو`;

        case 'short_repost':
            return `${senderName} أعاد نشر فيديوهك`;

        default:
            return notif.message || `${senderName} تفاعل معك`;
    }
  };

  const handleItemClick = (notif: APINotification) => {
    let category = 'post';
    let navTargetId = ''; 
    let imagePreview = null;
    let commentId = null;
    let replyId = null;
    
    if (notif.post) {
        navTargetId = typeof notif.post === 'object' ? (notif.post._id || (notif.post as any).id) : notif.post;
        if (typeof notif.post === 'object' && notif.post.image) {
             imagePreview = notif.post.image.startsWith('http') ? notif.post.image : `${API_BASE_URL}${notif.post.image}`;
        }
    } else if (notif.short) {
        navTargetId = typeof notif.short === 'object' ? (notif.short._id || (notif.short as any).id) : notif.short;
        category = 'video';
        if (typeof notif.short === 'object' && notif.short.thumbnail) {
             imagePreview = notif.short.thumbnail.startsWith('http') ? notif.short.thumbnail : `${API_BASE_URL}${notif.short.thumbnail}`;
        }
    } else if (notif.postId) {
        navTargetId = notif.postId;
    } else if (notif.shortId) {
        navTargetId = notif.shortId;
        category = 'video';
    } else if (notif.entityId) {
        navTargetId = notif.entityId;
    } else if (notif.targetId) {
        navTargetId = notif.targetId;
    }

    if (notif.type.includes('short') || notif.type.includes('video')) {
        category = 'video';
    }

    if (notif.comment) {
        commentId = typeof notif.comment === 'object' ? (notif.comment._id || notif.comment.id) : notif.comment;
    }
    if (notif.reply) {
        replyId = typeof notif.reply === 'object' ? (notif.reply._id || notif.reply.id) : notif.reply;
    }

    if (!notif.isRead) {
        markAsRead(notif._id, false).catch(err => console.error(err));
    }

    const lowerType = notif.type.toLowerCase();
    const noActionTypes = [
        'repost',
        'like',
        'post_like',
        'short_like',
        'comment_like',
        'reply_like',
        'short_comment_like',
        'short_reply_like',
        'short_repost'
    ];

    if (noActionTypes.includes(lowerType)) {
        return; 
    }

    if (lowerType.includes('follow') || notif.type === 'new_follower') {
       if (onProfileClick) onProfileClick(notif.sender._id);
       return; 
    }

    const shouldOpenComments = lowerType === 'short_comment' || lowerType === 'short_reply';

    if (navTargetId) {
        onNotificationClick({
            id: notif._id,
            category: category,
            targetId: navTargetId, 
            commentId: commentId,
            replyId: replyId,
            sender: {
                name: notif.sender.name,
                avatar: notif.sender.avatar ? (notif.sender.avatar.startsWith('http') ? notif.sender.avatar : `${API_BASE_URL}${notif.sender.avatar}`) : null
            },
            postImage: imagePreview,
            content: getNotificationMessage(notif),
            time: new Date(notif.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US'),
            isRead: true,
            notificationType: notif.type,
            openComments: shouldOpenComments
        });
    } else {
        console.warn("Notification missing target ID:", notif);
    }
  };

  const getIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('like')) return <ThumbsUp size={10} className="text-white fill-white" />;
    if (t.includes('comment') || t.includes('reply')) return <MessageCircle size={10} className="text-white fill-white" />;
    if (t.includes('follow') || t.includes('user_follow')) return <UserPlus size={10} className="text-white fill-white" />;
    if (t.includes('short') || t.includes('video')) return <Video size={10} className="text-white fill-white" />;
    if (t.includes('repost')) return <Repeat size={10} className="text-white" strokeWidth={3} />;
    return <Bell size={10} className="text-white fill-white" />;
  };

  const getBadgeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('like')) return 'bg-blue-500';
    if (t.includes('comment') || t.includes('reply')) return 'bg-green-500';
    if (t.includes('follow') || t.includes('user_follow')) return 'bg-black';
    if (t.includes('short')) return 'bg-red-500';
    if (t.includes('repost')) return 'bg-green-600';
    return 'bg-gray-500';
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return language === 'ar' ? 'الآن' : 'Just now';
    if (minutes < 60) return language === 'ar' ? `منذ ${minutes} دقيقة` : `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return language === 'ar' ? `منذ ${hours} ساعة` : `${hours}h ago`;
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');
  };

  const toggleItemMenu = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setActiveMenuId(activeMenuId === id ? null : id);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-white flex flex-col animate-in slide-in-from-left duration-300">
      
      <div className="flex-none bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10 pt-safe shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <ArrowRight className={language === 'en' ? 'rotate-180' : ''} size={24} />
          </button>
          <h2 className="text-lg font-bold text-gray-900">{t('settings_warning_notifs').replace('Warning ', '')}</h2>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-full hover:bg-gray-50 text-gray-500 transition-colors"
          >
            <MoreHorizontal size={24} />
          </button>
          
          {isMenuOpen && (
            <div 
              className={`absolute top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-[60] animate-in fade-in zoom-in-95 duration-100 ${language === 'en' ? 'right-0' : 'left-0'}`}
            >
              <div className="flex flex-col py-1">
                <button 
                  onClick={markAllAsRead} 
                  className="px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 text-start transition-colors"
                >
                  {t('mark_all_read')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto no-scrollbar bg-white pb-32"
        onScroll={handleScroll}
      >
        {loading ? (
           <div className="flex flex-col items-center justify-center h-full pt-20">
              <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
              <p className="text-gray-400 text-sm">{t('loading')}</p>
           </div>
        ) : allNotifications.length > 0 ? (
           <div>
             {displayedNotifications.map((notif) => {
               let displayImage = null;
               let isVideo = false;
               
               if (notif.short && typeof notif.short === 'object' && notif.short.thumbnail) {
                   displayImage = notif.short.thumbnail.startsWith('http') ? notif.short.thumbnail : `${API_BASE_URL}${notif.short.thumbnail}`;
                   isVideo = true;
               } else if (notif.post && typeof notif.post === 'object' && notif.post.image) {
                   displayImage = notif.post.image.startsWith('http') ? notif.post.image : `${API_BASE_URL}${notif.post.image}`;
               }

               const isFollowType = notif.type.toLowerCase().includes('follow') || notif.type === 'new_follower';

               return (
                <div 
                  key={notif._id}
                  onClick={() => handleItemClick(notif)}
                  className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 ${!notif.isRead ? 'bg-blue-50/30' : ''}`}
                >
                  
                  <div className="flex items-start gap-3 flex-1 pl-2 min-w-0">
                    <div 
                        className="relative flex-shrink-0 cursor-pointer" 
                        onClick={(e) => { e.stopPropagation(); onProfileClick?.(notif.sender._id); }}
                    >
                      <Avatar
                        name={notif.sender.name || 'User'}
                        src={notif.sender.avatar ? (notif.sender.avatar.startsWith('http') ? notif.sender.avatar : `${API_BASE_URL}${notif.sender.avatar}`) : null}
                        className="w-12 h-12 border border-gray-100"
                        textClassName="text-xl"
                      />
                      <div className={`absolute -bottom-0.5 -left-0.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${getBadgeColor(notif.type)}`}>
                        {getIcon(notif.type)}
                      </div>
                    </div>

                    <div className="flex flex-col pt-1 min-w-0">
                      <p className="text-sm text-gray-900 leading-snug font-medium text-start truncate">
                         {getNotificationMessage(notif)}
                      </p>
                      <span className="text-xs text-gray-400 mt-1.5 font-bold text-start">{getTimeAgo(notif.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-center pl-2 flex-shrink-0">
                    {isFollowType ? (
                       <FollowBackButton userId={notif.sender._id} />
                    ) : displayImage ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 relative bg-gray-100">
                         <img src={displayImage} alt="Content" className="w-full h-full object-cover" />
                         {isVideo && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                               <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                                  <div className="w-0 h-0 border-t-[3px] border-t-transparent border-l-[5px] border-l-black border-b-[3px] border-b-transparent ml-0.5"></div>
                               </div>
                            </div>
                         )}
                      </div>
                    ) : null}
                    
                    {!notif.isRead && (
                       <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm shadow-blue-200 flex-shrink-0"></div>
                    )}

                    <div className="relative">
                        <button 
                            onClick={(e) => toggleItemMenu(e, notif._id)}
                            className="p-1 rounded-full hover:bg-gray-200 text-gray-400 transition-colors"
                        >
                            <MoreHorizontal size={18} />
                        </button>
                        
                        {activeMenuId === notif._id && (
                            <div className="absolute top-8 end-0 bg-white rounded-xl shadow-xl border border-gray-100 z-20 w-40 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); markAsRead(notif._id, false); }}
                                    className="w-full text-start px-4 py-3 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <CheckCircle size={14} className="text-blue-600" />
                                    {t('notif_menu_read')}
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setNotificationToDelete(notif._id); setActiveMenuId(null); }}
                                    className="w-full text-start px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <Trash2 size={14} />
                                    {t('delete')}
                                </button>
                            </div>
                        )}
                    </div>
                  </div>

                </div>
              );
             })}
             
             {loadingMore && (
                <div className="flex justify-center items-center py-4">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
             )}
           </div>
        ) : (
            <div className="flex flex-col items-center justify-center h-full pb-20 text-gray-400 pt-20">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <Bell size={40} className="text-gray-300" />
                </div>
                <p className="font-bold text-gray-600">{t('notif_empty')}</p>
            </div>
        )}
      </div>

      {notificationToDelete && createPortal(
           <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => !isDeleting && setNotificationToDelete(null)} />
             <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100">
                <div className="flex flex-col items-center text-center gap-4 pt-2">
                   <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-1 shadow-inner">
                      <Trash2 size={36} className="text-red-500" strokeWidth={2.5} />
                   </div>
                   <div>
                     <h3 className="text-2xl font-black text-gray-900 mb-2">{t('notif_delete_title')}</h3>
                     <p className="text-gray-500 text-base leading-relaxed font-medium px-4">
                        {t('notif_delete_msg')}
                     </p>
                   </div>
                   <div className="flex gap-3 w-full mt-4">
                      <button 
                        onClick={handleDeleteNotification} 
                        disabled={isDeleting}
                        className="flex-1 bg-red-600 text-white py-3.5 rounded-2xl font-bold text-base hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-200 flex justify-center items-center"
                      >
                        {isDeleting ? <Loader2 className="animate-spin text-white" size={24} /> : t('yes')}
                      </button>
                      <button 
                        onClick={() => setNotificationToDelete(null)} 
                        disabled={isDeleting}
                        className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold text-base hover:bg-gray-200 active:scale-95 transition-all"
                      >
                        {t('no')}
                      </button>
                   </div>
                </div>
             </div>
           </div>, document.body
      )}

    </div>
  );
};

export default NotificationsView;
