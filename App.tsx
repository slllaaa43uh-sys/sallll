
import React, { useState, useEffect, useRef } from 'react';
import { messaging, getToken, onMessage } from './firebase-init';
import Header from './components/Header';
import CreatePostBar from './components/CreatePostBar';
import Stories from './components/Stories';
import PostCard from './components/PostCard';
import BottomNav from './components/BottomNav';
import CreatePostModal from './components/CreatePostModal';
import CreateShortFlow from './components/CreateShortFlow';
import CreateStoryModal from './components/CreateStoryModal';
import ReportModal from './components/ReportModal';
import LocationDrawer from './components/LocationDrawer';
import JobsView from './components/JobsView';
import HarajView from './components/HarajView';
import NotificationsView, { clearNotificationsCache } from './components/NotificationsView';
import SettingsView from './components/SettingsView';
import ProfileView, { clearProfileCache } from './components/ProfileView';
import ShortsCarousel from './components/ShortsCarousel';
import ShortsView from './components/ShortsView';
import LoginPage from './components/LoginPage';
import SuggestedList, { SuggestedItem } from './components/SuggestedList';
import SuggestedUsersView from './components/SuggestedUsersView';
import PostDetailView, { clearPostDetailsCache } from './components/PostDetailView';
import VideoDetailView from './components/VideoDetailView';
import VideoUploadIndicator from './components/VideoUploadIndicator';
import PostUploadIndicator from './components/PostUploadIndicator';
import SplashScreen from './components/SplashScreen';
import WelcomeCelebration from './components/WelcomeCelebration';
import { Post } from './types';
import { API_BASE_URL } from './constants';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const [showSplash, setShowSplash] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateShortFlowOpen, setIsCreateShortFlowOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [isLocationDrawerOpen, setIsLocationDrawerOpen] = useState(false);

  useEffect(() => {
    const metaThemeColor = document.getElementById('theme-color-meta');
    const html = document.documentElement;
    if (isDarkMode) {
      html.classList.add('dark');
      html.style.backgroundColor = '#000000'; 
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#000000');
    } else {
      html.classList.remove('dark');
      html.style.backgroundColor = '#f3f4f6';
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#f3f4f6');
    }
    localStorage.setItem('darkMode', String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true });
    }
  }, []);

  useEffect(() => {
    if (token && !showSplash) {
      const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
      if (!hasSeenWelcome) {
        setTimeout(() => setShowWelcome(true), 500);
      }
    }
  }, [token, showSplash]);

  useEffect(() => {
    const initFirebaseNotifications = async () => {
      if (!token) return;
      
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          if (messaging && getToken) {
            const fcmToken = await getToken(messaging, {
              vapidKey: (import.meta as any).env.VITE_FIREBASE_VAPID_KEY
            });
            
            if (fcmToken) {
              localStorage.setItem('fcmToken', fcmToken);
              console.log('✅ FCM Token saved');
            }
            
            if (onMessage) {
              onMessage(messaging, (payload: any) => {
                if (payload.notification) {
                  new Notification(payload.notification.title || 'إشعار جديد', {
                    body: payload.notification.body,
                    icon: '/logo.png'
                  });
                }
              });
            }
          }
        }
      } catch (error) {
        console.error('خطأ في Firebase:', error);
      }
    };
    
    setTimeout(initFirebaseNotifications, 1000);
  }, [token]);

  // --- Notification Polling Logic ---
  useEffect(() => {
    if (!token) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/notifications/unread-count`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUnreadNotificationsCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error("Failed to fetch unread count", error);
      }
    };

    // Fetch immediately
    fetchUnreadCount();

    // Poll every 30 seconds
    const intervalId = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(intervalId);
  }, [token]);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('hasSeenWelcome', 'true');
  };

  const toggleDarkMode = () => {
    document.documentElement.classList.add('disable-transitions');
    setIsDarkMode(prev => !prev);
    window.setTimeout(() => document.documentElement.classList.remove('disable-transitions'), 0);
  };
  
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [initialShortId, setInitialShortId] = useState<string | null>(null);
  const [initialShortsFilter, setInitialShortsFilter] = useState<'forYou' | 'haraj' | 'jobs' | 'friends'>('forYou');
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [suggestedViewType, setSuggestedViewType] = useState<'company' | 'person' | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);
  const [storiesRefreshKey, setStoriesRefreshKey] = useState(0);
  const [reportData, setReportData] = useState<{isOpen: boolean; type: 'post' | 'comment' | 'reply' | 'video'; id: string; name: string;}>({ isOpen: false, type: 'post', id: '', name: '' });
  const [isReporting, setIsReporting] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [suggestedPeople, setSuggestedPeople] = useState<SuggestedItem[]>([]);
  const [suggestedCompanies, setSuggestedCompanies] = useState<SuggestedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Pending States with detailed error tracking
  const [pendingPost, setPendingPost] = useState<Post | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'publishing' | 'success' | 'error'>('publishing');
  const [postErrorMsg, setPostErrorMsg] = useState<string>('');

  const [videoUploadState, setVideoUploadState] = useState<{
    isActive: boolean;
    status: 'compressing' | 'uploading' | 'success' | 'error';
    progress: number;
    thumbnail: string | null;
    errorMsg?: string;
  }>({ isActive: false, status: 'compressing', progress: 0, thumbnail: null });

  // Story Upload State & Preview
  const [isUploadingStory, setIsUploadingStory] = useState(false);
  const [storyUploadProgress, setStoryUploadProgress] = useState(0); // Added for progress bar
  const [pendingStory, setPendingStory] = useState<{ type: 'text'|'image'|'video', content: string, color?: string } | null>(null);

  const [currentLocation, setCurrentLocation] = useState<{ country: string; city: string | null }>({ country: 'عام', city: null });

  // --- COMPREHENSIVE LOGOUT HANDLER ---
  const handleLogout = () => {
    // 1. Clear Global Caches (Fixes stale data issues)
    clearNotificationsCache();
    clearProfileCache();
    clearPostDetailsCache();

    // 2. Clear Local Storage Authentication Data
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userAvatar');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('username');
    // Note: We keep 'darkMode' and 'app_language' as they are device preferences

    // 3. Reset UI States (Fixes staying in Settings/Notifications after relogin)
    setIsSettingsOpen(false);
    setIsNotificationsOpen(false);
    setViewingProfileId(null);
    setSelectedNotification(null);
    setSuggestedViewType(null);
    setActiveTab('home'); // Reset navigation to Home
    
    // 4. Clear Data States to force refresh on next login
    setPosts([]); 
    setUnreadNotificationsCount(0);
    setIsLoading(true); // CRITICAL FIX: Reset loading state so skeletons appear on next login

    // 5. Trigger UI update to show Login Page
    setToken(null);
  };

  const handleLocationSelect = (country: string, city: string | null) => setCurrentLocation({ country, city });
  const handleSetActiveTab = (newTab: string) => activeTab !== newTab && setActiveTab(newTab);
  const handleOpenProfile = (userId: string | null = null) => setViewingProfileId(userId || 'me');
  const handleReport = (type: 'post' | 'comment' | 'reply' | 'video', id: string, name: string) => setReportData({ isOpen: true, type, id, name });

  const handleSubmitReport = async (reason: string) => {
    const token = localStorage.getItem('token');
    if (!token) { alert("يرجى تسجيل الدخول للإبلاغ."); return; }
    setIsReporting(true);
    try {
        // FIX: Map 'video' to 'post' as Shorts are stored as Posts in the backend
        const typeToSend = reportData.type === 'video' ? 'post' : reportData.type;

        const payload = { 
            reportType: typeToSend, 
            targetId: reportData.id, 
            reason: reason, 
            details: reason, 
            media: [], 
            loadingDate: null, 
            unloadingDate: null 
        };
        const response = await fetch(`${API_BASE_URL}/api/v1/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            alert(t('post_report_success'));
            setReportData(prev => ({ ...prev, isOpen: false }));
        } else {
            alert("فشل إرسال البلاغ.");
        }
    } catch (error) { alert("حدث خطأ في الاتصال."); }
    finally { setIsReporting(false); }
  };

  const mapApiPostToUI = (apiPost: any): Post => {
    let locationString = 'عام';
    if (apiPost.scope === 'local' && apiPost.country) {
      locationString = apiPost.city && apiPost.city !== 'كل المدن' ? `${apiPost.country} | ${apiPost.city}` : apiPost.country;
    }
    const currentUserId = localStorage.getItem('userId');
    const reactions = Array.isArray(apiPost.reactions) ? apiPost.reactions : [];
    const isLiked = reactions.some((r: any) => String(r.user?._id || r.user || r) === String(currentUserId));

    // Handle Nested Original Post
    let originalPost: Post | undefined = undefined;
    if (apiPost.originalPost) {
      originalPost = mapApiPostToUI(apiPost.originalPost);
    }

    // --- TIME FORMATTING (Facebook Style) ---
    const getRelativeTime = (dateStr: string) => {
        if (!dateStr) return 'الآن';
        const date = new Date(dateStr);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'الآن';
        
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} د`; // Minutes
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} س`; // Hours
        
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days} يوم`; // Days
        
        const months = Math.floor(days / 30);
        if (months < 12) return `${months} شهر`; // Months
        
        const years = Math.floor(months / 12);
        return `${years} سنة`; // Years
    };

    // --- TITLE FILTERING (Hide "Looking for job/employee" titles) ---
    let displayTitle = apiPost.title;
    const hiddenTitles = ['ابحث عن وظيفة', 'أبحث عن وظيفة', 'ابحث عن موظفين', 'أبحث عن موظفين'];
    // Check if title matches any of the hidden titles (ignoring whitespace)
    if (displayTitle && hiddenTitles.some(ht => ht === displayTitle.trim())) {
        displayTitle = undefined;
    }

    return {
      id: apiPost._id || apiPost.id || Math.random().toString(36).substr(2, 9),
      user: {
        id: apiPost.user?._id || 'u_unknown',
        _id: apiPost.user?._id, 
        name: apiPost.user?.name || 'مستخدم', 
        avatar: apiPost.user?.avatar ? (apiPost.user.avatar.startsWith('http') ? apiPost.user.avatar : `${API_BASE_URL}${apiPost.user.avatar}`) : null, 
      },
      // Apply the new relative time formatter
      timeAgo: apiPost.createdAt ? getRelativeTime(apiPost.createdAt) : 'الآن',
      createdAt: apiPost.createdAt, // Pass raw date for dynamic recalculation
      content: apiPost.text || apiPost.content || '',
      image: apiPost.media && apiPost.media.length > 0 ? (apiPost.media[0].url.startsWith('http') ? apiPost.media[0].url : `${API_BASE_URL}${apiPost.media[0].url}`) : undefined,
      media: apiPost.media ? apiPost.media.map((m: any) => ({ url: m.url.startsWith('http') ? m.url : `${API_BASE_URL}${m.url}`, type: m.type, thumbnail: m.thumbnail })) : [],
      likes: reactions.filter((r: any) => !r.type || r.type === 'like').length,
      comments: apiPost.comments?.length || 0,
      shares: apiPost.shares?.length || 0,
      repostsCount: apiPost.repostsCount || 0,
      jobStatus: apiPost.jobStatus || 'open',
      // Use the filtered title
      title: displayTitle,
      type: apiPost.type,
      location: locationString,
      country: apiPost.country, // Pass raw country
      city: apiPost.city,       // Pass raw city
      category: apiPost.category,
      isFeatured: apiPost.isFeatured,
      contactPhone: apiPost.contactPhone,
      contactEmail: apiPost.contactEmail,
      contactMethods: apiPost.contactMethods,
      isLiked,
      reactions,
      isShort: apiPost.isShort || false,
      originalPost, // Included recursively mapped post
    };
  };

  const uploadFiles = async (files: File[]) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/v1/upload/multiple`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.msg || 'فشل رفع الملفات');
    }
    const result = await response.json();
    return result.files;
  };

  const handlePostSubmit = async (postPayload: any) => {
    // Extract promotionType to handle separately
    const promotionType = postPayload.promotionType;
    // Remove it from the main payload to avoid confusion or if backend doesn't support it directly
    const payloadToSend = { ...postPayload };
    delete payloadToSend.promotionType;

    if (postPayload.isShort && postPayload.rawVideoFile) {
        setIsCreateShortFlowOpen(false);
        setActiveTab('home');
        const previewThumb = postPayload.rawCoverFile ? URL.createObjectURL(postPayload.rawCoverFile) : null;
        setVideoUploadState({ isActive: true, status: 'compressing', progress: 0, thumbnail: previewThumb });

        const performBackgroundShortUpload = async () => {
             try {
                await new Promise(resolve => setTimeout(resolve, 1500));
                setVideoUploadState(prev => ({ ...prev, status: 'uploading', progress: 5 }));
                
                const filesToUpload: File[] = [postPayload.rawVideoFile];
                if (postPayload.rawCoverFile) filesToUpload.push(postPayload.rawCoverFile);
                if (postPayload.rawVoiceoverFile) filesToUpload.push(postPayload.rawVoiceoverFile);
                
                const interval = setInterval(() => {
                    setVideoUploadState(prev => {
                       if (prev.progress >= 90) return prev;
                       return { ...prev, progress: prev.progress + (Math.random() * 5) };
                    });
                }, 400);

                const uploadedFiles = await uploadFiles(filesToUpload);
                clearInterval(interval);
                setVideoUploadState(prev => ({ ...prev, progress: 100 }));

                // FIX: More robust video detection for recorded blobs (WebM)
                let videoResult = uploadedFiles.find((f: any) => f.fileType === 'video');
                
                if (!videoResult) {
                    // Fallback: Check extensions if fileType isn't set correctly
                    videoResult = uploadedFiles.find((f: any) => 
                        f.filePath.match(/\.(mp4|webm|mov|avi|mkv)$/i)
                    );
                }

                // Fallback 2: If we uploaded files but can't ID video, assume the non-image one is video
                if (!videoResult && uploadedFiles.length > 0) {
                    if (postPayload.rawCoverFile) {
                        videoResult = uploadedFiles.find((f: any) => f.fileType !== 'image');
                    } else if (uploadedFiles.length >= 1) {
                        // Just grab the largest file usually the video
                        videoResult = uploadedFiles[0]; 
                    }
                }

                const coverResult = uploadedFiles.find((f: any) => f.fileType === 'image');
                const voiceoverResult = uploadedFiles.find((f: any) => f.fileType === 'audio' || f.originalName === 'voiceover.webm');
                
                if (!videoResult) throw new Error("لم يتم العثور على رابط الفيديو المرفوع");

                const finalPayload = {
                    ...payloadToSend, // Use clean payload
                    media: [{ url: videoResult.filePath, type: 'video', thumbnail: coverResult ? coverResult.filePath : null }],
                    // Use expanded fields for backend as requested
                    textOverlays: postPayload.videoOverlays?.texts || [],
                    stickerOverlays: postPayload.videoOverlays?.stickers || [],
                    videoFilter: postPayload.videoOverlays?.filter || 'none',
                    audioSettings: postPayload.videoOverlays?.audioSettings || { isMuted: false, volume: 100 },
                    voiceover: voiceoverResult ? { url: voiceoverResult.filePath } : null,
                    // New fields for hashtags, mentions, link, and promotion
                    hashtags: postPayload.hashtags,
                    mentions: postPayload.mentions,
                    websiteLink: postPayload.websiteLink,
                    promotion: postPayload.promotion,
                    // Remove raw fields
                    videoOverlays: undefined,
                    rawVideoFile: undefined, rawCoverFile: undefined, rawVoiceoverFile: undefined, tempVideoUrl: undefined
                };

                const response = await fetch(`${API_BASE_URL}/api/v1/posts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify(finalPayload)
                });

                if (response.ok) {
                    setVideoUploadState(prev => ({ ...prev, status: 'success' }));
                    setTimeout(() => setVideoUploadState(prev => ({ ...prev, isActive: false })), 4000);
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || errorData.msg || "فشل الخادم في إنشاء المنشور");
                }
             } catch (error: any) {
                 setVideoUploadState(prev => ({ ...prev, status: 'error', errorMsg: error.message }));
                 setTimeout(() => setVideoUploadState(prev => ({ ...prev, isActive: false })), 10000);
             }
        };
        performBackgroundShortUpload();
        return; 
    }

    // --- NORMAL POST ---
    const tempPost: Post = {
        id: 'temp-pending',
        user: { id: localStorage.getItem('userId') || 'me', _id: localStorage.getItem('userId') || 'me', name: localStorage.getItem('userName') || 'مستخدم', avatar: localStorage.getItem('userAvatar') || undefined },
        timeAgo: 'الآن', content: postPayload.content || postPayload.text || '', likes: 0, comments: 0, shares: 0,
        image: postPayload.rawMedia?.[0] ? URL.createObjectURL(postPayload.rawMedia[0]) : (postPayload.media?.[0]?.url),
        media: postPayload.rawMedia ? postPayload.rawMedia.map((f: File) => ({ url: URL.createObjectURL(f), type: f.type.startsWith('video') ? 'video' : 'image' })) : []
    };

    setPendingPost(tempPost); setPendingStatus('publishing'); setPostErrorMsg('');
    setIsCreateModalOpen(false); setActiveTab('home');             
    
    const performBackgroundUpload = async () => {
      try {
        let finalPayload = { ...payloadToSend }; // Use clean payload
        if (postPayload.rawMedia?.length > 0) {
            const uploaded = await uploadFiles(postPayload.rawMedia);
            finalPayload.media = uploaded.map((f: any) => ({ url: f.filePath, type: f.fileType }));
            delete finalPayload.rawMedia;
        }
        const response = await fetch(`${API_BASE_URL}/api/v1/posts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify(finalPayload)
        });
        
        if (response.ok) {
          const data = await response.json();
          // Extract postId
          const post = data.post || data; 
          const postId = post._id || post.id;

          // --- PROMOTION HANDLER (NEW API) ---
          if (postId && promotionType) {
              try {
                  await fetch(`${API_BASE_URL}/api/payment/promote/${postId}`, {
                      method: 'POST',
                      headers: { 
                          'Content-Type': 'application/json', 
                          'Authorization': `Bearer ${localStorage.getItem('token')}` 
                      },
                      body: JSON.stringify({ promotionType: promotionType })
                  });
              } catch (promoError) {
                  console.error("Promotion failed:", promoError);
                  // Don't fail the whole post if promotion fails, just log
              }
          }

          setPendingStatus('success');
          setTimeout(() => setPendingPost(null), 3000); 
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.msg || "فشل النشر من الخادم");
        }
      } catch (error: any) {
        setPendingStatus('error');
        setPostErrorMsg(error.message);
        setTimeout(() => setPendingPost(null), 10000);
      }
    };
    performBackgroundUpload();
  };

  const handleStoryPost = async (storyPayload: any) => {
      // 1. Close Modal IMMEDIATELY
      setIsCreateStoryOpen(false);
      
      // 2. Set Upload State IMMEDIATELY
      setIsUploadingStory(true);
      setStoryUploadProgress(0); // Initialize Progress
      
      // 3. Set Preview IMMEDIATELY (even for videos)
      if (storyPayload.type === 'text') {
          setPendingStory({ type: 'text', content: storyPayload.text, color: storyPayload.backgroundColor });
      } else if (storyPayload.file) {
          const file = storyPayload.file;
          const url = URL.createObjectURL(file);
          const type = file.type.startsWith('video') ? 'video' : 'image';
          setPendingStory({ type, content: url });
      }

      // 4. Force Stories component to re-render to show the pending bubble
      setStoriesRefreshKey(prev => prev + 1);

      // Simulated Progress Logic
      const progressInterval = setInterval(() => {
          setStoryUploadProgress(prev => {
              if (prev >= 90) return prev;
              return prev + (Math.random() * 5); // Increment slowly
          });
      }, 300);

      // 5. Start Background Upload
      try {
          const token = localStorage.getItem('token');
          const formData = new FormData();

          if (storyPayload.type === 'text') {
              formData.append('text', storyPayload.text || '');
              if (storyPayload.backgroundColor) {
                  formData.append('backgroundColor', storyPayload.backgroundColor);
              }
          } else if (storyPayload.type === 'media' && storyPayload.file) {
              // Append file directly
              formData.append('file', storyPayload.file);
              
              // Optional text/caption
              if (storyPayload.text) {
                  formData.append('text', storyPayload.text);
              }

              // Trim Data (Critical Fix)
              if (storyPayload.trimData) {
                  formData.append('trimStart', storyPayload.trimData.start.toString());
                  formData.append('trimEnd', storyPayload.trimData.end.toString());
              }

              // NEW FIELDS FOR EDITS
              if (storyPayload.overlays && storyPayload.overlays.length > 0) {
                  formData.append('overlays', JSON.stringify(storyPayload.overlays));
              }
              if (storyPayload.filter) {
                  formData.append('filter', storyPayload.filter);
              }
              if (storyPayload.mediaScale) {
                  formData.append('mediaScale', storyPayload.mediaScale.toString());
              }
              if (storyPayload.objectFit) {
                  formData.append('objectFit', storyPayload.objectFit);
              }
          }

          const response = await fetch(`${API_BASE_URL}/api/v1/stories`, {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${token}`
                  // No Content-Type header so browser sets multipart/form-data boundary
              },
              body: formData
          });

          clearInterval(progressInterval); // Stop simulation

          if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.message || errorData.msg || "Story creation failed");
          }
          
          setStoryUploadProgress(100); // Complete

      } catch (error: any) {
          console.error(error);
          alert(error.message || t('story_upload_error'));
          clearInterval(progressInterval);
          setStoryUploadProgress(0);
      } finally {
          setIsUploadingStory(false);
          setPendingStory(null); 
          setStoriesRefreshKey(prev => prev + 1); // Refresh to show real story
      }
  };

  const handleOpenNotifications = () => { setIsNotificationsOpen(true); setUnreadNotificationsCount(0); };

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const countryParam = currentLocation.country === 'عام' ? '' : encodeURIComponent(currentLocation.country);
        const cityParam = currentLocation.city ? encodeURIComponent(currentLocation.city) : '';
        const postsRes = await fetch(`${API_BASE_URL}/api/v1/posts?country=${countryParam}&city=${cityParam}`, { headers });
        if (postsRes.ok) {
          const postsData = await postsRes.json();
          const postsArray = postsData.posts || postsData;
          if (Array.isArray(postsArray)) {
            const currentUserId = localStorage.getItem('userId');
            const feedPosts = postsArray.filter((p: any) => !p.isShort).map(mapApiPostToUI).filter((post: Post) => post.user._id !== currentUserId).sort((a: Post, b: Post) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
            setPosts(feedPosts);
          }
        }
        const usersRes = await fetch(`${API_BASE_URL}/api/v1/users?limit=1000`, { headers });
        if(usersRes.ok) {
          const data = await usersRes.json();
          if (data.users) {
            setSuggestedPeople(data.users.filter((u: any) => u.userType === 'individual').map((u:any)=>({id:u._id, name:u.name, subtitle:u.email, avatar:u.avatar?(u.avatar.startsWith('http')?u.avatar:`${API_BASE_URL}${u.avatar}`):null})));
            setSuggestedCompanies(data.users.filter((u: any) => u.userType === 'company').map((u:any)=>({id:u._id, name:u.name, subtitle:u.email, avatar:u.avatar?(u.avatar.startsWith('http')?u.avatar:`${API_BASE_URL}${u.avatar}`):null})));
          }
        }
      } catch (error) { console.error(error); }
      finally { setIsLoading(false); }
    };
    fetchData();
  }, [token, currentLocation]);

  if (showSplash) return <SplashScreen />;
  if (!token) return <LoginPage onLoginSuccess={setToken} />;

  const isAnyModalOpen = isCreateModalOpen || isCreateShortFlowOpen || isCreateStoryOpen || reportData.isOpen || isLocationDrawerOpen;
  const isHomeActive = activeTab === 'home' && !viewingProfileId && !isSettingsOpen && !isNotificationsOpen && !selectedNotification && !suggestedViewType && !isAnyModalOpen;
  const isShortsActive = activeTab === 'shorts' && !viewingProfileId && !isSettingsOpen && !isAnyModalOpen;

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-black max-w-md mx-auto shadow-2xl overflow-hidden relative transition-colors duration-200">
      {showWelcome && <WelcomeCelebration onClose={handleCloseWelcome} />}
      {videoUploadState.isActive && (
        <VideoUploadIndicator status={videoUploadState.status} progress={videoUploadState.progress} thumbnail={videoUploadState.thumbnail} errorMessage={videoUploadState.errorMsg} />
      )}
      {pendingPost && !pendingPost.isShort && (
         <PostUploadIndicator status={pendingStatus} contentPreview={pendingPost.content} errorMessage={postErrorMsg} />
      )}
      {isCreateModalOpen && <CreatePostModal onClose={() => setIsCreateModalOpen(false)} onPostSubmit={handlePostSubmit} />}
      {isCreateShortFlowOpen && <CreateShortFlow onClose={() => setIsCreateShortFlowOpen(false)} onPostSubmit={handlePostSubmit} />}
      {isCreateStoryOpen && <CreateStoryModal onClose={() => setIsCreateStoryOpen(false)} onPost={handleStoryPost} />}
      <ReportModal isOpen={reportData.isOpen} onClose={() => setReportData(prev => ({ ...prev, isOpen: false }))} onSubmit={handleSubmitReport} targetName={reportData.name} targetType={reportData.type} isSubmitting={isReporting} />
      {isLocationDrawerOpen && <LocationDrawer onClose={() => setIsLocationDrawerOpen(false)} onSelect={handleLocationSelect} />}
      {viewingProfileId && <ProfileView userId={viewingProfileId === 'me' ? undefined : viewingProfileId} onClose={() => setViewingProfileId(null)} onReport={handleReport} onLogout={handleLogout} />}
      {isSettingsOpen && <SettingsView onClose={() => setIsSettingsOpen(false)} onProfileClick={() => handleOpenProfile('me')} onLogout={handleLogout} isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />}
      {suggestedViewType && <SuggestedUsersView initialTab={suggestedViewType === 'company' ? 'companies' : 'individuals'} people={suggestedPeople} companies={suggestedCompanies} onBack={() => setSuggestedViewType(null)} isLoading={isLoading} onProfileClick={handleOpenProfile} />}
      {isNotificationsOpen && <div className="absolute inset-0 z-50 bg-white"><NotificationsView onClose={() => setIsNotificationsOpen(false)} onNotificationClick={setSelectedNotification} onProfileClick={handleOpenProfile} /></div>}
      {selectedNotification && selectedNotification.category === 'post' && <PostDetailView notification={selectedNotification} onBack={() => setSelectedNotification(null)} />}
      {selectedNotification && selectedNotification.category === 'video' && <VideoDetailView notification={selectedNotification} onBack={() => setSelectedNotification(null)} onReport={handleReport} />}
      <div className="flex flex-col h-screen">
        <main className="flex-1 overflow-hidden relative">
          <div className={`view ${activeTab === 'home' ? 'active' : ''}`}>
            {/* Added native-scroll class here */}
            <div className={`h-full native-scroll no-scrollbar ${!isFullScreen ? 'pb-20' : ''}`}>
              {!isFullScreen && (
                <div className="bg-white shadow-sm mb-2">
                  <Header currentLocation={currentLocation} onLocationClick={() => setIsLocationDrawerOpen(true)} onNotificationsClick={handleOpenNotifications} onSettingsClick={() => setIsSettingsOpen(true)} onDiscoveryClick={() => {}} unreadCount={unreadNotificationsCount} />
                  <CreatePostBar onOpen={() => setIsCreateModalOpen(true)} />
                </div>
              )}
              <Stories 
                  onCreateStory={() => setIsCreateStoryOpen(true)} 
                  refreshKey={storiesRefreshKey} 
                  isUploading={isUploadingStory}
                  uploadProgress={storyUploadProgress}
                  pendingStory={pendingStory} 
              />
              {isLoading ? (
                <div className="flex flex-col mt-2">{[1, 2, 3].map(i => <div key={i} className="bg-white mb-3 shadow-sm py-4 px-4 relative overflow-hidden"><div className="animate-pulse flex flex-col gap-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gray-200 shrink-0"></div><div className="flex-1 space-y-2"><div className="h-2.5 bg-gray-200 rounded w-1/4"></div><div className="h-2 bg-gray-100 rounded w-1/6"></div></div></div><div className="space-y-3 pt-2"><div className="h-2.5 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded-full w-full"></div><div className="h-2.5 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded-full w-[95%]"></div><div className="h-2.5 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded-full w-[90%]"></div><div className="h-2.5 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded-full w-[60%]"></div></div></div></div>)}</div>
              ) : (
                <>
                  <div className="flex flex-col gap-1 mt-2">
                    {posts.slice(0, 2).map(post => <PostCard key={post.id} post={post} onReport={handleReport} onProfileClick={handleOpenProfile} isActive={isHomeActive} />)}
                    {posts.length > 1 && <ShortsCarousel onShortClick={id => { setInitialShortId(id); setActiveTab('shorts'); }} title={t('shorts_for_you')} filterType="forYou" />}
                    {posts.slice(2, 4).map(post => <PostCard key={post.id} post={post} onReport={handleReport} onProfileClick={handleOpenProfile} isActive={isHomeActive} />)}
                    {posts.slice(4).map(post => <PostCard key={post.id} post={post} onReport={handleReport} onProfileClick={handleOpenProfile} isActive={isHomeActive} />)}
                  </div>
                  {posts.length > 0 ? <div className="p-4 text-center text-gray-400 text-sm"><p>{t('no_more_posts')}</p></div> : <div className="p-10 text-center text-gray-400 flex flex-col items-center"><p>{t('no_posts_home')}</p><button onClick={() => setIsCreateModalOpen(true)} className="mt-4 text-blue-600 font-bold text-sm">{t('be_first_post')}</button></div>}
                </>
              )}
            </div>
          </div>
          <div className={`view ${activeTab === 'jobs' ? 'active' : ''}`}>
             {/* Added native-scroll class here */}
             <div className={`h-full native-scroll no-scrollbar ${!isFullScreen ? 'pb-20' : ''}`}>
                <JobsView onFullScreenToggle={setIsFullScreen} currentLocation={currentLocation} onLocationClick={() => setIsLocationDrawerOpen(true)} onReport={handleReport} onProfileClick={handleOpenProfile} />
             </div>
          </div>
          <div className={`view ${activeTab === 'haraj' ? 'active' : ''}`}>
             {/* Added native-scroll class here */}
             <div className={`h-full native-scroll no-scrollbar ${!isFullScreen ? 'pb-20' : ''}`}>
                <HarajView onFullScreenToggle={setIsFullScreen} currentLocation={currentLocation} onLocationClick={() => setIsLocationDrawerOpen(true)} onReport={handleReport} onProfileClick={handleOpenProfile} />
             </div>
          </div>
          <div className={`view ${activeTab === 'shorts' ? 'active' : ''}`} style={{ backgroundColor: 'black', zIndex: activeTab === 'shorts' ? 50 : 0 }}><div className="h-full overflow-hidden"><ShortsView key={initialShortId ? `short-${initialShortId}` : 'shorts-feed'} initialShortId={initialShortId} initialCategory={initialShortsFilter} onViewedInitialShort={()=>{}} isActive={isShortsActive} onReport={handleReport} onProfileClick={handleOpenProfile} /></div></div>
        </main>
        {!isFullScreen && !isSettingsOpen && !viewingProfileId && !isNotificationsOpen && !selectedNotification && !suggestedViewType && <BottomNav activeTab={activeTab} setActiveTab={handleSetActiveTab} onOpenCreate={() => setIsCreateShortFlowOpen(true)} />}
      </div>
    </div>
  );
};

const App: React.FC = () => <LanguageProvider><AppContent /></LanguageProvider>;
export default App;
