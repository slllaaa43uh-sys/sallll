import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowRight, Phone, Info, 
  Camera, Edit2, PlusCircle, Trash2,
  Play, Loader2, UserPlus, Check, Save, X, Grid, Image as ImageIcon, Film, Heart, Link as LinkIcon, MoreVertical
} from 'lucide-react';
import PostCard from './PostCard';
import { Post } from '../types';
import Avatar from './Avatar';
import { API_BASE_URL } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import ShortsView from './ShortsView';

interface ProfileViewProps {
  onClose: () => void;
  onReport?: (type: 'post' | 'comment' | 'reply' | 'video', id: string, name: string) => void;
  userId?: string; 
  onLogout?: () => void;
}

interface CustomSection {
  id: number;
  _id?: string;
  title: string;
  content: string;
}

interface VideoItem {
  id: string;
  url: string;
  thumbnail: string;
  likes: number;
  comments: number;
  desc: string;
  views: number;
  allowComments: boolean;
  allowDownloads: boolean;
  allowRepost: boolean;
  privacy: string;
}

// --- GLOBAL CACHE DEFINITION ---
interface CachedProfileData {
    user: any;
    isFollowed: boolean;
    customSections: CustomSection[];
    posts: Post[];
    videos: VideoItem[];
    postsPage: number;
    videosPage: number;
    hasMorePosts: boolean;
    hasMoreVideos: boolean;
    coverLoaded: boolean;
    avatarLoaded: boolean;
    deletedItemsIds: Set<string>;
}

const profileCache = new Map<string, CachedProfileData>();

// New: Cache to track which media has already been loaded to prevent animation replay
const loadedMediaCache = new Set<string>();

// Function to clear cache on logout
export const clearProfileCache = () => {
  profileCache.clear();
  loadedMediaCache.clear();
};

