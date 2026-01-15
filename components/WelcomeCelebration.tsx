
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Briefcase, CheckCircle, X, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface WelcomeCelebrationProps {
  onClose: () => void;
}

const WelcomeCelebration: React.FC<WelcomeCelebrationProps> = ({ onClose }) => {
  const { t, language } = useLanguage();
  const [particles, setParticles] = useState<Array<{id: number, left: string, delay: string, duration: string, color: string, size: string}>>([]);

  useEffect(() => {
    // Generate confetti particles
    const colors = ['#FFD700', '#FF6347', '#32CD32', '#1E90FF', '#FF69B4', '#FFA500'];
    const newParticles = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      duration: `${Math.random() * 3 + 3}s`,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: `${Math.random() * 10 + 5}px`
    }));
    setParticles(newParticles);
  }, []);

  // Safety check for SSR environments (though not strictly needed for client-side only)
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-500">
      
      {/* Confetti Styles */}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-20vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
        }
        .confetti-piece {
          position: absolute;
          top: -20px;
          border-radius: 4px;
          animation-name: fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>

      {/* Confetti Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <div
            key={p.id}
            className="confetti-piece"
            style={{
              left: p.left,
              backgroundColor: p.color,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      {/* Main Card */}
      <div className="bg-white dark:bg-[#1e1e1e] w-[90%] max-w-sm rounded-3xl p-8 relative shadow-2xl border-4 border-white/20 transform animate-in zoom-in-50 duration-500 flex flex-col items-center text-center overflow-hidden">
        
        {/* Glow Effect */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-500/20 to-transparent pointer-events-none"></div>

        {/* Icon */}
        <div className="w-24 h-24 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30 relative z-10 animate-bounce">
           <Sparkles size={48} className="text-white" />
           <div className="absolute -bottom-2 -right-2 bg-yellow-400 p-2 rounded-full border-4 border-white dark:border-[#1e1e1e]">
              <Briefcase size={20} className="text-white" />
           </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
          {t('welcome_title')}
        </h2>

        {/* Message */}
        <p className="text-gray-600 dark:text-gray-300 text-sm leading-loose font-medium mb-8">
          {t('welcome_body')}
          <br/>
          <span className="text-blue-600 dark:text-blue-400 font-bold block mt-2">
            {t('welcome_footer')}
          </span>
        </p>

        {/* Button */}
        <button 
          onClick={onClose}
          className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold text-base shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 relative z-10"
        >
          <span>{t('start_using')}</span>
          <ArrowLeft size={20} className={language === 'ar' ? 'rotate-180' : ''} />
        </button>

        {/* Close Icon (Top Right) */}
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-white/10 rounded-full text-gray-500 hover:text-gray-800 transition-colors z-20"
        >
            <X size={18} />
        </button>

      </div>
    </div>,
    document.body
  );
};

export default WelcomeCelebration;
