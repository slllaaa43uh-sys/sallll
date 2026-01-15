
import React, { useState } from 'react';
import { 
  X, CreditCard, Languages, Moon, AlertTriangle, 
  Lock, HelpCircle, Info, BellRing, ChevronLeft, LogOut, ShieldAlert, Send, Loader2,
  Cpu, Nfc, Coins, Skull, Check, Gift, Briefcase, DollarSign, UserCheck, Link, ArrowLeft
} from 'lucide-react';
import Avatar from './Avatar';
import { API_BASE_URL } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

interface SettingsViewProps {
  onClose: () => void;
  onProfileClick: () => void;
  onLogout: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onClose, onProfileClick, onLogout, isDarkMode, onToggleDarkMode }) => {
  const { t, language, setLanguage } = useLanguage();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'none' | 'warnings' | 'about' | 'report_problem' | 'wallet' | 'warning_notifications' | 'language_select'>('none');
  
  // Privacy Policy View State
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  // Report State
  const [reportText, setReportText] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Wallet State (Not used in UI currently but kept for logic)
  const [walletBalance, setWalletBalance] = useState(0);

  // Read real user data from local storage
  const userName = localStorage.getItem('userName') || 'مستخدم';
  const userEmail = localStorage.getItem('userEmail') || 'لا يوجد بريد إلكتروني';
  const userAvatar = localStorage.getItem('userAvatar');
  
  // Format avatar URL if needed
  const avatarSrc = userAvatar ? (userAvatar.startsWith('http') ? userAvatar : `${API_BASE_URL}${userAvatar}`) : null;

  const settingsItems = [
    { id: 1, title: t('settings_subscriptions'), icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50', action: () => setActiveModal('wallet') },
    { id: 2, title: t('settings_language'), icon: Languages, color: 'text-blue-600', bg: 'bg-blue-50', action: () => setActiveModal('language_select') },
    { id: 3, title: t('settings_dark_mode'), icon: Moon, color: 'text-indigo-600', bg: 'bg-indigo-50', action: () => {} }, // Toggle handled in render
    { id: 4, title: t('settings_warnings'), icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', action: () => setActiveModal('warnings') },
    { id: 5, title: t('settings_privacy'), icon: Lock, color: 'text-green-600', bg: 'bg-green-50', action: () => setShowPrivacyPolicy(true) },
    { id: 6, title: t('settings_report'), icon: HelpCircle, color: 'text-red-600', bg: 'bg-red-50', action: () => setActiveModal('report_problem') },
    { id: 7, title: t('settings_about'), icon: Info, color: 'text-gray-600', bg: 'bg-gray-50', action: () => setActiveModal('about') },
    { id: 8, title: t('settings_warning_notifs'), icon: BellRing, color: 'text-yellow-600', bg: 'bg-yellow-50', action: () => setActiveModal('warning_notifications') },
  ];

  const handleSendReport = async () => {
    if (!reportText.trim()) return;
    
    const token = localStorage.getItem('token');
    const currentUserId = localStorage.getItem('userId');

    if (!token) {
        alert("يرجى تسجيل الدخول أولاً");
        return;
    }

    setIsSubmittingReport(true);
    try {
        // We use 'user' as reportType targeting the current user to ensure backend acceptance,
        // while passing the actual problem in the reason field.
        const payload = {
            reportType: 'user', 
            targetId: currentUserId, 
            reason: `[PROBLEM REPORT] ${reportText}`,
            details: reportText,
            media: [],
            loadingDate: null,
            unloadingDate: null
        };

        const response = await fetch(`${API_BASE_URL}/api/v1/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert(t('report_success'));
            setReportText('');
            setActiveModal('none');
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error("Report failed:", errorData);
            alert("فشل إرسال البلاغ. يرجى المحاولة لاحقاً.");
        }
    } catch (error) {
        console.error("Report error:", error);
        alert("حدث خطأ في الاتصال.");
    } finally {
        setIsSubmittingReport(false);
    }
  };

  const renderContentModal = () => {
    if (activeModal === 'none') return null;

    let title = '';
    let content = null;
    let isReportModal = false;

    if (activeModal === 'wallet') {
        title = t('settings_subscriptions');
        content = (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-6">
                <div className="w-28 h-28 bg-gradient-to-tr from-purple-100 to-blue-50 rounded-full flex items-center justify-center shadow-lg border-4 border-white animate-in zoom-in duration-500">
                    <Gift size={56} className="text-purple-600" strokeWidth={1.5} />
                </div>
                
                <div className="space-y-4 px-2">
                    <h3 className="text-2xl font-black text-gray-900">
                        {language === 'ar' ? 'هديتنا لك!' : 'Our Gift to You!'}
                    </h3>
                    <div className="text-gray-600 text-sm font-medium leading-loose bg-gray-50 p-5 rounded-2xl border border-gray-100">
                        {language === 'ar' 
                            ? "لأنك من أوائل المنضمين لعائلتنا، قررنا فتح جميع ميزات التطبيق لك مجاناً بالكامل! \n\n يمكنك الآن النشر، التميز، ورفع الفيديوهات دون أي رسوم أو اشتراكات. انطلق وشاركنا إبداعك، فالمكان مكانك!"
                            : "As an early member, all premium features are unlocked for free! Enjoy posting, featuring content, and uploading videos without any fees. The stage is yours!"}
                    </div>
                </div>

                <div className="flex items-center gap-2 text-purple-600 bg-purple-50 px-5 py-2.5 rounded-full text-xs font-bold border border-purple-100">
                    <span>✨</span>
                    <span>{language === 'ar' ? 'استمتع بتجربة كاملة' : 'Enjoy Full Experience'}</span>
                    <span>✨</span>
                </div>
            </div>
        );
    } else if (activeModal === 'warnings') {
        title = t('settings_warnings');
        content = (
            <div className="space-y-4">
                <div className="bg-orange-50 border-r-4 border-orange-500 p-4 rounded-xl mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert size={24} className="text-orange-600" />
                        <h3 className="font-bold text-orange-800">{t('settings_warnings')}</h3>
                    </div>
                    <p className="text-sm text-orange-700 leading-relaxed font-bold">
                        {t('warning_intro')}
                    </p>
                </div>

                {/* Job Scams */}
                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex gap-4">
                    <div className="bg-blue-100 p-3 rounded-full h-fit flex-shrink-0">
                        <Briefcase size={20} className="text-blue-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 mb-1">{t('warning_job_title')}</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">{t('warning_job_desc')}</p>
                    </div>
                </div>

                {/* Payment Warning */}
                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex gap-4">
                    <div className="bg-green-100 p-3 rounded-full h-fit flex-shrink-0">
                        <DollarSign size={20} className="text-green-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 mb-1">{t('warning_payment_title')}</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">{t('warning_payment_desc')}</p>
                    </div>
                </div>

                {/* Data Privacy */}
                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex gap-4">
                    <div className="bg-purple-100 p-3 rounded-full h-fit flex-shrink-0">
                        <UserCheck size={20} className="text-purple-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 mb-1">{t('warning_data_title')}</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">{t('warning_data_desc')}</p>
                    </div>
                </div>

                {/* Links */}
                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex gap-4">
                    <div className="bg-red-100 p-3 rounded-full h-fit flex-shrink-0">
                        <Link size={20} className="text-red-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 mb-1">{t('warning_links_title')}</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">{t('warning_links_desc')}</p>
                    </div>
                </div>
            </div>
        );
    } else if (activeModal === 'about') {
        title = t('settings_about');
        content = (
            <div className="flex flex-col items-center text-center space-y-6 pt-4">
                <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-200">
                    <Info size={48} className="text-white" />
                </div>
                
                <div>
                    <h2 className="text-2xl font-black text-gray-900 mb-1">{t('app_name')}</h2>
                    <p className="text-green-600 font-bold text-sm bg-green-50 px-3 py-1 rounded-full inline-block">v1.0.3 (Server Optimized)</p>
                </div>

                <div className="text-sm text-gray-600 leading-loose max-w-xs mx-auto font-medium bg-gray-50 p-4 rounded-2xl">
                    {t('about_desc')}
                </div>

                <div className="w-full border-t border-gray-100 pt-6">
                    <p className="text-xs text-gray-400 font-bold">{t('about_version')}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('app_name')} Inc.</p>
                </div>
            </div>
        );
    } else if (activeModal === 'report_problem') {
        title = t('settings_report');
        isReportModal = true;
        content = (
            <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl flex items-center gap-3">
                    <Avatar name={userName} src={avatarSrc} className="w-10 h-10 border border-white shadow-sm" />
                    <div>
                        <h4 className="font-bold text-gray-900 text-sm">{userName}</h4>
                    </div>
                </div>

                <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
                    <HelpCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-800 leading-relaxed font-medium">
                        {t('report_desc')}
                    </p>
                </div>

                <div>
                    <textarea
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        disabled={isSubmittingReport}
                        placeholder={t('report_placeholder')}
                        className="w-full h-40 bg-white border border-gray-200 rounded-xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none placeholder:text-gray-400 disabled:opacity-70 disabled:bg-gray-50"
                        autoFocus
                    />
                </div>
            </div>
        );
    } else if (activeModal === 'warning_notifications') {
        title = t('settings_warning_notifs');
        content = (
            <div className="flex flex-col items-center justify-center h-full py-12 gap-6 text-center">
                <div className="bg-red-50 p-8 rounded-full border-4 border-red-100 shadow-xl animate-pulse">
                    <Skull size={80} className="text-red-600" strokeWidth={1.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-gray-900 mb-2">{t('warning_empty_title')}</h3>
                    <p className="text-gray-500 text-sm font-medium leading-relaxed max-w-[250px] mx-auto">
                        {t('warning_empty_desc')}
                    </p>
                </div>
            </div>
        );
    } else if (activeModal === 'language_select') {
        title = t('settings_language');
        content = (
            <div className="space-y-3 pt-2">
                <button 
                    onClick={() => { setLanguage('ar'); setActiveModal('none'); }}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${language === 'ar' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🇸🇦</span>
                        <span className="font-bold">العربية</span>
                    </div>
                    {language === 'ar' && <Check size={20} className="text-blue-600" />}
                </button>

                <button 
                    onClick={() => { setLanguage('en'); setActiveModal('none'); }}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${language === 'en' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🇺🇸</span>
                        <span className="font-bold">English</span>
                    </div>
                    {language === 'en' && <Check size={20} className="text-blue-600" />}
                </button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => !isSubmittingReport && setActiveModal('none')} />
            <div className="bg-white w-full max-w-md h-[85vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl relative z-10 animate-in slide-in-from-bottom duration-300 flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    <button 
                        onClick={() => setActiveModal('none')} 
                        disabled={isSubmittingReport}
                        className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        <X size={20} className="text-gray-600" />
                    </button>
                </div>
                
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-5 no-scrollbar pb-10">
                    {content}
                </div>

                {/* Footer Button - Only for some modals */}
                {activeModal !== 'language_select' && (
                    <div className="p-5 border-t border-gray-100 bg-white pb-safe rounded-b-3xl">
                        {isReportModal ? (
                            <button 
                                onClick={handleSendReport}
                                disabled={!reportText.trim() || isSubmittingReport}
                                className={`w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                                    reportText.trim() && !isSubmittingReport
                                    ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200' 
                                    : 'bg-gray-300 cursor-not-allowed'
                                }`}
                            >
                                {isSubmittingReport ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} />}
                                <span>{isSubmittingReport ? t('sending') : t('submit')}</span>
                            </button>
                        ) : (
                            <button 
                                onClick={() => setActiveModal('none')}
                                className="w-full py-3.5 bg-black text-white rounded-xl font-bold hover:bg-gray-900 transition-colors"
                            >
                                {activeModal === 'wallet' ? (language === 'ar' ? 'شكراً لكم!' : 'Thanks!') : t('understood')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white animate-in slide-in-from-right duration-300 overflow-y-auto no-scrollbar">
      
      {/* Top Bar */}
      <div className="sticky top-0 bg-white z-10 px-4 py-4 flex items-center justify-between border-b border-gray-50">
        <h2 className="text-xl font-bold text-gray-800">{t('settings_title')}</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsLogoutConfirmOpen(true)}
            className="p-2 bg-red-50 rounded-full hover:bg-red-100 transition-colors"
          >
            <LogOut size={24} className="text-red-600" />
          </button>
          <button 
            onClick={onClose}
            className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Profile Section */}
      <div 
        onClick={onProfileClick}
        className="flex items-center gap-4 px-5 py-6 bg-white cursor-pointer hover:bg-gray-50 transition-colors active:bg-gray-100"
      >
        <div className="relative">
           <Avatar 
             name={userName}
             src={avatarSrc}
             className="w-16 h-16 border border-gray-100 shadow-sm"
             textClassName="text-3xl"
           />
           <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
        </div>
        
        <div className="flex-1 flex flex-col items-start">
          <h3 className="text-lg font-bold text-gray-900 leading-tight">{userName}</h3>
          <p className="text-gray-400 text-xs mt-1 dir-ltr font-medium truncate max-w-[200px]">{userEmail}</p>
        </div>

        <ChevronLeft size={20} className={`text-gray-300 ${language === 'en' ? 'rotate-180' : ''}`} />
      </div>

      <div className="h-px bg-gray-100 mx-5 mb-6"></div>

      {/* Grid Settings */}
      <div className="px-4 pb-10">
        <h4 className="font-bold text-gray-800 mb-4 text-sm px-1">{t('settings_control_panel')}</h4>
        
        <div className="grid grid-cols-2 gap-3">
          {settingsItems.map((item) => {
            if (item.id === 3) {
              // Special Render for Dark Mode Toggle
              return (
                <div 
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 bg-white border border-gray-100 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${item.bg} shrink-0`}>
                      <item.icon size={20} className={item.color} />
                    </div>
                    <span className="text-xs font-bold text-gray-700 text-start line-clamp-1">
                      {item.title}
                    </span>
                  </div>
                  
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleDarkMode) onToggleDarkMode();
                    }}
                    className={`w-10 h-6 rounded-full p-1 flex items-center transition-colors cursor-pointer ${isDarkMode ? 'bg-indigo-600 justify-end' : 'bg-gray-300 justify-start'}`}
                  >
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                  </div>
                </div>
              );
            }

            return (
              <button 
                key={item.id}
                onClick={item.action}
                className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-all active:scale-95 group"
              >
                <div className={`p-2 rounded-lg ${item.bg} group-hover:scale-105 transition-transform shrink-0`}>
                  <item.icon size={20} className={item.color} />
                </div>
                
                <span className="text-xs font-bold text-gray-700 text-start line-clamp-1">
                  {item.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center py-6 text-gray-300 text-[10px]">
        <p>v1.0.3 (Server Optimized)</p>
        <p>{t('app_name')} Inc.</p>
      </div>

      {/* Render Active Modal */}
      {renderContentModal()}

      {/* Internal Privacy Policy View */}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 z-[200] bg-white dark:bg-black flex flex-col animate-in slide-in-from-right duration-300">
            <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 sticky top-0 bg-white dark:bg-black z-10 pt-safe">
                <button 
                    onClick={() => setShowPrivacyPolicy(false)} 
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                    <ArrowLeft size={24} className={`text-gray-800 dark:text-white ${language === 'ar' ? '' : 'rotate-180'}`} />
                </button>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('privacy_policy_link')}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-5 pb-safe">
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-4">{t('privacy_title')}</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-loose whitespace-pre-wrap">
                    {t('privacy_desc')}
                </p>
            </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsLogoutConfirmOpen(false)} />
          <div className="bg-white rounded-[1.5rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100">
             <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-1">
                   <LogOut size={32} className="text-red-500" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{t('logout')}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                     {t('logout_confirm')}
                  </p>
                </div>
                <div className="flex gap-3 w-full mt-4">
                   <button 
                     onClick={onLogout} 
                     className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 active:scale-95 transition-all"
                   >
                     {t('yes')}
                   </button>
                   <button 
                     onClick={() => setIsLogoutConfirmOpen(false)} 
                     className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 active:scale-95 transition-all"
                   >
                     {t('no')}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
