
import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Search, Plus, Check, Verified, Loader2 } from 'lucide-react';
import Avatar from './Avatar';
import { SuggestedItem } from './SuggestedList';
import { API_BASE_URL } from '../constants';

interface SuggestedUsersViewProps {
  initialTab?: 'companies' | 'individuals';
  people: SuggestedItem[];
  companies: SuggestedItem[];
  onBack: () => void;
  isLoading?: boolean;
  onProfileClick?: (userId: string) => void;
}

// مكون فرعي لزر المتابعة لحفظ الحالة والتعامل مع المنطق بشكل مستقل
const UserRow: React.FC<{ item: SuggestedItem; type: 'company' | 'person'; onProfileClick?: (id: string) => void }> = ({ item, type, onProfileClick }) => {
  const [isFollowed, setIsFollowed] = useState(() => {
    if (!item.id) return false;
    const cachedStatus = localStorage.getItem(`follow_status_${item.id}`);
    return cachedStatus ? JSON.parse(cachedStatus) : false;
  });
  
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // 1. Sync with Global Event (When changed elsewhere)
  useEffect(() => {
    const handleGlobalFollowChange = (event: CustomEvent) => {
        if (event.detail && event.detail.userId === item.id) {
            // Only update if different to avoid loops
            setIsFollowed((prev: boolean) => {
                if (prev !== event.detail.isFollowed) {
                    return event.detail.isFollowed;
                }
                return prev;
            });
        }
    };

    window.addEventListener('user-follow-change', handleGlobalFollowChange as EventListener);

    return () => {
        window.removeEventListener('user-follow-change', handleGlobalFollowChange as EventListener);
    };
  }, [item.id]);

  // 2. Fetch Real Status on Mount (Fixes "Not showing I'm following")
  useEffect(() => {
      const fetchStatus = async () => {
          const token = localStorage.getItem('token');
          if (!token || !item.id) return;

          try {
              const response = await fetch(`${API_BASE_URL}/api/v1/follow/${item.id}/status`, {
                  headers: { 'Authorization': `Bearer ${token}` }
              });
              if (response.ok) {
                  const data = await response.json();
                  const realStatus = data.isFollowing;
                  
                  setIsFollowed(realStatus);
                  localStorage.setItem(`follow_status_${item.id}`, JSON.stringify(realStatus));
              }
          } catch (e) {
              console.error("Failed to fetch status", e);
          }
      };

      fetchStatus();
  }, [item.id]);

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    const currentUserId = localStorage.getItem('userId');
    
    if (!token) {
        alert("يرجى تسجيل الدخول");
        return;
    }

    if (item.id === currentUserId) return;

    // Optimistic Update
    const previousState = isFollowed;
    const newState = !previousState;
    
    setIsFollowed(newState);
    setIsLoadingStatus(true);
    localStorage.setItem(`follow_status_${item.id}`, JSON.stringify(newState));

    // Dispatch Global Event
    window.dispatchEvent(new CustomEvent('user-follow-change', {
        detail: { userId: item.id, isFollowed: newState }
    }));

    try {
        const method = previousState ? 'DELETE' : 'POST';
        const response = await fetch(`${API_BASE_URL}/api/v1/follow/${item.id}`, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // 3. Graceful Error Handling (Fixes "Returns back again")
        if (!response.ok) {
            // If we tried to follow (POST) but backend says error (likely 400 Already Following),
            // we should actually KEEP it as followed (true), not revert.
            if (method === 'POST' && response.status === 400) {
                 // It means we are already following, so UI showing "Following" (true) is actually correct.
                 // Ensure state is true
                 setIsFollowed(true);
                 localStorage.setItem(`follow_status_${item.id}`, 'true');
            } else {
                // Real error, revert
                setIsFollowed(previousState);
                localStorage.setItem(`follow_status_${item.id}`, JSON.stringify(previousState));
                window.dispatchEvent(new CustomEvent('user-follow-change', {
                    detail: { userId: item.id, isFollowed: previousState }
                }));
            }
        }
    } catch (error) {
        // Revert on network error
        setIsFollowed(previousState);
        localStorage.setItem(`follow_status_${item.id}`, JSON.stringify(previousState));
        window.dispatchEvent(new CustomEvent('user-follow-change', {
            detail: { userId: item.id, isFollowed: previousState }
        }));
    } finally {
        setIsLoadingStatus(false);
    }
  };

  return (
    <div 
      className="flex items-center justify-between p-3 rounded-2xl bg-white border border-gray-100 hover:border-blue-100 transition-all duration-300 cursor-pointer"
      onClick={() => onProfileClick?.(item.id)}
    >
        {/* معلومات المستخدم */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="relative">
            <Avatar 
              name={item.name} 
              src={item.avatar} 
              className="w-14 h-14 border border-gray-100 shadow-sm"
              textClassName="text-xl" 
            />
            {type === 'company' && (
                <div className="absolute -bottom-1 -left-1 bg-blue-500 text-white p-0.5 rounded-full border-2 border-white">
                    <Verified size={10} />
                </div>
            )}
          </div>
          
          <div className="flex flex-col">
              <h3 className="text-base font-bold text-gray-900 line-clamp-1 flex items-center gap-1">
                {item.name}
              </h3>
              <p className="text-xs text-gray-400 font-medium line-clamp-1 mt-0.5">
                {item.subtitle}
              </p>
          </div>
        </div>

        {/* زر المتابعة */}
        <button 
          onClick={handleFollowToggle}
          disabled={isLoadingStatus}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 transform active:scale-90 ${
             isFollowed 
             ? 'bg-green-50 text-green-600 border border-green-200' 
             : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
          }`}
        >
          {isLoadingStatus ? (
             <Loader2 size={18} className="animate-spin opacity-50" />
          ) : isFollowed ? (
             <Check size={20} strokeWidth={3} />
          ) : (
             <Plus size={24} strokeWidth={3} />
          )}
        </button>
    </div>
  );
};

const SuggestedUsersView: React.FC<SuggestedUsersViewProps> = ({ initialTab = 'companies', people, companies, onBack, isLoading = false, onProfileClick }) => {
  const [activeTab, setActiveTab] = useState<'companies' | 'individuals'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // جميع الشركات تظهر في قائمة الشركات
  const companiesList = companies;
  const individualsList = people;

  // تحديد القائمة المعروضة بناءً على التبويب
  let displayedItems: SuggestedItem[] = [];
  let currentType: 'company' | 'person' = 'company';

  if (activeTab === 'companies') {
     displayedItems = companiesList;
     currentType = 'company';
  } else {
     displayedItems = individualsList;
     currentType = 'person';
  }

  // تطبيق البحث
  const filteredItems = displayedItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[150] bg-white text-gray-800 flex flex-col animate-in slide-in-from-top duration-500 ease-out">
      
      {/* Header */}
      <div className="px-4 py-4 flex items-center gap-3 sticky top-0 bg-white/95 backdrop-blur-sm z-10 pt-safe border-b border-gray-50 shadow-sm">
        <button 
          onClick={onBack} 
          className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-600 transition-all active:scale-95 transform rotate-90"
        >
          <ArrowRight className="rotate-180" size={22} />
        </button>
        <h2 className="text-xl font-black text-gray-900 tracking-tight">دليل المجتمع</h2>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 px-6 pt-4 pb-2 bg-white">
         <button 
            onClick={() => setActiveTab('companies')} 
            className={`text-sm font-bold transition-colors pb-1 ${activeTab === 'companies' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
         >
            شركات
         </button>
         <button 
            onClick={() => setActiveTab('individuals')} 
            className={`text-sm font-bold transition-colors pb-1 ${activeTab === 'individuals' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
         >
            أفراد
         </button>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-2 bg-white">
        <div className="relative group">
           <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400 group-focus-within:text-blue-600 transition-colors" />
           </div>
           <input 
             type="text" 
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             placeholder={`بحث في ${activeTab === 'companies' ? 'الشركات' : 'الأفراد'}...`}
             className="w-full bg-gray-50 border border-gray-100 text-gray-900 text-sm font-bold rounded-2xl py-3.5 pr-11 pl-4 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400 placeholder:font-normal"
           />
        </div>
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-10 pt-2 space-y-3">
        {isLoading ? (
             <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={40} className="text-blue-600 animate-spin mb-4" />
                <p className="text-gray-400 font-bold text-sm">جاري تحميل القائمة...</p>
            </div>
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => (
             <UserRow key={item.id} item={item} type={currentType} onProfileClick={onProfileClick} />
          ))
        ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                <Search size={48} className="text-gray-300 mb-2" />
                <p className="text-gray-400 font-bold text-sm">لا توجد نتائج مطابقة</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default SuggestedUsersView;
