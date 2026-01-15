
import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Tag, MessageCircle, Download, 
  Repeat, ChevronRight, MapPin, 
  Briefcase, Store, Globe, Lock, Flame, 
  Sparkles, Hash, AtSign, Video, PlayCircle,
  X, Coins, CheckCircle, Calendar, ChevronDown, Clock,
  TrendingUp, Users, Gift, Loader2, Link as LinkIcon
} from 'lucide-react';
import { TextOverlay, StickerOverlay } from './EditVideoView';
import { useLanguage } from '../contexts/LanguageContext';
import { ARAB_LOCATIONS } from '../data/locations';

interface PublishVideoViewProps {
  videoSrc: string;
  onBack: () => void;
  onPublish: (details: {
    title: string;
    description: string;
    category: string;
    allowComments: boolean;
    allowDownload: boolean;
    allowDuet: boolean;
    privacy: 'public' | 'friends' | 'private';
    coverFile: File | null;
    promotion?: {
        city: string;
        duration: number;
        budget: number;
    };
    location?: string;
    hashtags: string[];
    mentions: { username: string }[];
    websiteLink?: string;
  }) => void;
  isSubmitting: boolean;
  overlayTexts: TextOverlay[];
  overlayStickers: StickerOverlay[]; 
  appliedFilter?: string;
}

