
import React from 'react';
import Avatar from './Avatar';
import { API_BASE_URL } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

interface CreatePostBarProps {
  onOpen: () => void;
}

const CreatePostBar: React.FC<CreatePostBarProps> = ({ onOpen }) => {
  const { t, language } = useLanguage();
  const userName = localStorage.getItem('userName') || 'مستخدم';
  const userAvatar = localStorage.getItem('userAvatar');
  const avatarSrc = userAvatar ? (userAvatar.startsWith('http') ? userAvatar : `${API_BASE_URL}${userAvatar}`) : null;

  return (
    <div className="bg-white px-4 py-3 shadow-sm border-b border-gray-100">
      <div className="flex items-center gap-3">
        <Avatar 
          name={userName}
          src={avatarSrc}
          className="w-10 h-10 border border-gray-100 flex-shrink-0"
        />
        <div 
          onClick={onOpen}
          className="flex-1 h-10 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center px-4 cursor-pointer transition-all duration-200 border border-gray-200 overflow-hidden"
        >
          <span className="text-gray-500 text-xs sm:text-sm font-medium truncate text-start dir-auto w-full select-none">
             {language === 'ar' 
              ? `${t('post_header_create')} ${userName}؟ ${t('nav_haraj')}، ${t('nav_jobs')}...`
              : `${t('post_header_create')} ${userName}? ${t('nav_haraj')}, ${t('nav_jobs')}...`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CreatePostBar;
