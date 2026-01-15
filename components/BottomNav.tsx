
import React from 'react';
import { Home, Briefcase, Store, PlaySquare, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCreate: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, onOpenCreate }) => {
  const { t } = useLanguage();
  const isShorts = activeTab === 'shorts';

  const navContainerClass = isShorts 
    ? "bg-black border-black" 
    : "bg-white border-gray-200";
    
  const getButtonClass = (tabName: string) => {
    const isActive = activeTab === tabName;
    
    if (isShorts) {
      if (isActive) return "text-white"; 
      return "text-[#888888]";
    } else {
      if (isActive) {
          if (tabName === 'haraj') return "text-orange-600";
          if (tabName === 'jobs') return "text-purple-600";
          return "text-blue-600";
      }
      return "text-gray-400";
    }
  };

  return (
    <nav className={`fixed bottom-0 w-full max-w-md z-50 border-t pb-safe pt-1 ${navContainerClass}`}>
      <div className="flex justify-around items-center px-2 pb-1 h-[48px]">
        
        {/* Home */}
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-0.5 w-14 active:scale-95 transition-transform ${getButtonClass('home')}`}
        >
          <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          <span className={`text-[9px] ${activeTab === 'home' ? 'font-bold' : 'font-medium'}`}>{t('nav_home')}</span>
        </button>

        {/* Jobs (Wazaef) */}
        <button 
          onClick={() => setActiveTab('jobs')}
          className={`flex flex-col items-center gap-0.5 w-14 active:scale-95 transition-transform ${getButtonClass('jobs')}`}
        >
          <Briefcase size={24} strokeWidth={activeTab === 'jobs' ? 2.5 : 2} />
          <span className={`text-[9px] ${activeTab === 'jobs' ? 'font-bold' : 'font-medium'}`}>{t('nav_jobs')}</span>
        </button>

        {/* Add (Plus) */}
        <button 
          onClick={onOpenCreate}
          className="flex flex-col items-center justify-center active:scale-90 transition-transform"
        >
          <div className={`p-2 rounded-xl shadow-sm backdrop-blur-sm ${
             isShorts 
               ? 'bg-white/10 text-white' 
               : 'bg-black text-white shadow-gray-300'
          }`}>
            <Plus size={20} strokeWidth={3} />
          </div>
        </button>

        {/* Shorts */}
        <button 
          onClick={() => setActiveTab('shorts')}
          className={`flex flex-col items-center gap-0.5 w-14 active:scale-95 transition-transform ${getButtonClass('shorts')}`}
        >
          <PlaySquare size={24} fill={activeTab === 'shorts' ? "currentColor" : "none"} strokeWidth={activeTab === 'shorts' ? 0 : 2} />
          <span className={`text-[9px] ${activeTab === 'shorts' ? 'font-bold' : 'font-medium'}`}>{t('nav_shorts')}</span>
        </button>

         {/* Haraj (Marketplace) */}
         <button 
          onClick={() => setActiveTab('haraj')}
          className={`flex flex-col items-center gap-0.5 w-14 active:scale-95 transition-transform ${getButtonClass('haraj')}`}
        >
          <Store size={24} strokeWidth={activeTab === 'haraj' ? 2.5 : 2} />
          <span className={`text-[9px] ${activeTab === 'haraj' ? 'font-bold' : 'font-medium'}`}>{t('nav_haraj')}</span>
        </button>

      </div>
    </nav>
  );
};

export default BottomNav;
