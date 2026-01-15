
import React from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface PostUploadIndicatorProps {
  status: 'publishing' | 'success' | 'error';
  contentPreview?: string;
  errorMessage?: string;
}

const PostUploadIndicator: React.FC<PostUploadIndicatorProps> = ({ status, contentPreview, errorMessage }) => {
  const { t } = useLanguage();
  const isSuccess = status === 'success';
  const isError = status === 'error';

  return (
    <div className={`fixed top-24 right-4 z-[9999] flex items-center gap-3 p-2 pl-4 rounded-xl backdrop-blur-md shadow-2xl border transition-all duration-500 transform ${
      isError ? 'bg-red-50 border-red-200' : 'bg-white/90 border-gray-200'
    } ${isSuccess ? 'animate-out fade-out slide-out-to-right duration-1000 delay-3000' : 'animate-in slide-in-from-right duration-500'}`}>
      
      <div className={`relative w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center border transition-colors duration-300 ${
         isError ? 'bg-red-100 border-red-300' : (isSuccess ? 'bg-green-100 border-green-200' : 'bg-blue-50 border-blue-100')
      }`}>
        {status === 'publishing' ? (
           <Loader2 size={24} className="text-blue-600 animate-spin" />
        ) : isError ? (
           <AlertCircle size={24} className="text-red-600 animate-in zoom-in" />
        ) : (
           <Check size={24} className="text-green-600 animate-in zoom-in" strokeWidth={3} />
        )}
      </div>

      <div className="flex flex-col min-w-[120px] text-right max-w-[200px]">
         <span className={`text-xs font-bold mb-0.5 ${
           isError ? 'text-red-700' : (isSuccess ? 'text-green-600' : 'text-gray-800')
         }`}>
            {status === 'publishing' ? t('post_publishing') : (isError ? 'عذراً، فشل النشر' : t('post_success'))}
         </span>
         <span className={`text-[10px] line-clamp-2 ${isError ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
            {isError ? (errorMessage || 'خطأ في معالجة الطلب') : (contentPreview || (status === 'publishing' ? t('post_pending_desc') : t('nav_home')))}
         </span>
      </div>

    </div>
  );
};

export default PostUploadIndicator;
