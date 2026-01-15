
import React, { useState, useEffect } from 'react';
import { Plus, X, Check } from 'lucide-react';
import Avatar from './Avatar';
import { API_BASE_URL } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

export interface SuggestedItem {
  id: string;
  name: string;
  subtitle: string;
  avatar: string | null;
  backgroundImage?: string;
}

interface SuggestedListProps {
  title: string;
  items: SuggestedItem[];
  type: 'company' | 'person';
  onShowAll?: () => void;
  onProfileClick?: (userId: string) => void;
}

// Sub-component to handle individual card state and logic
const SuggestedCard: React.FC<{ item: SuggestedItem; type: string; onProfileClick?: (id: string) => void }> = ({ item, type, onProfileClick }) => {
  const { t } = useLanguage();
  // 1. Initialize from Cache to prevent flickering
  const [isFollowed, setIsFollowed] = useState(() => {
    if (!item.id) return false;
    const cachedStatus = localStorage.getItem(`follow_status_${item.id}`);
    return cachedStatus ? JSON.parse(cachedStatus) : false;
  });

  // 2. Sync with Global Events
  useEffect(() => {
    const handleGlobalFollowChange = (event: CustomEvent) => {
        if (event.detail && event.detail.userId === item.id) {
            setIsFollowed(event.detail.isFollowed);
        }
    };

    window.addEventListener('user-follow-change', handleGlobalFollowChange as EventListener);

    return () => {
        window.removeEventListener('user-follow-change', handleGlobalFollowChange as EventListener);
    };
  }, [item.id]);

  // 4. Handle Toggle (Instant / Optimistic + Global Event)
  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    const currentUserId = localStorage.getItem('userId');
    
    if (!token) {
        alert("يرجى تسجيل الدخول");
        return;
    }

    if (item.id === currentUserId) return;

    // Optimistic Update: Change UI immediately without waiting
    const previousState = isFollowed;
    const newState = !previousState;
    
    setIsFollowed(newState);
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

        if (!response.ok) {
            // Revert silently if failed
            setIsFollowed(previousState);
            localStorage.setItem(`follow_status_${item.id}`, JSON.stringify(previousState));
            window.dispatchEvent(new CustomEvent('user-follow-change', {
                detail: { userId: item.id, isFollowed: previousState }
            }));
        }
    } catch (error) {
        // Revert silently if error
        setIsFollowed(previousState);
        localStorage.setItem(`follow_status_${item.id}`, JSON.stringify(previousState));
        window.dispatchEvent(new CustomEvent('user-follow-change', {
            detail: { userId: item.id, isFollowed: previousState }
        }));
    }
  };

  // Don't show card if it's the current user
  if (item.id === localStorage.getItem('userId')) return null;

  return (
    <div 
      className="w-40 border border-gray-200 rounded-xl overflow-hidden flex flex-col items-center bg-white shadow-sm hover:shadow-md transition-shadow relative flex-shrink-0 cursor-pointer"
      onClick={() => onProfileClick?.(item.id)}
    >
      {/* Close/Dismiss Button (Visual only for now) */}
      <button className="absolute top-1 right-1 p-1 bg-black/5 rounded-full hover:bg-black/10 z-20 text-gray-500">
        <X size={12} />
      </button>

      {/* Cover Image */}
      <div className="h-14 w-full bg-gray-100 relative z-0">
        {item.backgroundImage ? (
          <img src={item.backgroundImage} alt="cover" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full ${type === 'person' ? 'bg-gradient-to-r from-blue-100 to-indigo-100' : 'bg-gradient-to-r from-gray-200 to-gray-300'}`}></div>
        )}
      </div>

      {/* Avatar */}
      <div className="-mt-8 mb-2 p-1 bg-white rounded-full relative z-10">
        <Avatar
          name={item.name}
          src={item.avatar}
          className="w-14 h-14 border border-gray-100 shadow-sm"
          textClassName="text-2xl"
        />
      </div>

      {/* Info */}
      <div className="text-center px-2 mb-3 flex-1 flex flex-col justify-between w-full">
        <div>
            <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{item.name}</h4>
            <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5 h-8 leading-tight">
            {item.subtitle}
            </p>
        </div>
        
        {/* Follow Button - Instant Interaction */}
        <button 
          onClick={handleFollowToggle}
          className={`mt-3 w-full py-1.5 flex items-center justify-center gap-1 rounded-full text-xs font-bold transition-all duration-200 active:scale-95 ${
            isFollowed 
              ? 'bg-gray-100 text-gray-600 border border-transparent' 
              : 'border border-blue-600 text-blue-600 hover:bg-blue-50'
          }`}
        >
          {isFollowed ? (
             <>
               <Check size={14} />
               <span>{t('following')}</span>
             </>
          ) : (
             <>
               <Plus size={14} />
               <span>{t('follow')}</span>
             </>
          )}
        </button>
      </div>
    </div>
  );
};

const SuggestedList: React.FC<SuggestedListProps> = ({ title, items, type, onShowAll, onProfileClick }) => {
  const { t } = useLanguage();
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-white mb-3 py-4 animate-in fade-in duration-500 border-y border-gray-100">
      {/* Header */}
      <div className="flex justify-between items-center px-4 mb-3">
        <h3 className="font-bold text-gray-800 text-base">{title}</h3>
        <button 
          onClick={onShowAll}
          className="text-blue-600 text-xs font-semibold hover:bg-blue-50 px-2 py-1 rounded transition-colors"
        >
          {t('view_all')}
        </button>
      </div>

      {/* Scrollable List */}
      <div className="overflow-x-auto no-scrollbar px-4 pb-2">
        <div className="flex gap-3 min-w-max">
          {items.map((item) => (
            <SuggestedCard key={item.id} item={item} type={type} onProfileClick={onProfileClick} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SuggestedList;
