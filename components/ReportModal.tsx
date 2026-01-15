
import React, { useState } from 'react';
import { X, Flag, Send, AlertTriangle, User, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  targetName: string;
  targetType: 'post' | 'comment' | 'reply' | 'video';
  isSubmitting?: boolean;
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, onSubmit, targetName, targetType, isSubmitting = false }) => {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const getTitle = () => {
    switch (targetType) {
      case 'post': return t('report_post_title');
      case 'comment': return t('report_comment_title');
      case 'reply': return t('report_reply_title');
      case 'video': return t('report_video_title');
      default: return t('report_problem_title');
    }
  };

  const handleSubmit = () => {
    if (!reason.trim()) return;
    onSubmit(reason);
    setReason('');
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={!isSubmitting ? onClose : undefined}
      />
      
      {/* Modal Content */}
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl relative z-10 animate-in slide-in-from-bottom duration-300 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0">
          <div className="flex items-center gap-3">
             <div className="bg-red-50 p-2 rounded-full">
                <Flag size={20} className="text-red-600" />
             </div>
             <div>
                <h3 className="text-lg font-bold text-gray-900">{getTitle()}</h3>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                   <User size={10} />
                   <span>{t('report_content_owner')}: <span className="text-gray-800 font-bold">{targetName}</span></span>
                </div>
             </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto no-scrollbar">
           <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 mb-4 flex items-start gap-2">
              <AlertTriangle size={18} className="text-orange-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-orange-800 leading-relaxed font-medium">
                {t('report_hint')}
              </p>
           </div>

           <label className="block text-sm font-bold text-gray-700 mb-2">{t('report_reason_label')}</label>
           <textarea
             value={reason}
             onChange={(e) => setReason(e.target.value)}
             disabled={isSubmitting}
             placeholder={t('report_placeholder_detail')}
             className="w-full h-40 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white focus:border-red-500 transition-all resize-none placeholder:text-gray-400 disabled:opacity-70 disabled:bg-gray-100"
             autoFocus
           />
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-white pb-safe">
          <button 
            onClick={handleSubmit}
            disabled={!reason.trim() || isSubmitting}
            className={`w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                reason.trim() && !isSubmitting
                ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200' 
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            <span>{isSubmitting ? t('sending') : t('report_submit_button')}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default ReportModal;