// --- Sub-component for Media Grid Items (Video/Image) ---
const ProfileMediaItem: React.FC<{ 
  type: 'video' | 'image';
  url: string;
  thumbnail?: string;
  views?: number; // Added views prop
  onClick?: () => void;
}> = ({ type, url, thumbnail, views = 0, onClick }) => {
  // Determine the unique key for this media (thumbnail or direct url)
  const sourceUrl = (type === 'video' && thumbnail) ? thumbnail : url;

  // Initialize state based on whether we've seen this URL before
  const [isLoaded, setIsLoaded] = useState(() => sourceUrl ? loadedMediaCache.has(sourceUrl) : false);

  const handleLoad = () => {
      if (sourceUrl) loadedMediaCache.add(sourceUrl);
      setIsLoaded(true);
  };

  const formatViews = (num: number) => {
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
  };

  return (
    <div 
      onClick={onClick} 
      className={`relative overflow-hidden cursor-pointer group shadow-sm bg-gray-200 border border-gray-100 ${type === 'video' ? 'aspect-[3/4] rounded-xl' : 'aspect-square'}`}
    >
      {/* Skeleton Overlay - Persists until content is ready */}
      {!isLoaded && (
         <div className="absolute inset-0 z-20 bg-gray-300 animate-pulse flex items-center justify-center">
             {/* Empty skeleton for smooth effect */}
         </div>
      )}

      {type === 'video' ? (
         thumbnail ? (
            <img 
                src={thumbnail} 
                alt="" 
                className={`w-full h-full object-cover transition-opacity duration-500 group-hover:scale-110 ${isLoaded ? 'opacity-90' : 'opacity-0'}`} 
                onLoad={handleLoad}
                onError={handleLoad}
            />
         ) : (
            <video
                src={`${url}#t=0.1`} 
                className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-90' : 'opacity-0'}`}
                muted
                preload="metadata"
                playsInline
                onLoadedData={handleLoad}
                onError={handleLoad}
            />
         )
      ) : (
         <img 
            src={url} 
            alt="" 
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={handleLoad}
            onError={handleLoad}
         />
      )}
      
      {/* Video Specific Overlays */}
      {type === 'video' && isLoaded && (
        <>
            {/* Center Play Icon (Hidden on load, shows on hover/interaction usually, or kept hidden for clean look) */}
            <div className={`absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-opacity opacity-0 group-hover:opacity-100`}>
                <Play size={24} className="text-white fill-white" />
            </div>

            {/* Views Count (TikTok Style) */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white z-10 drop-shadow-md">
                <Play size={10} className="fill-white" />
                <span className="text-[10px] font-bold">{formatViews(views)}</span>
            </div>
            {/* Gradient for readability */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
        </>
      )}
    </div>
  );
};

const ProfileView: React.FC<ProfileViewProps> = ({ onClose, onReport, userId, onLogout }) => {
  const { t, language } = useLanguage();
  // Removed 'photos' from activeTab types
  const [activeTab, setActiveTab] = useState<'posts' | 'videos'>('posts');
  
  const currentUserId = localStorage.getItem('userId');
  const isMe = !userId || userId === 'me' || userId === currentUserId;
  const targetId = isMe ? 'me' : userId!;

  const cachedData = profileCache.get(targetId);

  // Initial Loading States:
  const [loadingProfile, setLoadingProfile] = useState(!cachedData?.user);
  
  // TRACK FETCH STATUS TO PREVENT RELOADING ON TAB SWITCH
  // Initialize to true if we have cached data, false otherwise
  const [postsInitialized, setPostsInitialized] = useState(!!(cachedData?.posts));
  const [videosInitialized, setVideosInitialized] = useState(!!(cachedData?.videos));

  const [loadingContent, setLoadingContent] = useState(() => {
      if (activeTab === 'posts' && cachedData?.posts && cachedData.posts.length > 0) return false;
      if (activeTab === 'videos' && cachedData?.videos && cachedData.videos.length > 0) return false;
      // If initialized (even empty), don't show loader
      if (activeTab === 'posts' && !!(cachedData?.posts)) return false;
      if (activeTab === 'videos' && !!(cachedData?.videos)) return false;
      return true;
  });
  
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  
  const [isCoverLoaded, setIsCoverLoaded] = useState(cachedData?.coverLoaded || false);
  const [isAvatarLoaded, setIsAvatarLoaded] = useState(cachedData?.avatarLoaded || false);
  const [uploadingImage, setUploadingImage] = useState<'avatar' | 'cover' | null>(null);

  const [user, setUser] = useState<any>(cachedData?.user || {
    _id: '',
    name: '',
    username: '',
    bio: '',
    phone: '',
    website: '', 
    followers: 0,
    following: 0,
    postsCount: 0,
    totalLikes: 0,
    avatar: null,
    cover: null
  });

  const [isFollowed, setIsFollowed] = useState(cachedData?.isFollowed || false);
  const [customSections, setCustomSections] = useState<CustomSection[]>(cachedData?.customSections || []);
  
  const [posts, setPosts] = useState<Post[]>(cachedData?.posts || []);
  const [videos, setVideos] = useState<VideoItem[]>(cachedData?.videos || []);

  // SEPARATE PAGINATION STATE FOR EACH TAB
  const [postsPage, setPostsPage] = useState(cachedData?.postsPage || 1);
  const [videosPage, setVideosPage] = useState(cachedData?.videosPage || 1);

  const [hasMorePosts, setHasMorePosts] = useState(cachedData?.hasMorePosts ?? true);
  const [hasMoreVideos, setHasMoreVideos] = useState(cachedData?.hasMoreVideos ?? true);

  // REFS TO TRACK LAST FETCHED PAGE TO PREVENT DUPLICATE CALLS ON TAB SWITCH
  const lastFetchedPostsPage = useRef(cachedData?.posts && cachedData.posts.length > 0 ? cachedData.postsPage : 0);
  const lastFetchedVideosPage = useRef(cachedData?.videos && cachedData.videos.length > 0 ? cachedData.videosPage : 0);

  // New state to track deleted items so they don't reappear on refetch
  const [deletedItemsIds, setDeletedItemsIds] = useState<Set<string>>(cachedData?.deletedItemsIds || new Set<string>());

  const [editingState, setEditingState] = useState<{ field: string, value: string, label: string } | null>(null);
  
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionContent, setNewSectionContent] = useState('');
  const [isSavingSection, setIsSavingSection] = useState(false);

  const [editingSection, setEditingSection] = useState<CustomSection | null>(null);
  const [isSavingSectionEdit, setIsSavingSectionEdit] = useState(false);

  // Add isDeleting state for the delete modal loading
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'section' | 'video' | 'post' | null;
    id: number | string | null;
  }>({ isOpen: false, type: null, id: null });

  // Account Deletion States
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Replaces the simple video viewer with Shorts integration
  const [viewingShortId, setViewingShortId] = useState<string | null>(null);
  // Holds the transformed list of videos for ShortsView
  const [shortsPlaylist, setShortsPlaylist] = useState<any[]>([]);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Sync Follow Status & Global Event Listener
  useEffect(() => {
    if (isMe) return;
    const userId = user._id;
    if (!userId) return;

    // Global Event Listener for Synchronization
    const handleGlobalFollowChange = (event: CustomEvent) => {
        if (event.detail && event.detail.userId === userId) {
            setIsFollowed(event.detail.isFollowed);
            updateCache({ isFollowed: event.detail.isFollowed });
        }
    };

    window.addEventListener('user-follow-change', handleGlobalFollowChange as EventListener);

    return () => {
        window.removeEventListener('user-follow-change', handleGlobalFollowChange as EventListener);
    };
  }, [user._id, isMe]);

  // Listen for job status changes from PostCard
  useEffect(() => {
    const handleStatusUpdate = (event: CustomEvent) => {
        if (event.detail && event.detail.postId) {
            setPosts(currentPosts => currentPosts.map(p => 
                p.id === event.detail.postId 
                ? { ...p, jobStatus: event.detail.jobStatus } 
                : p
            ));
        }
    };
    window.addEventListener('post-status-updated', handleStatusUpdate as EventListener);
    return () => {
        window.removeEventListener('post-status-updated', handleStatusUpdate as EventListener);
    };
  }, []);

  const updateCache = (updates: Partial<CachedProfileData>) => {
      const current = profileCache.get(targetId) || {
          user, 
          isFollowed, 
          customSections, 
          posts: [], 
          videos: [], 
          postsPage: 1,
          videosPage: 1,
          hasMorePosts: true,
          hasMoreVideos: true,
          coverLoaded: isCoverLoaded,
          avatarLoaded: isAvatarLoaded,
          deletedItemsIds: deletedItemsIds
      };
      profileCache.set(targetId, { ...current, ...updates });
  };

  const cleanUrl = useCallback((url: any) => {
    if (!url || typeof url !== 'string') return null;
    if (url.includes('undefined') || url.includes('null')) return null;
    if (url.startsWith('http')) return url;
    if (url.startsWith('blob:')) return url;
    
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
  }, []);
  
  const processUserData = useCallback((userData: any) => {
    if (!userData || typeof userData !== 'object') return null;

    const realId = userData._id || userData.id;

    const getProp = (...keys: string[]) => {
        for (const k of keys) {
            if (userData[k] !== undefined && userData[k] !== null && userData[k] !== '') return userData[k];
        }
        return null;
    };

    const name = getProp('name', 'fullname', 'userName', 'username', 'firstName') || 'مستخدم';
    
    let username = getProp('username', 'email') || 'user';
    if (typeof username === 'string') {
       if (username.includes('@') && !username.startsWith('@')) username = username.split('@')[0];
       if (!username.startsWith('@')) username = `@${username}`;
    }

    const avatar = cleanUrl(getProp('avatar', 'profilePicture', 'profileImage', 'image', 'photo'));
    const cover = cleanUrl(getProp('cover', 'coverImage', 'backgroundImage', 'banner', 'headerImage'));

    const getCount = (val: any) => Array.isArray(val) ? val.length : (typeof val === 'number' ? val : 0);
    
    const followers = getCount(getProp('followers', 'followersCount'));
    const following = getCount(getProp('following', 'followingCount'));
    
    let postsCount = getCount(getProp('postsCount', 'posts_count', 'postCount'));
    if (postsCount === 0 && Array.isArray(userData.posts) && userData.posts.length > 0) {
        postsCount = userData.posts.length;
    }

    const totalLikes = getCount(getProp('totalLikes', 'likesCount', 'likes'));

    const bio = getProp('bio', 'about', 'description') || '';
    const phone = getProp('phone', 'phoneNumber', 'mobile') || '';
    const website = getProp('website', 'url', 'site', 'link') || '';

    return {
      _id: realId, name, username, bio, phone, website,
      followers, following, postsCount, totalLikes, avatar, cover
    };
  }, [cleanUrl]);

  const fetchProfile = useCallback(async (isBackgroundRefresh = false) => {
    // Only set loading if we truly have NO data. If we have a name, assume we have basic data.
    if (!isBackgroundRefresh && !user.name) {
        setLoadingProfile(true);
    }
    
    const token = localStorage.getItem('token');
    if (!token) return;

    const findUserObject = (data: any): any | null => {
        if (!data || typeof data !== 'object') return null;
        if (data.user && typeof data.user === 'object') return data.user;
        if (data.data && typeof data.data === 'object') {
            if (data.data.user && typeof data.data.user === 'object') return data.data.user;
            if (data.data._id || data.data.id) return data.data;
        }
        if (data._id || data.id) return data;
        return null;
    };

    try {
      const endpoint = `${API_BASE_URL}/api/v1/users/${targetId}`;

      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const rootData = await response.json();
        const userData = findUserObject(rootData);
        const processedUser = processUserData(userData);

        if (processedUser) {
            setUser((prev: any) => {
                let adjustedPostsCount = processedUser.postsCount;
                if (adjustedPostsCount === 0) {
                    if (prev.postsCount > 0) {
                        adjustedPostsCount = prev.postsCount;
                    } else {
                        const currentCache = profileCache.get(targetId);
                        if (currentCache?.user?.postsCount > 0) {
                            adjustedPostsCount = currentCache.user.postsCount;
                        }
                    }
                }

                if (editingState) return prev;

                // Fix: Preserve timestamped images if URL base matches
                // This prevents reverting to cached "old" image when server sends back the base URL without ?v=timestamp
                let newAvatar = processedUser.avatar;
                if (uploadingImage !== 'avatar' && prev.avatar && newAvatar) {
                    const prevBase = prev.avatar.split('?')[0];
                    const newBase = newAvatar.split('?')[0];
                    // If server URL matches local URL base, and local has timestamp, keep local
                    if (prevBase === newBase && prev.avatar.includes('?v=')) {
                        newAvatar = prev.avatar;
                    }
                } else if (uploadingImage === 'avatar') {
                    // While uploading, don't update from server
                    newAvatar = prev.avatar;
                }

                let newCover = processedUser.cover;
                if (uploadingImage !== 'cover' && prev.cover && newCover) {
                    const prevBase = prev.cover.split('?')[0];
                    const newBase = newCover.split('?')[0];
                    if (prevBase === newBase && prev.cover.includes('?v=')) {
                        newCover = prev.cover;
                    }
                } else if (uploadingImage === 'cover') {
                    newCover = prev.cover;
                }

                return {
                    ...prev,
                    ...processedUser,
                    postsCount: adjustedPostsCount,
                    avatar: newAvatar,
                    cover: newCover,
                };
            });

            let newSections: CustomSection[] = [];
            if (userData.sections && Array.isArray(userData.sections)) {
                newSections = userData.sections;
                setCustomSections(newSections);
            }

            let newIsFollowed = false;
            if (!isMe && processedUser._id) {
                try {
                    const cachedStatus = localStorage.getItem(`follow_status_${processedUser._id}`);
                    if (cachedStatus) {
                        newIsFollowed = JSON.parse(cachedStatus);
                        setIsFollowed(newIsFollowed);
                    }

                    fetch(`${API_BASE_URL}/api/v1/follow/${processedUser._id}/status`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }).then(res => res.json()).then(statusData => {
                        setIsFollowed(statusData.isFollowing);
                        localStorage.setItem(`follow_status_${processedUser._id}`, JSON.stringify(statusData.isFollowing));
                        updateCache({ isFollowed: statusData.isFollowing });
                    });
                } catch (e) { console.error(e); }
            }

            setUser((currentUserState: any) => {
                updateCache({ 
                    user: currentUserState, 
                    customSections: newSections, 
                    isFollowed: newIsFollowed 
                });
                return currentUserState;
            });
        }
      }
    } catch (error) {
      console.error("Failed to fetch profile", error);
    } finally {
      if (!isBackgroundRefresh) {
          setLoadingProfile(false);
      }
    }
  }, [targetId, isMe, processUserData, uploadingImage, editingState]);

  const mapApiPostToUI = useCallback((apiPost: any): Post => {
    const reactions = apiPost.reactions || [];
    const likesCount = reactions.filter((r: any) => !r.type || r.type === 'like').length;
    
    let commentsCount = 0;
    if (typeof apiPost.comments === 'number') {
        commentsCount = apiPost.comments;
    } else if (Array.isArray(apiPost.comments)) {
        commentsCount = apiPost.comments.length;
    } else if (apiPost.commentsCount) {
        commentsCount = apiPost.commentsCount;
    }

    const isLiked = reactions.some((r: any) => {
        const rId = r.user?._id || r.user;
        return String(rId) === String(currentUserId);
    });

    let postUserAvatar = null;
    if (apiPost.user && typeof apiPost.user === 'object' && apiPost.user.avatar) {
        postUserAvatar = cleanUrl(apiPost.user.avatar);
    } else {
        postUserAvatar = user.avatar;
    }

    const postUserName = (apiPost.user && typeof apiPost.user === 'object' && apiPost.user.name) 
        ? apiPost.user.name 
        : user.name;

    const postUserId = (apiPost.user && (apiPost.user._id || apiPost.user.id)) || user._id;

    // Logic for location string if available
    let locationString = apiPost.location || 'عام';
    if (apiPost.scope === 'local' && apiPost.country) {
        locationString = apiPost.city && apiPost.city !== 'كل المدن' ? `${apiPost.country} | ${apiPost.city}` : apiPost.country;
    }

    // Recursion for reposts
    let originalPost = undefined;
    if (apiPost.originalPost) {
        // We use the same function recursively, but we need to ensure 'user' context is correct.
        // For simplicity in recursion, we assume the original post has its user populated.
        originalPost = mapApiPostToUI(apiPost.originalPost);
    }

    return {
      id: apiPost._id || apiPost.id,
      _id: apiPost._id || apiPost.id, 
      user: {
        id: postUserId,
        _id: postUserId,
        name: postUserName,
        avatar: postUserAvatar
      },
      timeAgo: apiPost.createdAt ? new Date(apiPost.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : '',
      content: apiPost.text || apiPost.content || '', // Corrected line: Check both text and content fields
      // Ensure media array is populated if available, fallback to image only if needed
      image: apiPost.media?.[0]?.url ? cleanUrl(apiPost.media[0].url) : undefined,
      media: apiPost.media ? apiPost.media.map((m: any) => ({
        url: cleanUrl(m.url),
        type: m.type,
        thumbnail: m.thumbnail ? cleanUrl(m.thumbnail) : undefined
      })) : [],
      likes: likesCount,
      comments: commentsCount,
      shares: apiPost.shares?.length || 0,
      isLiked: isLiked,
      reactions: reactions,
      isShort: apiPost.isShort || false,
      
      // ADDED FIELDS:
      jobStatus: apiPost.jobStatus || 'open',
      title: apiPost.title,
      type: apiPost.type,
      location: locationString,
      category: apiPost.category,
      isFeatured: apiPost.isFeatured,
      contactPhone: apiPost.contactPhone,
      contactEmail: apiPost.contactEmail,
      contactMethods: apiPost.contactMethods,
      originalPost: originalPost,
    };
  }, [user, currentUserId, cleanUrl, language]);

  const fetchContent = useCallback(async (type: 'all' | 'video', signal: AbortSignal, pageNum: number) => {
    const isLoadMore = pageNum > 1;
    
    if (isLoadMore) {
        setIsFetchingMore(true);
    } else {
        // FIXED: Don't set loading if we are just refreshing and already have data
        // BUT logic was moved to useEffect to use initialized flags
    }

    const token = localStorage.getItem('token');
    
    const fetchTargetId = isMe ? (localStorage.getItem('userId') || 'me') : targetId;

    if (!token) {
        setLoadingContent(false);
        setIsFetchingMore(false);
        return;
    }

    try {
      let limit = 10;
      if (type === 'video') limit = 18; // Increased from 3 to 18 to support full grid view and infinite scroll

      let url = `${API_BASE_URL}/api/v1/posts/user/${fetchTargetId}?page=${pageNum}&limit=${limit}`;
      if (type === 'video') url += '&type=video';

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });

      if (response.ok) {
        const data = await response.json();
        const rawPosts = Array.isArray(data) ? data : (data.posts || []);
        
        let filteredRawPosts = rawPosts.filter((p: any) => !deletedItemsIds.has(p._id || p.id));

        if (type === 'all') {
            filteredRawPosts = filteredRawPosts.filter((p: any) => !p.isShort);
        } else if (type === 'video') {
            filteredRawPosts = filteredRawPosts.filter((p: any) => p.isShort);
        }

        const fetchedCount = rawPosts.length;
        const newHasMore = fetchedCount >= limit;

        if (type === 'all') {
            const mappedPosts = filteredRawPosts.map((p: any) => mapApiPostToUI(p));
            setPosts(prev => isLoadMore ? [...prev, ...mappedPosts] : mappedPosts);
            setHasMorePosts(newHasMore);
            lastFetchedPostsPage.current = pageNum; // Update ref to avoid duplication
            setPostsInitialized(true); // Mark as initialized

            updateCache({ 
                posts: isLoadMore ? [...posts, ...mappedPosts] : mappedPosts,
                postsPage: pageNum,
                hasMorePosts: newHasMore
            });
        } else if (type === 'video') {
            const mappedVideos = filteredRawPosts.map((p: any) => {
                const videoMedia = p.media?.find((m: any) => m.type === 'video');
                return {
                    id: p._id || p.id,
                    url: videoMedia?.url ? cleanUrl(videoMedia.url) : '',
                    thumbnail: videoMedia?.thumbnail ? cleanUrl(videoMedia.thumbnail) : '', 
                    likes: p.likes || p.reactions?.length || 0,
                    comments: p.comments?.length || 0,
                    desc: p.text || '',
                    views: p.viewCount || p.views || 0, // Map views from API
                    allowComments: p.allowComments !== false,
                    allowDownloads: p.allowDownloads !== false,
                    allowRepost: p.allowRepost !== false,
                    privacy: p.privacy || 'public'
                };
            }).filter((v: any) => v.url);
            
            setVideos(prev => isLoadMore ? [...prev, ...mappedVideos] : mappedVideos);
            setHasMoreVideos(newHasMore);
            lastFetchedVideosPage.current = pageNum; // Update ref
            setVideosInitialized(true); // Mark as initialized

            updateCache({ 
                videos: isLoadMore ? [...videos, ...mappedVideos] : mappedVideos,
                videosPage: pageNum,
                hasMoreVideos: newHasMore
            });
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error(`Failed to fetch ${type}`, error);
      // Even on error, mark as initialized to stop indefinite loading spinner
      if (type === 'all') setPostsInitialized(true);
      if (type === 'video') setVideosInitialized(true);
    } finally {
      if (!signal.aborted) {
        setLoadingContent(false);
        setIsFetchingMore(false);
      }
    }
  }, [isMe, targetId, mapApiPostToUI, cleanUrl, posts, videos, deletedItemsIds]);

  // Initial Fetch: Profile Only
  useEffect(() => {
    fetchProfile(!!cachedData);
  }, [fetchProfile]);

  // Content Fetching Logic - UPDATED TO PREVENT DUPLICATES ON TAB SWITCH AND FIX RE-LOADING SPINNER
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Intelligent Loading State Logic
    if (activeTab === 'posts') {
        // Only show loader if we HAVEN'T initialized this tab yet
        if (!postsInitialized && posts.length === 0) {
            setLoadingContent(true);
        } else {
            setLoadingContent(false);
        }
    } else if (activeTab === 'videos') {
        // Only show loader if we HAVEN'T initialized this tab yet
        if (!videosInitialized && videos.length === 0) {
            setLoadingContent(true);
        } else {
            setLoadingContent(false);
        }
    }

    // Fetching Logic
    if (activeTab === 'posts') {
        // Only fetch if not initialized or if we are paging
        if (!postsInitialized || posts.length === 0) {
            fetchContent('all', controller.signal, 1);
        } else if (postsPage > lastFetchedPostsPage.current) {
            fetchContent('all', controller.signal, postsPage);
        }
    } else if (activeTab === 'videos') {
        // Only fetch if not initialized or if we are paging
        if (!videosInitialized || videos.length === 0) {
            fetchContent('video', controller.signal, 1);
        } else if (videosPage > lastFetchedVideosPage.current) {
            fetchContent('video', controller.signal, videosPage);
        }
    }

    return () => {
      controller.abort();
    };
  }, [activeTab, postsPage, videosPage]); // Dependencies updated (removed initialized flags to prevent loop, logic handles inside)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollTop + clientHeight >= scrollHeight - 50) {
          if (!loadingContent && !isFetchingMore) {
              if (activeTab === 'posts' && hasMorePosts) {
                  setPostsPage(prev => prev + 1);
              } else if (activeTab === 'videos' && hasMoreVideos) {
                  setVideosPage(prev => prev + 1);
              }
          }
      }
  };

  const handleFollowToggle = async () => {
    if (isMe) return;
    const token = localStorage.getItem('token');
    
    const prevState = isFollowed;
    const newState = !prevState;
    
    setIsFollowed(newState);
    localStorage.setItem(`follow_status_${user._id}`, JSON.stringify(newState));
    updateCache({ isFollowed: newState });

    // Global Event Dispatch
    const event = new CustomEvent('user-follow-change', {
        detail: { userId: user._id, isFollowed: newState }
    });
    window.dispatchEvent(event);
    
    try {
        const method = prevState ? 'DELETE' : 'POST';
        const response = await fetch(`${API_BASE_URL}/api/v1/follow/${user._id}`, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error("Follow failed");
        }
        
        const newFollowers = Math.max(0, user.followers + (newState ? 1 : -1));
        setUser((prev: any) => ({ ...prev, followers: newFollowers }));
        updateCache({ user: { ...user, followers: newFollowers } });

    } catch (e) {
        setIsFollowed(prevState);
        localStorage.setItem(`follow_status_${user._id}`, JSON.stringify(prevState));
        updateCache({ isFollowed: prevState });
        // Revert Global Event
        window.dispatchEvent(new CustomEvent('user-follow-change', {
            detail: { userId: user._id, isFollowed: prevState }
        }));
    }
  };

  const startEditing = (field: string, label: string) => {
      setEditingState({ field, value: user[field] || '', label });
  };

  const cancelEditing = () => {
      setEditingState(null);
  };

  const saveEditing = async () => {
    if (!editingState) return;
  
    const { field, value } = editingState;
    const originalUser = { ...user };
  
    // 1. Optimistic Update: Update UI instantly
    const optimisticUser = { ...user, [field]: value };
    setUser(optimisticUser);
    setEditingState(null); // Close modal
  
    try {
      const token = localStorage.getItem('token');
      const payload: any = { [field]: value };
      
      const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
          method: 'PUT',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
      });
  
      if (response.ok) {
          // 2. Success: Update Cache
          updateCache({ user: optimisticUser });
          
          if (isMe && field === 'name') {
              localStorage.setItem('userName', value);
          }
      } else {
          // Revert if server fails
          setUser(originalUser);
          alert('Failed to update profile.');
      }
    } catch (error) {
      console.error("Update failed", error);
      setUser(originalUser); // Revert
      alert('An error occurred while updating.');
    }
  };

  const saveNewSection = async () => {
    if (!newSectionTitle.trim() || !newSectionContent.trim()) return;
    setIsSavingSection(true);
    
    const tempSection = {
        id: Date.now(),
        _id: `temp-${Date.now()}`,
        title: newSectionTitle,
        content: newSectionContent
    };
    const optimisticSections = [...customSections, tempSection];
    setCustomSections(optimisticSections);
    setIsAddingSection(false);
    setNewSectionTitle('');
    setNewSectionContent('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/v1/users/sections`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title: tempSection.title, content: tempSection.content })
      });
      
      if (response.ok) {
          fetchProfile(true);
      }
    } catch (e) {
        console.error(e);
        setCustomSections(customSections); 
        alert("Failed to save section");
    } finally {
        setIsSavingSection(false);
    }
  };

  const saveSectionEdit = async () => {
    if (!editingSection || !editingSection.title.trim() || !editingSection.content.trim()) return;
    setIsSavingSectionEdit(true);
    try {
        const token = localStorage.getItem('token');
        const sectionId = editingSection._id || editingSection.id;
        
        const response = await fetch(`${API_BASE_URL}/api/v1/users/sections/${sectionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title: editingSection.title, content: editingSection.content })
        });

        if (response.ok) {
            const updatedSections = customSections.map(s => 
                (s.id === editingSection.id) ? editingSection : s
            );
            setCustomSections(updatedSections);
            updateCache({ customSections: updatedSections });
            setEditingSection(null);
        } else {
            alert("Failed to update section");
        }
    } catch (e) {
        console.error(e);
        alert("Error updating section");
    } finally {
        setIsSavingSectionEdit(false);
    }
  };

  const requestDeleteSection = () => {
    if (!editingSection) return;
    setDeleteModal({ isOpen: true, type: 'section', id: editingSection.id });
    setEditingSection(null);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    if (!isMe) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(type);
    
    const optimisticUrl = URL.createObjectURL(file);
    const originalValue = user[type]; 

    const optimisticUser = { ...user, [type]: optimisticUrl };
    setUser(optimisticUser);
    
    if (type === 'cover') setIsCoverLoaded(true);
    if (type === 'avatar') setIsAvatarLoaded(true);

    const formData = new FormData();
    formData.append(type, file);

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}` 
            },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            const updatedUserData = data.user || data.data || data;

            if (updatedUserData) {
                const updatedFields: { avatar?: string | null; cover?: string | null } = {};
                const timestamp = new Date().getTime();

                if (Object.prototype.hasOwnProperty.call(updatedUserData, 'avatar')) {
                    const clean = cleanUrl(updatedUserData.avatar);
                    updatedFields.avatar = clean ? `${clean}?v=${timestamp}` : null;
                }
                if (Object.prototype.hasOwnProperty.call(updatedUserData, 'cover')) {
                    const clean = cleanUrl(updatedUserData.cover);
                    updatedFields.cover = clean ? `${clean}?v=${timestamp}` : null;
                }

                const finalUser = { 
                    ...user, 
                    ...updatedFields
                };
                
                setUser(finalUser);
                updateCache({ user: finalUser });

                if (updatedFields.avatar && user.avatar !== updatedFields.avatar) {
                    localStorage.setItem('userAvatar', updatedFields.avatar);
                }

                setIsAvatarLoaded(true);
                setIsCoverLoaded(true);
                updateCache({ avatarLoaded: true, coverLoaded: true });
            } else {
                fetchProfile(true);
            }

        } else {
            setUser(prev => ({ ...prev, [type]: originalValue }));
            alert("Failed to upload image");
        }
    } catch (error) {
        setUser(prev => ({ ...prev, [type]: originalValue }));
        console.error("Upload error:", error);
        alert("Upload error");
    } finally {
        setUploadingImage(null);
    }
  };

  const requestDeletePost = (id: string, isShort?: boolean) => {
    if (isMe) {
      setDeleteModal({ isOpen: true, type: isShort ? 'video' : 'post', id });
    }
  };

  const confirmDelete = async () => {
    const token = localStorage.getItem('token');
    const { type, id } = deleteModal;
    if (!id) return;

    // Start Loading State
    setIsDeleting(true);

    try {
        if (type === 'section' && typeof id === 'number') {
             const section = customSections.find(s => s.id === id);
             const sectionId = section?._id || section?.id;
             
             // 1. Send Request
             const response = await fetch(`${API_BASE_URL}/api/v1/users/sections/${sectionId}`, {
                 method: 'DELETE',
                 headers: { 'Authorization': `Bearer ${token}` }
             });
             
             // 2. Wait for success, then close modal and update UI simultaneously
             if (response.ok) {
                 setDeleteModal({ isOpen: false, type: null, id: null }); // Close modal first
                 
                 const updatedSections = customSections.filter(s => s.id !== id);
                 setCustomSections(updatedSections);
                 updateCache({ customSections: updatedSections });
                 
                 alert(t('delete_success'));
             } else {
                 alert(t('delete_fail'));
             }

        } else if ((type === 'post' || type === 'video') && typeof id === 'string') {
             // 1. Send Request
             const response = await fetch(`${API_BASE_URL}/api/v1/posts/${id}`, {
                 method: 'DELETE',
                 headers: { 'Authorization': `Bearer ${token}` }
             });
             
             // 2. Wait for success, then close modal and update UI simultaneously
             if (response.ok) {
                 setDeleteModal({ isOpen: false, type: null, id: null }); // Close modal first

                 if (type === 'video') setViewingShortId(null);
                 
                 const updatedPosts = posts.filter(p => p.id !== id);
                 const updatedVideos = videos.filter(v => v.id !== id);
                 
                 setPosts(updatedPosts);
                 setVideos(updatedVideos);
                 
                 // Update blacklist to prevent re-fetch appearance
                 const newDeletedIds = new Set<string>(deletedItemsIds);
                 newDeletedIds.add(id);
                 setDeletedItemsIds(newDeletedIds);

                 updateCache({ 
                     posts: updatedPosts, 
                     videos: updatedVideos, 
                     deletedItemsIds: newDeletedIds 
                 });
                 alert(t('delete_success'));
             } else {
                 const errorData = await response.json().catch(() => ({}));
                 alert(t('delete_fail') + ': ' + (errorData.msg || errorData.message || response.statusText));
             }
        }
    } catch (error) {
        console.error("Delete failed", error);
        alert(t('delete_fail'));
    } finally {
        setIsDeleting(false);
        // Ensure modal is closed on error case as well if needed, 
        // but typically we might want to keep it open on error. 
        // For the requested "radical fix", closing it only on success inside the try block is key logic, 
        // but clearing state here is safe.
        if (deleteModal.isOpen) {
             // If we failed, maybe keep it open?
             // But the user complained about UI glitches.
             // Let's reset purely for cleanup if loop didn't hit.
        }
    }
  };

  const cancelDelete = () => {
    setDeleteModal({ isOpen: false, type: null, id: null });
  };

  // --- ACCOUNT DELETION HANDLER ---
  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
        const token = localStorage.getItem('token');
        // UPDATED ENDPOINT
        const response = await fetch(`${API_BASE_URL}/api/v1/users/me/account`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            alert(t('account_deleted_success'));
            if (onLogout) {
                onLogout(); 
                onClose();  
            } else {
                localStorage.clear();
                window.location.replace('/'); 
            }
        } else {
            const data = await response.json();
            alert(t('account_delete_fail') + ': ' + (data.message || data.msg || t('error_occurred')));
        }
    } catch (e) {
        console.error(e);
        alert(t('error_occurred'));
    } finally {
        setIsDeletingAccount(false);
        setShowDeleteConfirm(false);
        setShowOptionsMenu(false);
    }
  };

  const handleVideoClick = (id: string) => {
    // Transform all current videos into format expected by ShortsView
    // This allows scrolling up/down through all profile videos
    const playlist = videos.map(v => ({
        id: v.id,
        user: {
            id: user._id || user.id,
            name: user.name,
            username: user.username,
            avatar: user.avatar
        },
        videoUrl: v.url,
        likes: v.likes,
        comments: v.comments,
        description: v.desc || '',
        music: 'Original Sound',
        isLiked: false, // In a real app we'd need to store this or fetch it, assuming false for now or pass from cache
        isFollowed: isFollowed, // We know if we follow this profile
        category: '',
        privacy: v.privacy as any, 
        allowComments: v.allowComments,
        allowDownloads: v.allowDownloads,
        allowRepost: v.allowRepost,
        thumbnail: v.thumbnail
    }));
    
    setShortsPlaylist(playlist);
    setViewingShortId(id);
  };

  // Callback to handle deletion from ShortsView so Profile Grid updates immediately
  const handleShortsViewDelete = (deletedId: string) => {
      // Optimistically remove from local state
      const updatedVideos = videos.filter(v => v.id !== deletedId);
      const updatedPosts = posts.filter(p => p.id !== deletedId);
      
      setVideos(updatedVideos);
      setPosts(updatedPosts);
      
      // Update cache
      const newDeletedIds = new Set<string>(deletedItemsIds);
      newDeletedIds.add(deletedId);
      setDeletedItemsIds(newDeletedIds);

      updateCache({ 
          videos: updatedVideos, 
          posts: updatedPosts,
          deletedItemsIds: newDeletedIds
      });
  };

  const handleTabChange = (tab: 'posts' | 'videos') => {
    if (activeTab === tab) return;
    
    if (containerRef.current && tabsRef.current) {
        const tabsTop = tabsRef.current.offsetTop;
        const currentScroll = containerRef.current.scrollTop;
        if (currentScroll > tabsTop) {
            containerRef.current.scrollTop = tabsTop;
        }
    }
    
    setActiveTab(tab);
    
    // Check if we need to set loading manually here for a split second before the effect runs
    // But effect logic now handles initialization check nicely.
  };

  return (
    <div 
        className="fixed inset-0 z-[110] bg-white dark:bg-black animate-in slide-in-from-right duration-300 overflow-y-auto no-scrollbar"
        onScroll={handleScroll}
        ref={containerRef}
    >
      
      {/* 1. Header Background */}
      <div className="relative">
        <div className="h-64 relative overflow-hidden">
            <div 
                className="absolute inset-0 bg-cover bg-center blur-2xl opacity-60 scale-110"
                style={{ 
                    backgroundImage: `url(${user.avatar || 'https://via.placeholder.com/150'})`,
                    backgroundColor: '#1a1a1a' 
                }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white dark:to-black"></div>
            
            <div className="absolute top-0 w-full p-4 flex justify-between items-center text-white z-20 pt-safe">
                <button onClick={onClose} className="p-2 bg-black/20 rounded-full hover:bg-black/30 transition-colors backdrop-blur-md">
                    <ArrowRight size={24} className={language === 'en' ? 'rotate-180' : ''} />
                </button>
                
                {isMe && (
                    <button 
                        onClick={() => setShowOptionsMenu(true)} 
                        className="p-2 bg-black/20 rounded-full hover:bg-black/30 transition-colors backdrop-blur-md text-white"
                    >
                        <MoreVertical size={24} />
                    </button>
                )}
            </div>
        </div>

        {/* 2. Floating Info Card */}
        <div className="relative -mt-36 z-10">
            <div className="bg-white dark:bg-gray-900 rounded-t-[30px] border-t border-gray-100 dark:border-gray-800 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] pt-16 px-6 pb-6 relative flex flex-col items-center">
                
                <div 
                    className="absolute -top-16 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full p-1 bg-white dark:bg-gray-900 shadow-md cursor-pointer group animate-in zoom-in-50 fade-in duration-500 delay-100"
                    onClick={() => isMe && !loadingProfile && avatarInputRef.current?.click()}
                >
                    <Avatar 
                        name={user.name} 
                        src={user.avatar} 
                        className="w-full h-full rounded-full object-cover border-4 border-white dark:border-gray-900"
                        textClassName="text-4xl"
                    />
                    {isMe && !loadingProfile && (
                        <div className="absolute bottom-1 right-1 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm">
                            {uploadingImage === 'avatar' ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                        </div>
                    )}
                    <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} />
                </div>

                <div className="text-center w-full mt-2">
                    <div className="flex items-center justify-center gap-2 animate-in slide-in-from-bottom-2 fade-in duration-500 delay-150">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h1>
                        {isMe && (
                            <button onClick={() => startEditing('name', t('profile_name'))} className="text-gray-400 hover:text-blue-600">
                                <Edit2 size={14} />
                            </button>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 dir-ltr font-medium mb-3 animate-in slide-in-from-bottom-2 fade-in duration-500 delay-200">@{user.username.replace('@', '')}</p>
                    
                    <div className="flex items-center justify-center gap-2 mb-2 animate-in slide-in-from-bottom-2 fade-in duration-500 delay-300">
                        {user.bio ? (
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap max-w-xs text-center">
                                {user.bio}
                            </p>
                        ) : (
                            isMe && (
                                <button onClick={() => startEditing('bio', t('add_bio'))} className="text-sm text-blue-600 font-bold hover:underline">
                                    {t('add_bio')}
                                </button>
                            )
                        )}
                        {isMe && user.bio && (
                            <button onClick={() => startEditing('bio', t('profile_bio'))} className="text-gray-400 hover:text-blue-600">
                                <Edit2 size={14} />
                            </button>
                        )}
                    </div>

                    <div className="mb-4 animate-in slide-in-from-bottom-2 fade-in duration-500 delay-300">
                        {user.website ? (
                            <div className="flex items-center justify-center gap-2">
                                <a 
                                    href={user.website.startsWith('http') ? user.website : `https://${user.website}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                                >
                                    <LinkIcon size={12} />
                                    {user.website.replace(/^https?:\/\//, '')}
                                </a>
                                {isMe && (
                                    <button onClick={() => startEditing('website', t('profile_website'))} className="text-gray-400 hover:text-blue-600">
                                        <Edit2 size={12} />
                                    </button>
                                )}
                            </div>
                        ) : (
                            isMe && (
                                <button 
                                    onClick={() => startEditing('website', t('profile_website'))}
                                    className="text-xs font-bold text-gray-500 hover:text-blue-600 bg-gray-50 dark:bg-gray-800 px-3 py-1 rounded-full flex items-center gap-1 mx-auto transition-colors"
                                >
                                    <LinkIcon size={12} />
                                    <span>إضافة رابط</span>
                                </button>
                            )
                        )}
                    </div>
                    
                    {!isMe && false && (
                        <div className="flex gap-3 justify-center mb-6 w-full max-w-xs mx-auto animate-in slide-in-from-bottom-2 fade-in duration-500 delay-500">
                            <button 
                                onClick={handleFollowToggle}
                                className={`flex-1 py-2.5 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                                    isFollowed 
                                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' 
                                    : 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none'
                                }`}
                            >
                                {isFollowed ? t('following') : t('follow')}
                            </button>
                        </div>
                    )}

                    {/* Stats Section - Followers/Following REMOVED */}
                    <div className="flex justify-center items-center w-full max-w-xs mx-auto border-t border-gray-100 dark:border-gray-800 pt-4 px-2 animate-in slide-in-from-bottom-3 fade-in duration-700 delay-500 gap-8">
                        <div className="flex flex-col items-center">
                            <span className="font-bold text-lg text-gray-900 dark:text-white">{user.postsCount}</span>
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{t('profile_posts')}</span>
                        </div>
                        
                        <div className="w-px h-8 bg-gray-100 dark:bg-gray-800"></div>
                        
                        <div className="flex flex-col items-center">
                            <span className="font-bold text-lg text-gray-900 dark:text-white">{user.totalLikes || 0}</span>
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{t('like')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* 3. Sticky Tabs */}
      <div 
        ref={tabsRef}
        className="sticky top-0 bg-white dark:bg-gray-900 z-30 shadow-sm border-b border-gray-100 dark:border-gray-800"
      >
         <div className="flex w-full">
            {[
                { id: 'posts', label: t('profile_posts'), icon: Grid },
                { id: 'videos', label: t('profile_videos'), icon: Film },
            ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id as any)}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors relative ${
                        activeTab === tab.id 
                        ? 'text-black dark:text-white' 
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                >
                    <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                    {activeTab === tab.id && (
                        <div className="absolute bottom-0 w-8 h-0.5 bg-black dark:bg-white rounded-full"></div>
                    )}
                </button>
            ))}
         </div>
      </div>

      {/* 4. Content Area */}
      <div className="pb-20 min-h-[40vh] bg-white dark:bg-gray-900">
        
        {/* POSTS TAB */}
        {activeTab === 'posts' && (
            <div className="space-y-1 animate-in fade-in duration-300">
                {(loadingContent) ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
                ) : posts.length > 0 ? (
                    <>
                        {posts.map(post => (
                            <div key={post.id} className="bg-white dark:bg-gray-900">
                                <PostCard 
                                    post={post} 
                                    variant="profile" 
                                    onDelete={isMe ? () => requestDeletePost(post.id, post.isShort) : undefined}
                                    onReport={onReport}
                                />
                                <div className="h-2 bg-gray-50 dark:bg-black w-full"></div>
                            </div>
                        ))}
                        {isFetchingMore && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" /></div>}
                    </>
                ) : (
                    !isFetchingMore && (
                        <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                            <Grid size={48} className="mb-4 opacity-30" />
                            <p>{t('profile_no_posts')}</p>
                        </div>
                    )
                )}
            </div>
        )}

        {/* VIDEOS TAB */}
        {activeTab === 'videos' && (
            <div className="grid grid-cols-3 gap-2 p-2 animate-in fade-in duration-300">
                {(loadingContent) ? (
                    <div className="col-span-3 flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
                ) : videos.length > 0 ? (
                    <>
                        {videos.map((vid, idx) => (
                            <ProfileMediaItem 
                                key={vid.id}
                                type="video"
                                url={vid.url}
                                thumbnail={vid.thumbnail}
                                views={vid.views}
                                onClick={() => handleVideoClick(vid.id)}
                            />
                        ))}
                        {isFetchingMore && <div className="col-span-3 flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" /></div>}
                    </>
                ) : (
                    !isFetchingMore && (
                        <div className="col-span-3 text-center py-20 text-gray-400 flex flex-col items-center">
                            <Film size={48} className="mb-4 opacity-30" />
                            {/* Updated to use generic translation key */}
                            <p>{t('profile_no_videos')}</p>
                        </div>
                    )
                )}
            </div>
        )}

      </div>

      {/* --- MODALS --- */}
      
      {editingState && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Edit2 size={18} className="text-blue-600" />
                    {t('edit_field_title')} {editingState.label}
                </h3>
                <input 
                    value={editingState.value}
                    onChange={(e) => setEditingState({...editingState, value: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 dark:text-white"
                    placeholder={editingState.label}
                    autoFocus
                />
                <div className="flex gap-3 mt-6">
                    <button onClick={saveEditing} className="flex-1 bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold text-sm hover:opacity-90">{t('save')}</button>
                    <button onClick={cancelEditing} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-3 rounded-xl font-bold text-sm">{t('cancel')}</button>
                </div>
            </div>
        </div>
      )}

      {showOptionsMenu && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowOptionsMenu(false)} />
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-xs relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-800 overflow-hidden">
                <button 
                    onClick={() => {
                        setShowOptionsMenu(false);
                        setShowDeleteConfirm(true);
                    }}
                    className="w-full p-4 text-center text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold transition-colors border-b border-gray-100 dark:border-gray-800"
                >
                    {t('account_delete_option')}
                </button>
                <button 
                    onClick={() => setShowOptionsMenu(false)}
                    className="w-full p-4 text-center text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
                >
                    {t('cancel')}
                </button>
            </div>
        </div>,
        document.body
      )}

      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-[301] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => !isDeletingAccount && setShowDeleteConfirm(false)} />
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-800">
                <div className="flex flex-col items-center text-center gap-4 pt-2">
                    <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-1 shadow-inner ring-4 ring-red-50/50 dark:ring-red-900/10">
                        <Trash2 size={36} className="text-red-600 dark:text-red-500" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">{t('delete_account_confirm_title')}</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed font-medium px-2">
                            {t('delete_account_confirm_msg')}
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 w-full mt-4">
                        <button 
                            onClick={() => setShowDeleteConfirm(false)} 
                            disabled={isDeletingAccount}
                            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 py-3.5 rounded-2xl font-bold text-base hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
                        >
                            {t('cancel')}
                        </button>
                        <button 
                            onClick={handleDeleteAccount} 
                            disabled={isDeletingAccount}
                            className="w-full bg-red-600 text-white py-3.5 rounded-2xl font-bold text-base hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-200 dark:shadow-none flex items-center justify-center"
                        >
                            {isDeletingAccount ? <Loader2 className="animate-spin" size={24} /> : t('delete_account_btn')}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
      )}

      {isAddingSection && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('add_new_section')}</h3>
                <div className="space-y-3">
                    <input type="text" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-sm font-bold" placeholder={t('section_title_label')} />
                    <textarea value={newSectionContent} onChange={(e) => setNewSectionContent(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-sm font-medium min-h-[100px] resize-none" placeholder={t('section_content_label')} />
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={saveNewSection} className="flex-1 bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold text-sm">{t('save')}</button>
                    <button onClick={() => setIsAddingSection(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-3 rounded-xl font-bold text-sm">{t('cancel')}</button>
                </div>
            </div>
        </div>
      )}

      {deleteModal.isOpen && (
           <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <div className="bg-white rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95">
                <div className="flex flex-col items-center text-center gap-4 pt-2">
                   <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-1"><Trash2 size={32} className="text-red-500" /></div>
                   <div><h3 className="text-xl font-black text-gray-900 mb-2">{t('delete')}?</h3><p className="text-gray-500 text-sm font-medium">{t('confirm')}</p></div>
                   <div className="flex gap-3 w-full mt-2">
                      <button 
                        onClick={confirmDelete} 
                        disabled={isDeleting}
                        className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-200 flex items-center justify-center"
                      >
                        {isDeleting ? <Loader2 className="animate-spin text-white" size={20} /> : t('yes')}
                      </button>
                      <button 
                        onClick={cancelDelete} 
                        disabled={isDeleting}
                        className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                      >
                        {t('no')}
                      </button>
                   </div>
                </div>
             </div>
           </div>
      )}

      {viewingShortId && (
            <div className="fixed inset-0 z-[300] bg-black">
                <button 
                    onClick={() => setViewingShortId(null)} 
                    className="absolute top-safe top-4 left-4 z-[320] p-2 bg-black/40 rounded-full text-white backdrop-blur-md hover:bg-black/60 transition-colors"
                >
                    <ArrowRight className={language === 'en' ? 'rotate-180' : ''} size={24} />
                </button>
                <ShortsView
                    initialShortId={viewingShortId}
                    isActive={true}
                    onReport={onReport}
                    onViewedInitialShort={() => {}}
                    onProfileClick={(uid) => {
                        setViewingShortId(null);
                        onClose();
                    }}
                    // Enable profile mode with preloaded list and no bottom padding
                    fromProfile={true}
                    preloadedShorts={shortsPlaylist}
                    onDelete={handleShortsViewDelete} // Passing the delete handler
                />
            </div>
      )}

    </div>
  );
};

export default ProfileView;