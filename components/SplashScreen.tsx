
import React, { useState } from 'react';
import { Hexagon, Briefcase } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const SplashScreen: React.FC = () => {
  const { t } = useLanguage();
  const [imgError, setImgError] = useState(false);
  // Fixed absolute path
  const AppLogo = "/assets/images/app-logo.jpg"; 

  return (
    <div className="fixed inset-0 z-[9999] bg-white dark:bg-black flex flex-col items-center justify-between pb-10 pt-safe">
      
      {/* Spacer */}
      <div className="flex-1"></div>

      {/* Center Logo */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-32 h-32 rounded-3xl shadow-2xl shadow-blue-100 dark:shadow-none mb-6 overflow-hidden bg-white flex items-center justify-center">
           {!imgError ? (
             <img 
               src={AppLogo} 
               alt="مهنتي لي" 
               className="w-full h-full object-contain p-2"
               onError={() => setImgError(true)} 
             />
           ) : (
             <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <Briefcase size={48} className="text-white" />
             </div>
           )}
        </div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{t('app_name')}</h1>
      </div>

      {/* Footer */}
      <div className="flex-1 flex flex-col justify-end items-center w-full">
        <div className="flex flex-col items-center gap-3">
          <span className="text-gray-400 text-[10px] tracking-widest font-medium uppercase">From</span>
          
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 flex items-center justify-center">
                <Hexagon size={32} className="text-gray-300 dark:text-gray-700 absolute" strokeWidth={1} />
                <div className="w-4 h-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-sm rotate-45 shadow-sm"></div>
            </div>
            
            <span className="text-lg font-bold text-gray-800 dark:text-gray-200 font-sans tracking-wide">
              مهدلي
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SplashScreen;