const PublishVideoView: React.FC<PublishVideoViewProps> = ({ 
    videoSrc, 
    onBack, 
    onPublish, 
    isSubmitting, 
    overlayTexts, 
    overlayStickers = [], 
    appliedFilter = 'none' 
}) => {
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // New State Variables
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [mentionsInput, setMentionsInput] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');

  // Category State
  const [selectedMainCategory, setSelectedMainCategory] = useState<'haraj' | 'jobs' | 'general'>('general');

  const [allowComments, setAllowComments] = useState(true);
  const [allowDownload, setAllowDownload] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  
  // Privacy State
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  
  // Location State
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Promotion State
  const [showPromoteDrawer, setShowPromoteDrawer] = useState(false);
  const [promoteConfig, setPromoteConfig] = useState<{
      city: string;
      duration: number;
      budget: number;
  } | null>(null);

  // --- NEW PROMOTION LOGIC ---
  const [promoteCountry, setPromoteCountry] = useState(ARAB_LOCATIONS[0].countryAr); 
  const [promoteCity, setPromoteCity] = useState(ARAB_LOCATIONS[0].cities[0].ar); 
  const [isCountrySelectOpen, setIsCountrySelectOpen] = useState(false);

  // Duration Types: 24h (Free), 1w (10), 1m (30), custom
  const [promoteDurationType, setPromoteDurationType] = useState<'24h' | '1w' | '1m' | 'custom'>('24h');
  const [customDuration, setCustomDuration] = useState(3); 

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- RADICAL FIX FOR PREVIEW BLACK SCREEN ---
  useEffect(() => {
    const video = videoRef.current;
    if (video && videoSrc && !coverPreview) {
        video.load();
        const ensureFrame = () => {
            video.currentTime = 0.1; 
        };
        if (video.readyState >= 2) {
            ensureFrame();
        } else {
            video.addEventListener('loadeddata', ensureFrame);
        }
        return () => {
            video.removeEventListener('loadeddata', ensureFrame);
        };
    }
  }, [videoSrc, coverPreview]);

  // Reset city when country changes
  useEffect(() => {
      const countryData = ARAB_LOCATIONS.find(c => c.countryAr === promoteCountry);
      if (countryData && countryData.cities.length > 0) {
          setPromoteCity(countryData.cities[0].ar);
      }
  }, [promoteCountry]);

  const handlePublishClick = () => {
    if (!title) {
      alert(language === 'ar' ? 'الرجاء كتابة عنوان للفيديو.' : 'Please write a video title.');
      return;
    }
    
    let finalCategory = 'عام'; 
    if (selectedMainCategory === 'haraj') finalCategory = t('nav_haraj');
    else if (selectedMainCategory === 'jobs') finalCategory = t('nav_jobs');
    else finalCategory = 'عام'; 

    // Parse Hashtags
    const hashtags = hashtagsInput
        .split(/[\s,]+/) // Split by space or comma
        .map(tag => tag.trim().replace(/^#/, '')) // Remove # prefix
        .filter(tag => tag.length > 0);

    // Parse Mentions
    const mentions = mentionsInput
        .split(/[\s,]+/)
        .map(mention => ({ username: mention.trim().replace(/^@/, '') })) // Remove @ prefix
        .filter(m => m.username.length > 0);

    onPublish({ 
      title, 
      description, 
      category: finalCategory, 
      allowComments, 
      allowDownload, 
      allowDuet, 
      privacy, 
      coverFile,
      promotion: promoteConfig || undefined,
      location: detectedLocation || undefined,
      hashtags,
      mentions,
      websiteLink: websiteLink.trim() || undefined
    });
  };
  
  const handleCoverChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  // --- AUTO LOCATION LOGIC ---
  const handleAutoLocation = () => {
    if (isLocating) return;
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
             const city = addr.city || addr.town || addr.village || addr.state || '';
             const district = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || '';
             
             const parts = [city, district].filter(Boolean);
             const formattedLocation = parts.length > 0 ? parts.join('، ') : `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
             
             setDetectedLocation(formattedLocation);
          } else {
             setDetectedLocation(t('current_location'));
          }
        } catch (error) {
          console.error("Geocoding error:", error);
          setDetectedLocation(t('current_location'));
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        if (error.code === 1) { 
            alert(t('location_permission_denied'));
        } else {
            alert(t('location_failed'));
        }
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const getDurationInDays = () => {
      switch (promoteDurationType) {
          case '24h': return 1;
          case '1w': return 7;
          case '1m': return 30;
          case 'custom': return customDuration;
          default: return 1;
      }
  };

  const calculateTotalCost = () => {
      switch (promoteDurationType) {
          case '24h': return 0;
          case '1w': return 10;
          case '1m': return 30;
          case 'custom': return customDuration * 2;
          default: return 0;
      }
  };

  const getEstimatedViews = () => {
      const cost = calculateTotalCost();
      // Even if free, show estimation based on the "value"
      const calcCost = cost === 0 ? 5 : cost;
      const minViews = calcCost * 80;
      const maxViews = calcCost * 120;
      return `${minViews.toLocaleString()} - ${maxViews.toLocaleString()}`;
  };

  const confirmPromotion = () => {
      const days = getDurationInDays();
      // Force budget to 0 for free promotion as requested
      const totalBudget = 0; 

      // Ensure city format matches requirement "Country - City"
      // Use Arabic state values for backend
      const formattedCity = `${promoteCountry} - ${promoteCity}`;

      setPromoteConfig({
          city: formattedCity,
          duration: days,
          budget: totalBudget
      });
      setShowPromoteDrawer(false);
  };

  const removePromotion = (e: React.MouseEvent) => {
      e.stopPropagation();
      setPromoteConfig(null);
  };

  const getCurrentCities = () => {
      const country = ARAB_LOCATIONS.find(c => c.countryAr === promoteCountry);
      return country ? country.cities : [];
  };

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
    <div 
      onClick={onChange}
      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${checked ? (isAr ? '-translate-x-5' : 'translate-x-5') : ''}`} />
    </div>
  );

  const totalCost = calculateTotalCost();

  // Helper to display current selected values in UI (Translated)
  const getDisplayPromoteCountry = () => {
      const countryData = ARAB_LOCATIONS.find(c => c.countryAr === promoteCountry);
      return language === 'en' ? countryData?.countryEn : promoteCountry;
  };

  const getDisplayPromoteCity = () => {
      const countryData = ARAB_LOCATIONS.find(c => c.countryAr === promoteCountry);
      const cityData = countryData?.cities.find(c => c.ar === promoteCity);
      return language === 'en' ? cityData?.en : promoteCity;
  };

  // Helper to translate promote config string for display
  const getPromoteConfigDisplay = () => {
      if (!promoteConfig) return "";
      
      const parts = promoteConfig.city.split(' - ');
      if (parts.length < 2) return promoteConfig.city;

      const cAr = parts[0];
      const cityAr = parts[1];

      const cData = ARAB_LOCATIONS.find(l => l.countryAr === cAr);
      const cityData = cData?.cities.find(c => c.ar === cityAr);

      if (language === 'en') {
          const cEn = cData?.countryEn || cAr;
          const cityEn = cityData?.en || cityAr;
          return `${cEn} - ${cityEn}`;
      }
      return promoteConfig.city;
  };

  return (
    <div className="fixed inset-0 z-[120] bg-white dark:bg-black text-gray-800 flex flex-col animate-in slide-in-from-left duration-300">
      
      <div className="px-4 py-3 flex items-center justify-between sticky top-0 bg-white dark:bg-[#121212] z-10 border-b border-gray-100 dark:border-gray-800 pt-safe">
        <button onClick={onBack} className="p-2 hover:bg-gray-50 dark:hover:bg-white/10 rounded-full text-gray-600 dark:text-white transition-colors">
          <ArrowLeft className={!isAr ? 'rotate-180' : ''} size={22} />
        </button>
        <h2 className="text-base font-bold dark:text-white">{t('publish_video')}</h2>
        <div className="w-8"></div> 
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 bg-white dark:bg-black">
        
        {/* 1. Main Input Area */}
        <div className="bg-white dark:bg-[#121212] p-4 flex gap-4 border-b border-gray-100 dark:border-gray-800">
            {/* Form Fields */}
            <div className="flex-1 flex flex-col gap-3">
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('video_title_placeholder')}
                    className="w-full text-sm font-bold bg-transparent border-none outline-none dark:text-white placeholder:text-gray-400"
                />
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('video_desc_placeholder')}
                    className="w-full flex-1 bg-transparent text-xs text-gray-600 dark:text-gray-300 placeholder:text-gray-400 border-none outline-none resize-none leading-relaxed min-h-[60px]"
                    rows={3}
                />
                
                {/* Extra Fields */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5">
                        <Hash size={14} className="text-gray-400" />
                        <input 
                            type="text"
                            value={hashtagsInput}
                            onChange={(e) => setHashtagsInput(e.target.value)}
                            placeholder={t('hashtags_placeholder')}
                            className="bg-transparent border-none outline-none text-xs w-full dark:text-white"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5">
                        <AtSign size={14} className="text-gray-400" />
                        <input 
                            type="text"
                            value={mentionsInput}
                            onChange={(e) => setMentionsInput(e.target.value)}
                            placeholder={t('mentions_placeholder')}
                            className="bg-transparent border-none outline-none text-xs w-full dark:text-white"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5">
                        <LinkIcon size={14} className="text-gray-400" />
                        <input 
                            type="url"
                            value={websiteLink}
                            onChange={(e) => setWebsiteLink(e.target.value)}
                            placeholder={t('website_link_placeholder')}
                            className="bg-transparent border-none outline-none text-xs w-full dark:text-white dir-ltr text-right"
                        />
                    </div>
                </div>
            </div>

            {/* Thumbnail Select */}
            <div className="relative group w-24 h-36 flex-shrink-0 bg-gray-900 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer" onClick={() => coverInputRef.current?.click()}>
                {coverPreview ? (
                    <img src={coverPreview} alt="Cover" className="w-full h-full object-cover opacity-90" />
                ) : (
                    <div className="relative w-full h-full">
                        <video 
                            key={videoSrc}
                            ref={videoRef} 
                            src={videoSrc} 
                            muted 
                            playsInline 
                            preload="auto"
                            className="w-full h-full object-cover" 
                            style={{ filter: appliedFilter }}
                        />
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {overlayTexts.map(text => (
                                <div
                                    key={text.id}
                                    className="absolute whitespace-nowrap font-bold"
                                    style={{
                                        left: `${(text.x / window.innerWidth) * 100}%`,
                                        top: `${(text.y / window.innerHeight) * 100}%`,
                                        transform: `translate(-50%, -50%) scale(${text.scale * 0.3})`,
                                        color: text.color,
                                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                                        fontSize: '2rem'
                                    }}
                                >
                                    {text.content}
                                </div>
                            ))}
                            {overlayStickers.map(sticker => (
                                <div
                                    key={sticker.id}
                                    className="absolute whitespace-nowrap font-bold"
                                    style={{
                                        left: `${(sticker.x / window.innerWidth) * 100}%`,
                                        top: `${(sticker.y / window.innerHeight) * 100}%`,
                                        transform: `translate(-50%, -50%) scale(${sticker.scale * 0.3})`,
                                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                                        fontSize: '4rem'
                                    }}
                                >
                                    {sticker.content}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-1 font-bold backdrop-blur-sm">
                    {t('select_cover')}
                </div>
                <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={handleCoverChange} />
            </div>
        </div>

        {/* 2. Settings List */}
        <div className="bg-white dark:bg-[#121212]">
            
            {/* Category */}
            <div className="px-4 py-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#121212]">
                <div className="text-gray-500 dark:text-gray-400">
                    {selectedMainCategory === 'haraj' ? <Store size={20} /> : (selectedMainCategory === 'jobs' ? <Briefcase size={20} /> : <Video size={20} />)}
                </div>
                <span className="text-sm font-bold text-gray-800 dark:text-white">{t('publish_in')}</span>
                <div className="flex bg-gray-50 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-100 dark:border-gray-700">
                    <button 
                        onClick={() => setSelectedMainCategory('haraj')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedMainCategory === 'haraj' ? 'bg-white dark:bg-gray-700 text-orange-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        {t('nav_haraj')}
                    </button>
                    <button 
                        onClick={() => setSelectedMainCategory('jobs')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedMainCategory === 'jobs' ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        {t('nav_jobs')}
                    </button>
                    <button 
                        onClick={() => setSelectedMainCategory('general')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedMainCategory === 'general' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        {t('location_general')}
                    </button>
                </div>
            </div>

            {/* Privacy */}
            <div 
                className="px-4 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 cursor-pointer bg-white dark:bg-[#121212]"
                onClick={() => setPrivacy(prev => prev === 'public' ? 'private' : 'public')}
            >
                <div className="flex items-center gap-3">
                    <div className="text-gray-500 dark:text-gray-400">
                        {privacy === 'public' ? <Globe size={20} /> : <Lock size={20} />}
                    </div>
                    <span className="text-sm font-bold text-gray-800 dark:text-white">{t('who_can_watch')}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">
                        {privacy === 'public' ? t('privacy_public') : t('privacy_private')}
                    </span>
                    <ChevronRight size={16} className={`text-gray-400 ${isAr ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* --- PROMOTE --- */}
            <div 
                className={`px-4 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-all duration-300 ${
                    promoteConfig 
                    ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10' 
                    : 'bg-white dark:bg-[#121212] hover:bg-gray-50'
                }`}
                onClick={() => setShowPromoteDrawer(true)}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-full transition-colors ${promoteConfig ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                        <Flame size={16} fill="currentColor" />
                    </div>
                    <div className="flex flex-col">
                        <span className={`text-sm font-bold flex items-center gap-2 ${promoteConfig ? 'text-orange-700 dark:text-orange-400' : 'text-gray-800 dark:text-white'}`}>
                            {t('promote_video')}
                            {promoteConfig && (
                                <span className="flex items-center gap-1 bg-white/60 px-1.5 py-0.5 rounded-md text-[10px] text-orange-600 shadow-sm border border-orange-100">
                                    {t('premium_free')}
                                </span>
                            )}
                        </span>
                        {promoteConfig && (
                            <span className="text-[10px] text-orange-600/70 font-medium mt-0.5">
                                {t('active')} • {promoteConfig.duration} {t('days')} • {getPromoteConfigDisplay()}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {promoteConfig ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-orange-600 bg-white/50 px-2 py-1 rounded-lg">{t('activated')}</span>
                            <div onClick={removePromotion} className="p-1 rounded-full hover:bg-orange-200/50 text-orange-400">
                                <X size={14} />
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Disabled Label Removed Here */}
                            <ChevronRight size={16} className={`text-gray-300 ${isAr ? 'rotate-180' : ''}`} />
                        </>
                    )}
                </div>
            </div>

            {/* Location */}
            <div 
                className="px-4 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 cursor-pointer bg-white dark:bg-[#121212]"
                onClick={handleAutoLocation}
            >
                <div className="flex items-center gap-3">
                    <MapPin size={20} className="text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-bold text-gray-800 dark:text-white">{t('post_location')}</span>
                </div>
                <div className="flex items-center gap-2">
                    {isLocating ? (
                        <div className="flex items-center gap-1.5 text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md">
                            <Loader2 size={12} className="animate-spin" />
                            {t('detecting_location')}
                        </div>
                    ) : (
                        <span className={`text-xs font-bold ${detectedLocation ? 'text-blue-600' : 'text-gray-500'}`}>
                            {detectedLocation || t('location_general')}
                        </span>
                    )}
                    <ChevronRight size={16} className={`text-gray-400 ${isAr ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* More Options */}
            <div className="px-4 py-4 bg-white dark:bg-[#121212]">
                <h3 className="text-xs font-bold text-gray-400 mb-4 px-1">{t('more_options')}</h3>
                
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('allow_comments')}</span>
                        </div>
                        <ToggleSwitch checked={allowComments} onChange={() => setAllowComments(!allowComments)} />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('allow_downloads')}</span>
                        </div>
                        <ToggleSwitch checked={allowDownload} onChange={() => setAllowDownload(!allowDownload)} />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('allow_duet')}</span>
                        </div>
                        <ToggleSwitch checked={allowDuet} onChange={() => setAllowDuet(!allowDuet)} />
                    </div>
                </div>
            </div>

        </div>
      </div>

      {/* Fixed Bottom Footer */}
      <div className="bg-white dark:bg-[#121212] border-t border-gray-100 dark:border-gray-800 p-4 pb-safe flex gap-3 shadow-[0_-4px_30px_rgba(0,0,0,0.03)]">
          <button 
            className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-sm transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={onBack}
          >
            {t('drafts')}
          </button>
          
          <button 
            onClick={handlePublishClick}
            disabled={!title || isSubmitting}
            className={`flex-1 py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] ${
                title && !isSubmitting 
                ? 'bg-[#E11D48] hover:bg-[#BE123C] shadow-red-200 dark:shadow-none' 
                : 'bg-gray-200 dark:bg-gray-800 cursor-not-allowed shadow-none text-gray-400'
            }`}
          >
            {isSubmitting ? (
                <>
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                    <span>{t('publishing')}</span>
                </>
            ) : (
                <>
                    <Sparkles size={16} />
                    <span>{t('post_publish')}</span>
                </>
            )}
          </button>
      </div>

      {/* --- PROMOTE DRAWER --- */}
      {showPromoteDrawer && (
        <div className="fixed inset-0 z-[200] bg-white dark:bg-black flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between p-4 pt-safe border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#121212]">
                <div className="flex items-center gap-2">
                    <Flame size={24} className="text-orange-500 fill-orange-500" />
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">{t('promote_video')}</h3>
                </div>
                <button 
                    onClick={() => setShowPromoteDrawer(false)} 
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div>
                    <div 
                        className="flex items-center justify-between mb-3 cursor-pointer group"
                        onClick={() => setIsCountrySelectOpen(!isCountrySelectOpen)}
                    >
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Globe size={16} className="text-blue-500" />
                            {t('target_country')}
                        </h4>
                        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-800 group-hover:bg-blue-100 transition-colors">
                            {/* Display Name Based on Language */}
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                                {getDisplayPromoteCountry()}
                            </span>
                            <ChevronDown size={14} className={`text-blue-500 transition-transform ${isCountrySelectOpen ? 'rotate-180' : ''}`} />
                        </div>
                    </div>

                    {isCountrySelectOpen && (
                        <div className="grid grid-cols-2 gap-2 mb-4 animate-in slide-in-from-top-2">
                            {ARAB_LOCATIONS.map((loc) => (
                                <button
                                    key={loc.countryAr}
                                    onClick={() => {
                                        setPromoteCountry(loc.countryAr); // Set Arabic value
                                        setIsCountrySelectOpen(false);
                                    }}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                                        promoteCountry === loc.countryAr
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <span className="text-lg">{loc.flag}</span>
                                    {/* Display English or Arabic based on app setting */}
                                    <span className="text-xs font-bold">{language === 'en' ? loc.countryEn : loc.countryAr}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {getCurrentCities().map((city) => (
                            <button
                                key={city.ar}
                                onClick={() => setPromoteCity(city.ar)} // Set Arabic value
                                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                                    promoteCity === city.ar
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                {/* Display English or Arabic based on app setting */}
                                {language === 'en' ? city.en : city.ar}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />

                <div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <Clock size={16} className="text-purple-500" />
                        {t('promotion_duration')}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setPromoteDurationType('24h')}
                            className={`py-3 rounded-xl text-sm font-bold transition-all border flex flex-col items-center gap-1 ${
                                promoteDurationType === '24h'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <span>{t('premium_24h')}</span>
                            <span className={`text-[10px] ${promoteDurationType === '24h' ? 'text-white/80' : 'text-green-600'}`}>{t('premium_free')}</span>
                        </button>
                        <button
                            onClick={() => setPromoteDurationType('1w')}
                            className={`py-3 rounded-xl text-sm font-bold transition-all border flex flex-col items-center gap-1 ${
                                promoteDurationType === '1w'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <span>{t('week_one')}</span>
                            <div className="flex flex-col items-center">
                                <span className={`text-[10px] ${promoteDurationType === '1w' ? 'text-white/60' : 'text-gray-400'} line-through`}>10 {t('premium_coins')}</span>
                                <span className={`text-[10px] ${promoteDurationType === '1w' ? 'text-white font-bold' : 'text-green-600 font-bold'}`}>{t('premium_free')}</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setPromoteDurationType('1m')}
                            className={`py-3 rounded-xl text-sm font-bold transition-all border flex flex-col items-center gap-1 ${
                                promoteDurationType === '1m'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <span>{t('month_one')}</span>
                            <div className="flex flex-col items-center">
                                <span className={`text-[10px] ${promoteDurationType === '1m' ? 'text-white/60' : 'text-gray-400'} line-through`}>30 {t('premium_coins')}</span>
                                <span className={`text-[10px] ${promoteDurationType === '1m' ? 'text-white font-bold' : 'text-green-600 font-bold'}`}>{t('premium_free')}</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setPromoteDurationType('custom')}
                            className={`py-3 rounded-xl text-sm font-bold transition-all border flex flex-col items-center gap-1 ${
                                promoteDurationType === 'custom'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <span>{t('custom')}</span>
                            <span className={`text-[10px] ${promoteDurationType === 'custom' ? 'text-white/80' : 'text-green-600'}`}>{t('premium_free')}</span>
                        </button>
                    </div>

                    {promoteDurationType === 'custom' && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 animate-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-gray-500">{t('days')}</span>
                                <span className="text-sm font-black text-purple-600">{customDuration} {t('days')}</span>
                            </div>
                            <input 
                                type="range" 
                                min="1" 
                                max="60" 
                                value={customDuration} 
                                onChange={(e) => setCustomDuration(parseInt(e.target.value))}
                                className="w-full accent-purple-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between mt-1 text-[10px] text-gray-400 font-medium">
                                <span>1 {t('day')}</span>
                                <span>30 {t('day')}</span>
                                <span>60 {t('day')}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <Coins size={20} className="text-amber-600" />
                            <h4 className="text-sm font-black text-gray-800 dark:text-white">{t('total_cost')}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-400 line-through">
                                {totalCost} {t('premium_coins')}
                            </span>
                            <span className="text-xl font-black text-green-600">
                                {t('premium_free')}
                            </span>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-black/20 rounded-xl p-3 flex items-center justify-between border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <TrendingUp size={16} />
                            <span className="text-xs font-bold">{t('estimated_reach')}</span>
                        </div>
                        <span className="text-xs font-black text-green-600 dark:text-green-400">
                            ~ {getEstimatedViews()} {t('views')}
                        </span>
                    </div>
                    
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg">
                        <Gift size={12} />
                        <span>{t('special_offer_free_24h')}</span>
                    </div>
                </div>

            </div>

            <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={confirmPromotion}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-2xl font-bold text-base shadow-lg shadow-orange-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    <span>{t('confirm_promotion')} ({t('premium_free')})</span>
                    <ArrowLeft size={20} className={!isAr ? 'rotate-180' : ''} />
                </button>
            </div>

        </div>
      )}

    </div>
  );
};

export default PublishVideoView;
