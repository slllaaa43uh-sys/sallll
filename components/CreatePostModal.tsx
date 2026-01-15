
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Edit3, Film, ArrowRight, SwitchCamera, Image as ImageIcon, 
  MapPin, Globe, ChevronDown, Store, Briefcase, Tag, PlayCircle, Plus,
  ChevronUp, Camera, Video, ChevronLeft, Phone, Mail, MessageCircle, Star, Check, Eye, Loader2,
  Clock, Calendar, Crown, Coins
} from 'lucide-react';
import { HARAJ_CATEGORIES, JOB_CATEGORIES } from '../data/categories';
import { ARAB_LOCATIONS, getDisplayLocation } from '../data/locations';
import { API_BASE_URL } from '../constants';
import Avatar from './Avatar';
import { useLanguage } from '../contexts/LanguageContext';

interface CreatePostModalProps {
  onClose: () => void;
  onPostSubmit: (payload: any) => Promise<void>;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ onClose, onPostSubmit }) => {
  const { t, language } = useLanguage();
  // User Data
  const userName = localStorage.getItem('userName') || 'مستخدم';
  const userAvatar = localStorage.getItem('userAvatar');
  const avatarSrc = userAvatar ? (userAvatar.startsWith('http') ? userAvatar : `${API_BASE_URL}${userAvatar}`) : null;

  // Navigation State
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<'composer' | 'camera'>('composer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // --- COMPOSER STATE (Step 1) ---
  const [text, setText] = useState('');
  const [mediaFiles, setMediaFiles] = useState<{ url: string, type: 'image' | 'video' }[]>([]);
  const [mediaFileObjects, setMediaFileObjects] = useState<File[]>([]);
  const [location, setLocation] = useState<string | null>(null); // Old simple location
  const [isLocating, setIsLocating] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // --- POST SETTINGS STATE (Step 2) ---
  const [scope, setScope] = useState<'local' | 'global'>('local');
  const [selectedCountry, setSelectedCountry] = useState<string>(''); // Stores ARABIC Name
  const [selectedCity, setSelectedCity] = useState<string>('');       // Stores ARABIC Name
  
  // Location Selection Drawers State
  const [isCountryDrawerOpen, setIsCountryDrawerOpen] = useState(false);
  const [isCityDrawerOpen, setIsCityDrawerOpen] = useState(false);

  const [publishScope, setPublishScope] = useState<'home_and_category' | 'category_only'>('home_and_category');
  const [jobType, setJobType] = useState<'employer' | 'seeker'>('employer');
  
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMethods, setContactMethods] = useState<{whatsapp: boolean, call: boolean, email: boolean}>({
    whatsapp: true,
    call: true,
    email: false
  });
  
  // PREMIUM (FEATURED) STATE
  const [isPremium, setIsPremium] = useState(false);
  const [isPremiumDrawerOpen, setIsPremiumDrawerOpen] = useState(false);
  // UPDATED: Values mapped to new API: 'free', 'weekly', 'monthly'
  const [promotionType, setPromotionType] = useState<'free' | 'weekly' | 'monthly' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- CAMERA STATE ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');


  // --- LOGIC ---

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsDrawerOpen(false);

      const newFileObjects = Array.from(e.target.files);
      const newMediaURLs = newFileObjects.map((file: File) => ({
        url: URL.createObjectURL(file),
        type: file.type.startsWith('video') ? 'video' as const : 'image' as const
      }));
      setMediaFileObjects(prev => [...prev, ...newFileObjects]);
      setMediaFiles(prev => [...prev, ...newMediaURLs]);
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaFileObjects(prev => prev.filter((_, i) => i !== index));
  };

  const handleAutoLocation = () => {
    setIsDrawerOpen(false);
    setIsLocating(true);

    if (!("geolocation" in navigator)) {
      alert("Browser does not support geolocation.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=${language}`
          );
          const data = await response.json();
          
          if (data && data.address) {
             const addr = data.address;
             const country = addr.country || '';
             const city = addr.city || addr.town || addr.village || addr.state || '';
             const district = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || '';
             
             const formattedLocation = [country, city, district].filter(Boolean).join(', ');
             setLocation(formattedLocation || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          } else {
             setLocation("Current Location");
          }
        } catch (error) {
          console.error("Geocoding error:", error);
          setLocation("Current Location");
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        if (error.code === 1) { // Permission Denied
            alert("يرجى تفعيل إذن الموقع من إعدادات المتصفح أو الجهاز لاستخدام هذه الميزة.");
        } else {
            alert("فشل تحديد الموقع.");
        }
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCategorySelect = (catName: string, type: 'haraj' | 'job') => {
    // Keep internal category value in Arabic for DB consistency, but logic can use translated display
    setCategory(`${type === 'haraj' ? t('nav_haraj') : t('nav_jobs')}: ${catName}`);
    setIsDrawerOpen(false);
  };

  const handleNext = () => {
    if (!category) {
      alert(t('post_category') + " required");
      setIsDrawerOpen(true); 
      return;
    }
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleFinalPost = async () => {
    const isJobPost = category?.startsWith(t('nav_jobs'));
    
    try {
      const activeContactMethods = Object.entries(contactMethods)
        .filter(([, value]) => value)
        .map(([key]) => {
          if (key === 'whatsapp') return 'واتساب';
          if (key === 'call') return 'اتصال';
          if (key === 'email') return 'بريد إلكتروني';
          return null;
        })
        .filter(Boolean) as string[];
  
      let finalTitle = '';

      // Set title based on Job Type
      if (isJobPost) {
          if (jobType === 'seeker') {
              finalTitle = 'ابحث عن وظيفة';
          } else {
              finalTitle = 'ابحث عن موظفين';
          }
      }

      // Always send 'كل المدن' in Arabic if selected 'All Cities'
      const cityToSend = selectedCity === 'All Cities' ? 'كل المدن' : selectedCity;

      // 1. Determine Type based on Category
      let type = 'general';
      if (category?.startsWith(t('nav_jobs'))) {
          type = 'job';
      } else if (category?.startsWith(t('nav_haraj'))) {
          type = 'haraj';
      }

      // 2. Determine Display Page based on Publish Scope
      let displayPage = 'all';
      if (publishScope === 'category_only') {
          if (type === 'job') displayPage = 'jobs';
          else if (type === 'haraj') displayPage = 'haraj';
          else displayPage = 'home'; // Fallback
      }

      const postPayload = {
        content: text,
        type: type,
        isFeatured: isPremium,
        promotionType: promotionType, // New field for promotion logic
        displayPage: displayPage,
        category: category ? category.split(': ')[1] : null, 
        media: [], 
        rawMedia: mediaFileObjects, 
        scope: scope,
        country: scope === 'local' ? selectedCountry : null, // Arabic
        city: scope === 'local' ? (cityToSend || 'كل المدن') : null, // Arabic
        contactPhone: contactPhone,
        contactEmail: contactEmail,
        contactMethods: activeContactMethods, 
        isShort: false, 
        title: finalTitle,
        location: location || undefined,
      };
  
      onPostSubmit(postPayload);
  
    } catch (e) {
      console.error("Submission error in modal", e);
      alert('Failed to prepare post.');
    }
  };


  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  const toggleContactMethod = (method: 'whatsapp' | 'call' | 'email') => {
      setContactMethods(prev => ({...prev, [method]: !prev[method]}));
  };
  
  // --- PREMIUM LOGIC ---
  const handlePremiumClick = () => {
      setIsPremiumDrawerOpen(true);
  };

  const selectPromotionType = (type: 'free' | 'weekly' | 'monthly') => {
      setPromotionType(type);
      setIsPremium(true);
      setIsPremiumDrawerOpen(false);
  };

  const getPremiumLabel = () => {
      if (!isPremium) return t('premium_subtitle');
      if (promotionType === 'free') return t('premium_24h');
      if (promotionType === 'weekly') return t('premium_1w');
      if (promotionType === 'monthly') return t('premium_1m');
      return t('post_premium');
  };

  // --- CAMERA LOGIC ---
  useEffect(() => {
    if (mode === 'camera') {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: cameraFacingMode }, 
            audio: true 
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
            setMode('composer'); 
        }
      };
      startCamera();
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [mode, cameraFacingMode]);

  const toggleCamera = () => {
    setCameraFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Helper to display current selection in UI
  const getSelectedCountryDisplay = () => {
      if (!selectedCountry) return t('location_select_country');
      const data = getDisplayLocation(selectedCountry, null, language as 'ar'|'en');
      return data.countryDisplay;
  };

  const getSelectedCityDisplay = () => {
      if (!selectedCity) return t('location_select_city_opt');
      if (selectedCity === 'All Cities' || selectedCity === 'كل المدن') return t('location_all_cities');
      const data = getDisplayLocation(selectedCountry, selectedCity, language as 'ar'|'en');
      return data.cityDisplay;
  };


  // --- RENDER: CAMERA MODE ---
  if (mode === 'camera') {
    return (
      <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-center pt-safe">
           <button onClick={onClose} className="p-2 bg-black/30 rounded-full backdrop-blur-md">
             <X size={24} />
           </button>
        </div>
        <div className="flex-1 relative overflow-hidden bg-gray-900">
           <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-20 p-6 pb-safe flex items-center justify-between">
            <button className="flex flex-col items-center gap-1 opacity-80 hover:opacity-100">
               <div className="w-10 h-10 border border-white/30 rounded-lg flex items-center justify-center bg-black/40 backdrop-blur-md">
                 <ImageIcon size={20} />
               </div>
            </button>
            <button 
              onClick={() => setIsRecording(!isRecording)}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center"
            >
               <div className={`rounded-full transition-all duration-300 ${isRecording ? 'w-8 h-8 bg-red-600 rounded-md' : 'w-16 h-16 bg-red-600'}`}></div>
            </button>
            <button onClick={toggleCamera} className="flex flex-col items-center gap-1 opacity-80 hover:opacity-100">
               <div className="w-10 h-10 border border-white/30 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md">
                 <SwitchCamera size={20} />
               </div>
            </button>
        </div>
      </div>
    );
  }

  // --- RENDER: COMPOSER (Step 1) ---
  if (step === 1) {
      return (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-black animate-in slide-in-from-bottom duration-300 flex flex-col" style={{ willChange: 'transform' }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-[#121212] z-10 pt-safe">
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                  <X size={24} className="text-gray-600 dark:text-gray-200" />
                </button>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">{t('post_publish')}</h2>
              </div>
              <button 
                onClick={handleNext}
                disabled={(!text && mediaFiles.length === 0) || !category}
                className={`px-6 py-1.5 rounded-lg font-bold text-sm transition-colors flex items-center gap-1 ${
                  (text || mediaFiles.length > 0) && category ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'
                }`}
              >
                {t('post_next')}
                <ChevronLeft size={16} className={`mt-0.5 ${language === 'en' ? 'rotate-180' : ''}`} />
              </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto no-scrollbar pb-[100px]">
              {/* User Info */}
              <div className="px-4 py-4 flex items-center gap-3">
                <Avatar name={userName} src={avatarSrc} className="w-12 h-12 border border-gray-100 dark:border-gray-800" />
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">{userName}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <button className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 px-2 py-0.5 rounded-md">
                        <Globe size={10} className="text-blue-600 dark:text-blue-400" />
                        <span className="text-[10px] text-blue-700 dark:text-blue-300 font-medium">{t('visibility_public')}</span>
                      </button>

                      {category && (
                        <button onClick={() => setCategory(null)} className="flex items-center gap-1 bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 px-2 py-0.5 rounded-md animate-in zoom-in">
                          <Tag size={10} className="text-purple-600 dark:text-purple-400" />
                          <span className="text-[10px] text-purple-700 dark:text-purple-300 font-medium max-w-[120px] truncate">
                             {/* Attempt to translate category name which is the part after ': ' */}
                             {category.includes(': ') ? `${category.split(': ')[0]}: ${t(category.split(': ')[1])}` : category}
                          </span>
                          <X size={10} className="text-purple-600 dark:text-purple-400" />
                        </button>
                      )}
                      
                      {!category && (
                        <button onClick={() => setIsDrawerOpen(true)} className="flex items-center gap-1 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 px-2 py-0.5 rounded-md animate-pulse">
                          <Plus size={10} className="text-red-500" />
                          <span className="text-xs font-bold text-red-500">{t('post_category')} *</span>
                        </button>
                      )}
                    </div>
                </div>
              </div>

              {/* Input */}
              <div className="px-4">
                <textarea 
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`${t('post_header_create')} ${userName.split(' ')[0]}?`}
                  className="w-full text-lg placeholder:text-gray-400 dark:placeholder:text-gray-600 bg-transparent text-gray-900 dark:text-white border-none outline-none resize-none min-h-[120px] dir-auto text-start"
                />
              </div>

              {/* Location Pill */}
              <div className="px-4 flex flex-wrap gap-2 mb-4">
                {(location || isLocating) && (
                  <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1 rounded-full text-xs font-bold animate-in zoom-in">
                      {isLocating ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
                      <span>{isLocating ? t('loading') : location}</span>
                      {!isLocating && <button onClick={() => setLocation(null)}><X size={12} /></button>}
                  </div>
                )}
              </div>

              {/* Media Grid */}
              {mediaFiles.length > 0 && (
                <div className="px-4 pb-4">
                  <div className={`grid gap-2 ${mediaFiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {mediaFiles.map((file, idx) => (
                        <div key={idx} className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-800">
                          {file.type === 'video' ? (
                            <video src={file.url} className="w-full h-full max-h-[300px] object-cover" controls />
                          ) : (
                            <img src={file.url} alt="upload" className="w-full h-full max-h-[300px] object-cover" />
                          )}
                          <button onClick={() => handleRemoveMedia(idx)} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70">
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
          </div>

          {/* DRAWER BACKDROP (Fades in) */}
          <div 
            className={`fixed inset-0 bg-black/40 z-[40] transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            style={{ touchAction: 'none' }}
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* DRAWER / BOTTOM BAR (Slides up seamlessly) */}
          <div 
            className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-[#121212] z-[50] rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_-5px_30px_rgba(0,0,0,0.5)] flex flex-col h-[70vh] transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] will-change-transform transform-gpu border-t border-gray-100 dark:border-gray-800`}
            style={{ 
              transform: isDrawerOpen ? 'translateY(0)' : 'translateY(calc(100% - 65px - env(safe-area-inset-bottom)))'
            }}
          >
            {/* Header (The Clickable Trigger) */}
            <div 
                onClick={toggleDrawer} 
                className="flex items-center justify-between px-5 h-[65px] cursor-pointer active:bg-gray-50 dark:active:bg-white/5 rounded-t-3xl transition-colors duration-200 flex-shrink-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('post_add_to')}</span>
                <ChevronUp size={16} className={`text-gray-500 dark:text-gray-400 transition-transform duration-500 ${isDrawerOpen ? 'rotate-180' : ''}`} />
              </div>
              <div className="flex items-center gap-4 text-green-600">
                <ImageIcon size={22} className="text-green-600 dark:text-green-500" />
                <Video size={22} className="text-purple-600 dark:text-purple-500" />
                <MapPin size={22} className="text-red-500 dark:text-red-500" />
              </div>
            </div>

            {/* Scrollable Content (Always Rendered, just hidden off-screen when closed) */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-5 pt-2">
              <div className="grid grid-cols-2 gap-3 mb-6">
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl p-4 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                    <div className="bg-green-200 dark:bg-green-800 p-2 rounded-full"><ImageIcon size={24} className="text-green-700 dark:text-green-200" /></div>
                    <span className="text-xs font-bold text-green-800 dark:text-green-300">{t('post_media')}</span>
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,video/*" onChange={handleMediaUpload} />

                  <button onClick={handleAutoLocation} className="flex flex-col items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl p-4 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                    <div className="bg-red-200 dark:bg-red-800 p-2 rounded-full"><MapPin size={24} className="text-red-700 dark:text-red-200" /></div>
                    <span className="text-xs font-bold text-red-800 dark:text-red-300">{t('post_location')}</span>
                  </button>
              </div>

              <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Briefcase size={16} className="text-purple-600 dark:text-purple-400" />
                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">{t('nav_jobs')}</h4>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {JOB_CATEGORIES.map((cat, i) => (
                        <button key={i} onClick={() => handleCategorySelect(cat.name, 'job')} className="flex flex-col items-center gap-1.5 group">
                          <div className={`${cat.bg} p-2.5 rounded-xl group-hover:scale-105 transition-transform dark:opacity-80 dark:hover:opacity-100`}>
                              <cat.icon size={18} className={cat.color} />
                          </div>
                          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 text-center line-clamp-1">{t(cat.name)}</span>
                        </button>
                    ))}
                  </div>
              </div>

              <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Store size={16} className="text-orange-600 dark:text-orange-400" />
                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">{t('nav_haraj')}</h4>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {HARAJ_CATEGORIES.map((cat, i) => (
                        <button key={i} onClick={() => handleCategorySelect(cat.name, 'haraj')} className="flex flex-col items-center gap-1.5 group">
                          <div className={`${cat.lightColor} p-2.5 rounded-xl group-hover:scale-105 transition-transform dark:opacity-80 dark:hover:opacity-100`}>
                              <cat.icon size={18} className={cat.iconColor} />
                          </div>
                          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 text-center line-clamp-1">{t(cat.name)}</span>
                        </button>
                    ))}
                  </div>
              </div>
            </div>
          </div>
        </div>
      );
  }

  const isJobPost = category?.startsWith(t('nav_jobs'));
  const isPublishDisabled = isSubmitting || (scope === 'local' && !selectedCity);

  // --- RENDER: SETTINGS (Step 2) ---
  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-black animate-in slide-in-from-left duration-300 flex flex-col" style={{ willChange: 'transform' }}>
       
       {/* Header Step 2 */}
       <div className="px-4 py-3 flex items-center justify-between sticky top-0 bg-white dark:bg-[#121212] z-10 pt-safe border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-2 hover:bg-gray-50 dark:hover:bg-white/10 rounded-full text-gray-600 dark:text-gray-300">
              <ArrowRight className={language === 'en' ? 'rotate-180' : ''} size={22} />
            </button>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">{t('post_settings')}</h2>
          </div>
          <button 
            onClick={handleFinalPost}
            disabled={isPublishDisabled}
            className={`px-6 py-1.5 rounded-full font-bold text-sm bg-blue-600 text-white transition-colors shadow-sm shadow-blue-200 dark:shadow-none ${isPublishDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {t('post_publish')}
          </button>
       </div>

       {/* Form Content */}
       <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-6 pb-[50px]">
          
          {/* 1. Scope Selection (Segmented Control) */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block px-1">{t('scope_label')}</label>
            <div className="bg-gray-100 dark:bg-gray-900 p-1 rounded-xl flex gap-1">
              <button 
                onClick={() => setScope('local')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  scope === 'local' ? 'bg-white dark:bg-[#1e1e1e] text-blue-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-600'
                }`}
              >
                 <MapPin size={16} />
                 <span>{t('scope_local')}</span>
              </button>
              <button 
                onClick={() => setScope('global')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  scope === 'global' ? 'bg-white dark:bg-[#1e1e1e] text-blue-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-600'
                }`}
              >
                 <Globe size={16} />
                 <span>{t('scope_global')}</span>
              </button>
            </div>
          </div>

          {/* 2. Location Inputs (Only if Local) - UPDATED TO DRAWERS */}
          {scope === 'local' && (
             <div className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-3">
                
                {/* Country Selector Button */}
                <div 
                  onClick={() => setIsCountryDrawerOpen(true)}
                  className="w-full bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm font-bold rounded-xl py-3 px-4 flex justify-between items-center cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors"
                >
                   <span className={selectedCountry ? "text-gray-900 dark:text-white" : "text-gray-400"}>
                     {getSelectedCountryDisplay()}
                   </span>
                   <ChevronDown size={16} className="text-gray-400" />
                </div>

                {/* City Selector Button */}
                <div 
                   onClick={() => {
                     if(!selectedCountry) {
                       alert(t('location_select_country') + " first");
                       setIsCountryDrawerOpen(true);
                       return;
                     }
                     setIsCityDrawerOpen(true);
                   }}
                   className={`w-full bg-gray-50 dark:bg-gray-900 text-sm font-bold rounded-xl py-3 px-4 flex justify-between items-center cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors ${!selectedCountry ? 'opacity-50' : ''}`}
                >
                   <span className={selectedCity ? "text-gray-900 dark:text-white" : "text-gray-400"}>
                     {getSelectedCityDisplay()}
                   </span>
                   <ChevronDown size={16} className="text-gray-400" />
                </div>

             </div>
          )}
          
          <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />

          {/* 3. Job Type (Conditional) */}
          {isJobPost && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2 px-1">
                <Briefcase size={16} className="text-purple-600" />
                {t('job_type_title')}
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setJobType('employer')}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-start ${
                    jobType === 'employer'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-purple-300'
                  }`}
                >
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{t('job_type_hiring')}</h4>
                </button>
                <button
                  onClick={() => setJobType('seeker')}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-start ${
                    jobType === 'seeker'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-purple-300'
                  }`}
                >
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{t('job_type_seeking')}</h4>
                </button>
              </div>
            </div>
          )}

          {/* 4. Publish Scope (Unconditional) */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2 px-1">
              <Eye size={16} className="text-purple-600" />
              {t('scope_visibility')}
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => setPublishScope('home_and_category')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-start ${
                  publishScope === 'home_and_category'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-800 hover:border-purple-300'
                }`}
              >
                <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{t('scope_home_category')}</h4>
                <p className="text-xs text-gray-500 mt-1">{t('scope_home_desc')}</p>
              </button>
              <button
                onClick={() => setPublishScope('category_only')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-start ${
                  publishScope === 'category_only'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-800 hover:border-purple-300'
                }`}
              >
                <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{t('scope_category_only')}</h4>
                <p className="text-xs text-gray-500 mt-1">{t('scope_category_desc')}</p>
              </button>
            </div>
          </div>


          <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />

          {/* 5. Contact Information */}
          <div>
             <h3 className="text-xs font-bold text-gray-400 mb-3 px-1">{t('contact_info_title')}</h3>
             
             <div className="space-y-3 mb-4">
                <div className="relative">
                   <Phone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                   <input 
                     type="tel" 
                     placeholder={t('contact_phone_placeholder')}
                     value={contactPhone}
                     onChange={(e) => setContactPhone(e.target.value)}
                     className="w-full bg-gray-50 dark:bg-gray-900 rounded-xl py-2.5 pr-10 pl-3 text-sm font-bold outline-none focus:bg-white dark:focus:bg-[#1e1e1e] focus:ring-1 focus:ring-blue-500 transition-all dir-ltr dark:text-white"
                   />
                </div>
                <div className="relative">
                   <Mail size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                   <input 
                     type="email" 
                     placeholder={t('contact_email_placeholder')}
                     value={contactEmail}
                     onChange={(e) => setContactEmail(e.target.value)}
                     className="w-full bg-gray-50 dark:bg-gray-900 rounded-xl py-2.5 pr-10 pl-3 text-sm font-bold outline-none focus:bg-white dark:focus:bg-[#1e1e1e] focus:ring-1 focus:ring-blue-500 transition-all dir-ltr dark:text-white"
                   />
                </div>
             </div>
             
             {/* Contact Methods Toggles (Chips) */}
             <div className="flex flex-wrap gap-2">
                 <button 
                   onClick={() => toggleContactMethod('whatsapp')}
                   className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                     contactMethods.whatsapp 
                     ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' 
                     : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400'
                   }`}
                 >
                    <MessageCircle size={14} className={contactMethods.whatsapp ? "fill-green-700 dark:fill-green-400" : ""} />
                    {t('contact_method_whatsapp')}
                 </button>
                 <button 
                   onClick={() => toggleContactMethod('call')}
                   className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                     contactMethods.call 
                     ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400' 
                     : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400'
                   }`}
                 >
                    <Phone size={14} className={contactMethods.call ? "fill-blue-700 dark:fill-blue-400" : ""} />
                    {t('contact_method_call')}
                 </button>
                 <button 
                   onClick={() => toggleContactMethod('email')}
                   className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                     contactMethods.email 
                     ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400' 
                     : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400'
                   }`}
                 >
                    <Mail size={14} className={contactMethods.email ? "fill-orange-700 dark:fill-orange-400" : ""} />
                    {t('contact_method_email')}
                 </button>
             </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />

          {/* 6. Premium Feature (Highlight Ad) - Sleek Banner */}
          <div 
            onClick={handlePremiumClick}
            className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
              isPremium 
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' 
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300'
            }`}
          >
             <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full transition-colors ${isPremium ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                   <Star size={18} fill={isPremium ? "currentColor" : "none"} />
                </div>
                <div>
                   <h3 className={`text-sm font-bold ${isPremium ? 'text-amber-900 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>{t('post_premium')}</h3>
                   <p className="text-[10px] text-gray-400">{getPremiumLabel()}</p>
                </div>
             </div>
             
             <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                isPremium ? 'bg-amber-500 border-amber-500' : 'border-gray-300 dark:border-gray-600'
             }`}>
                {isPremium && <Check size={12} className="text-white" strokeWidth={3} />}
             </div>
          </div>

       </div>

       {/* --- PREMIUM DURATION DRAWER --- */}
       {isPremiumDrawerOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/40 z-[120] transition-opacity" 
              onClick={() => setIsPremiumDrawerOpen(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#121212] z-[130] rounded-t-3xl transition-transform animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[70vh] shadow-2xl">
               <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
                  <span className="font-bold text-lg text-gray-900 dark:text-white">{t('premium_title')}</span>
                  <button onClick={() => setIsPremiumDrawerOpen(false)} className="bg-gray-100 dark:bg-gray-800 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <X size={20} className="text-gray-600 dark:text-gray-300" />
                  </button>
               </div>
               
               <div className="p-5 space-y-4 overflow-y-auto no-scrollbar pb-10">
                  
                  {/* Option 1: 24h Free */}
                  <button 
                    onClick={() => selectPromotionType('free')}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                        promotionType === 'free' 
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10' 
                        : 'border-gray-100 dark:border-gray-800 hover:border-amber-200 dark:hover:border-amber-900/50'
                    }`}
                  >
                      <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${promotionType === 'free' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                              <Clock size={24} />
                          </div>
                          <div className="text-start">
                              <h4 className="font-bold text-gray-900 dark:text-white">{t('premium_24h')}</h4>
                              <p className="text-xs text-green-600 font-bold mt-0.5">{t('premium_free')}</p>
                          </div>
                      </div>
                      {promotionType === 'free' && <div className="bg-amber-500 text-white rounded-full p-1"><Check size={16} strokeWidth={3} /></div>}
                  </button>

                  {/* Option 2: 1 Week - Updated Logic: Free with crossed out price */}
                  <button 
                    onClick={() => selectPromotionType('weekly')}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                        promotionType === 'weekly' 
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10' 
                        : 'border-gray-100 dark:border-gray-800 hover:border-amber-200 dark:hover:border-amber-900/50'
                    }`}
                  >
                      <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${promotionType === 'weekly' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                              <Calendar size={24} />
                          </div>
                          <div className="text-start">
                              <h4 className="font-bold text-gray-900 dark:text-white">{t('premium_1w')}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs font-bold text-gray-400 line-through">10 {t('currency_sar')}</span>
                                  <span className="text-xs font-bold text-green-600">{t('premium_free')}</span>
                              </div>
                          </div>
                      </div>
                      {promotionType === 'weekly' && <div className="bg-amber-500 text-white rounded-full p-1"><Check size={16} strokeWidth={3} /></div>}
                  </button>

                  {/* Option 3: 1 Month - Updated Logic: Free with crossed out price */}
                  <button 
                    onClick={() => selectPromotionType('monthly')}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                        promotionType === 'monthly' 
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10' 
                        : 'border-gray-100 dark:border-gray-800 hover:border-amber-200 dark:hover:border-amber-900/50'
                    }`}
                  >
                      <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${promotionType === 'monthly' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                              <Crown size={24} />
                          </div>
                          <div className="text-start">
                              <h4 className="font-bold text-gray-900 dark:text-white">{t('premium_1m')}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs font-bold text-gray-400 line-through">30 {t('currency_sar')}</span>
                                  <span className="text-xs font-bold text-green-600">{t('premium_free')}</span>
                              </div>
                          </div>
                      </div>
                      {promotionType === 'monthly' && <div className="bg-amber-500 text-white rounded-full p-1"><Check size={16} strokeWidth={3} /></div>}
                  </button>

               </div>
            </div>
          </>
       )}

       {/* --- COUNTRY DRAWER --- */}
       {isCountryDrawerOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/40 z-[120]" 
              onClick={() => setIsCountryDrawerOpen(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#121212] z-[130] rounded-t-3xl h-[60vh] flex flex-col animate-in slide-in-from-bottom duration-300">
               <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                  <span className="font-bold text-gray-800 dark:text-white">{t('location_select_country')}</span>
                  <button onClick={() => setIsCountryDrawerOpen(false)} className="bg-gray-100 dark:bg-gray-800 p-1 rounded-full">
                    <X size={20} className="text-gray-600 dark:text-gray-300" />
                  </button>
               </div>
               <div className="flex-1 overflow-y-auto no-scrollbar p-2">
                 {ARAB_LOCATIONS.map((loc) => (
                    <button 
                      key={loc.countryAr}
                      onClick={() => {
                        setSelectedCountry(loc.countryAr); // Store Arabic
                        setSelectedCity(''); // Reset city
                        setIsCountryDrawerOpen(false);
                      }}
                      className="w-full text-start p-4 border-b border-gray-50 dark:border-gray-800 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                          <span className="text-2xl">{loc.flag}</span>
                          <span>{language === 'en' ? loc.countryEn : loc.countryAr}</span>
                      </div>
                      {selectedCountry === loc.countryAr && <Check size={16} className="text-blue-600" />}
                    </button>
                 ))}
               </div>
            </div>
          </>
       )}

       {/* --- CITY DRAWER --- */}
       {isCityDrawerOpen && selectedCountry && (
          <>
            <div 
              className="fixed inset-0 bg-black/40 z-[120]" 
              onClick={() => setIsCityDrawerOpen(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#121212] z-[130] rounded-t-3xl h-[60vh] flex flex-col animate-in slide-in-from-bottom duration-300">
               <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                  <span className="font-bold text-gray-800 dark:text-white">{t('location_cities_in')} {getSelectedCountryDisplay()}</span>
                  <button onClick={() => setIsCityDrawerOpen(false)} className="bg-gray-100 dark:bg-gray-800 p-1 rounded-full">
                    <X size={20} className="text-gray-600 dark:text-gray-300" />
                  </button>
               </div>
               <div className="flex-1 overflow-y-auto no-scrollbar p-2">
                 
                 {/* Option: All Cities */}
                 <button 
                    onClick={() => {
                      setSelectedCity('All Cities'); // Will map to 'كل المدن' in submit
                      setIsCityDrawerOpen(false);
                    }}
                    className="w-full text-start p-4 border-b border-gray-50 dark:border-gray-800 text-blue-600 font-bold text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex justify-between items-center"
                  >
                    <span>{t('location_all_cities')}</span>
                    {(selectedCity === 'All Cities' || selectedCity === 'كل المدن') && <Check size={16} className="text-blue-600" />}
                  </button>

                 {ARAB_LOCATIONS.find(l => l.countryAr === selectedCountry)?.cities.map((city) => (
                    <button 
                      key={city.ar}
                      onClick={() => {
                        setSelectedCity(city.ar); // Store Arabic
                        setIsCityDrawerOpen(false);
                      }}
                      className="w-full text-start p-4 border-b border-gray-50 dark:border-gray-800 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex justify-between items-center"
                    >
                      <span>{language === 'en' ? city.en : city.ar}</span>
                      {selectedCity === city.ar && <Check size={16} className="text-blue-600" />}
                    </button>
                 ))}
               </div>
            </div>
          </>
       )}

    </div>
  );
};

export default CreatePostModal;
