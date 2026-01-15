
import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '../constants';
import { Lock, Mail, ArrowLeft, X, User, Building2, ChevronRight, Check, ArrowRight as ArrowRightIcon, Briefcase, Globe, Loader2, Send, ShieldCheck, MapPin, Phone, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ARAB_LOCATIONS } from '../data/locations';

interface LoginPageProps {
  onLoginSuccess: (token: string) => void;
}

const COUNTRY_CODES: Record<string, string> = {
  "السعودية": "966",
  "الإمارات": "971",
  "مصر": "20",
  "الكويت": "965",
  "قطر": "974",
  "عمان": "968",
  "البحرين": "973",
  "الأردن": "962",
  "المغرب": "212",
  "الجزائر": "213",
  "تونس": "216",
  "العراق": "964",
  "لبنان": "961",
  "اليمن": "967",
  "فلسطين": "970",
  "السودان": "249",
  "ليبيا": "218",
  "سوريا": "963"
};

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Image handling
  const [logoError, setLogoError] = useState(false);
  const AppLogo = "/assets/images/app-logo.jpg";

  // Forgot Password State
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Registration State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerStep, setRegisterStep] = useState<'type' | 'form'>('type');
  const [registerType, setRegisterType] = useState<'individual' | 'company'>('individual');
  
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [regCountry, setRegCountry] = useState('');
  const [isDetectingCountry, setIsDetectingCountry] = useState(false);
  const [regPhone, setRegPhone] = useState('');
  
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Verification State
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [userIdForVerification, setUserIdForVerification] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState<string[]>(Array(6).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const longPressTimeoutRef = useRef<any>(null);
  
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (registerStep === 'form' && !regCountry) {
        setIsDetectingCountry(true);
        fetch(`${API_BASE_URL}/api/v1/auth/detect-country`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.countryAr) {
                    const exists = ARAB_LOCATIONS.find(loc => loc.countryAr === data.countryAr);
                    if (exists) {
                        setRegCountry(data.countryAr);
                    }
                }
            })
            .catch(() => {})
            .finally(() => {
                setIsDetectingCountry(false);
            });
    }
  }, [registerStep]);

  const submitVerificationCode = async (code: string) => {
    if (code.length !== 6) return;
    if (!userIdForVerification) return;

    setIsVerifying(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userIdForVerification, code })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            const userObj = data.user || {};
            const userId = userObj._id || userObj.id;
            
            if (userId) {
                localStorage.setItem('userId', userId);
                localStorage.setItem('userName', userObj.name || regName);
                localStorage.setItem('userEmail', userObj.email || regEmail);
                if (userObj.avatar) localStorage.setItem('userAvatar', userObj.avatar);
                if (userObj.username) localStorage.setItem('username', userObj.username);
            }
            onLoginSuccess(data.token);
        } else {
            alert(data.message || t('verify_error'));
            setIsVerifying(false);
        }
    } catch (e) {
        alert(t('error_occurred'));
        setIsVerifying(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newCode = [...verificationCode];
    newCode[index] = value.slice(-1);
    setVerificationCode(newCode);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    const fullCode = newCode.join('');
    if (fullCode.length === 6 && !newCode.includes('')) {
        otpRefs.current.forEach(ref => ref?.blur());
        setTimeout(() => {
            submitVerificationCode(fullCode);
        }, 300);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requireVerification) {
            setUserIdForVerification(data.userId);
            setIsVerificationOpen(true);
            setIsLoading(false);
            return;
        }

        setTimeout(() => {
            localStorage.setItem('token', data.token);
            const userObj = data.user || {};
            const userId = userObj._id || userObj.id || data.userId || data.id;
            
            if (userId) {
              localStorage.setItem('userId', userId);
              localStorage.setItem('userName', userObj.name || 'مستخدم');
              localStorage.setItem('userEmail', userObj.email || '');
              localStorage.setItem('userAvatar', userObj.avatar || '');
              localStorage.setItem('username', userObj.username || '');
            }
            onLoginSuccess(data.token);
        }, 800);
      } else {
        setError(data.message || 'فشل تسجيل الدخول. تأكد من البيانات.');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      // Detailed error for user to diagnose CORS
      setError('خطأ في الاتصال بالخادم. تأكد من الرابط أو إعدادات الأمان (CORS).');
      setIsLoading(false);
    }
  };

  // ... (Rest of the component remains same, omitted for brevity but preserved in real file)
  // Re-implementing necessary handlers to ensure file completeness

  const handleRegisterTypeSelect = (type: 'individual' | 'company') => {
    setRegisterType(type);
    setRegisterStep('form');
  };

  const handleRegisterSubmit = async () => {
    setRegisterError(null);

    if (!regName || !regEmail || !regPass || !regConfirmPass || !regCountry || !regPhone) {
        setRegisterError("يرجى ملء جميع الحقول");
        return;
    }
    if (regPass !== regConfirmPass) {
        setRegisterError("كلمات المرور غير متطابقة");
        return;
    }
    if (!agreedToPolicy) {
        setRegisterError(t('privacy_error_msg'));
        return;
    }

    let finalPhone = regPhone;
    const phoneCode = COUNTRY_CODES[regCountry];

    if (regCountry === 'السعودية') {
        const cleanDigits = regPhone.replace(/\D/g, '');
        let isValidSaudi = false;
        
        if (/^(05)\d{8}$/.test(cleanDigits)) {
            finalPhone = `+966${cleanDigits.substring(1)}`;
            isValidSaudi = true;
        } else if (/^5\d{8}$/.test(cleanDigits)) {
            finalPhone = `+966${cleanDigits}`;
            isValidSaudi = true;
        } else if (/^9665\d{8}$/.test(cleanDigits)) {
            finalPhone = `+${cleanDigits}`;
            isValidSaudi = true;
        }

        if (!isValidSaudi) {
            setRegisterError("رقم الجوال غير صحيح. للسعودية يجب أن يبدأ بـ 05");
            return;
        }
    } else {
        if (regPhone.length < 8) {
            setRegisterError("رقم الهاتف قصير جداً");
            return;
        }
        if (phoneCode && !regPhone.startsWith('+')) {
             const cleanNumber = regPhone.replace(/^0+/, '');
             finalPhone = `+${phoneCode}${cleanNumber}`;
        }
    }

    setIsRegistering(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: regName,
                email: regEmail,
                password: regPass,
                userType: registerType,
                country: regCountry,
                phone: finalPhone
            })
        });

        const data = await response.json();

        if (response.ok) {
            setUserIdForVerification(data.userId);
            setIsRegistering(false);
            setIsRegisterOpen(false);
            setIsVerificationOpen(true);
        } else {
            setRegisterError(data.message || "فشل إنشاء الحساب");
            setIsRegistering(false);
        }
    } catch (e) {
        setRegisterError("خطأ في الاتصال");
        setIsRegistering(false);
    }
  };

  const handleVerifyButton = async () => {
    const code = verificationCode.join('');
    if (code.length !== 6) {
        alert("يرجى إدخال الرمز المكون من 6 أرقام");
        return;
    }
    submitVerificationCode(code);
  };

  const handleResendCode = async () => {
    if (!userIdForVerification) return;
    setIsResending(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userIdForVerification })
        });
        if (response.ok) alert(t('resend_code_sent'));
        else {
            const data = await response.json();
            alert(data.message || "فشل إعادة الإرسال");
        }
    } catch (e) {
        alert(t('error_occurred'));
    } finally {
        setIsResending(false);
    }
  };

  const handleResetPassword = async () => {
    if (!forgotEmail.trim()) {
        setResetMessage({ type: 'error', text: 'الرجاء إدخال البريد الإلكتروني' });
        return;
    }
    setIsResetting(true);
    setResetMessage(null);
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/forgotpassword`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: forgotEmail })
        });
        if (response.ok) {
            setResetMessage({ type: 'success', text: t('reset_link_sent') });
            setTimeout(() => {
                setIsForgotPasswordOpen(false);
                setResetMessage(null);
                setForgotEmail('');
            }, 3000);
        } else {
            const data = await response.json();
            setResetMessage({ type: 'error', text: data.message || t('reset_link_fail') });
        }
    } catch (error) {
        setResetMessage({ type: 'error', text: t('error_occurred') });
    } finally {
        setIsResetting(false);
    }
  };

  const getPlaceholderName = () => {
      switch(registerType) {
          case 'company': return t('register_company_name_placeholder');
          default: return t('register_name_placeholder');
      }
  };

  const selectedPhoneCode = regCountry ? COUNTRY_CODES[regCountry] : "";

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden font-sans">
      
      {/* Header */}
      <div className="relative h-[25vh] w-full bg-gradient-to-br from-blue-600 via-cyan-500 to-green-500 rounded-b-[40px] shadow-lg flex flex-col items-center justify-center flex-shrink-0">
          <div className={`absolute top-safe top-4 z-20 ${language === 'ar' ? 'left-4' : 'right-4'}`}>
            <button 
                onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white py-1.5 px-3 rounded-full transition-colors backdrop-blur-sm"
            >
                <Globe size={14} className="text-white" />
                <span className="text-xs font-bold text-white">{language === 'ar' ? 'English' : 'العربية'}</span>
            </button>
          </div>
          <h1 className="text-3xl font-black text-white mb-6 tracking-tight drop-shadow-md">{t('app_name')}</h1>
          <div className="absolute -bottom-10 shadow-xl rounded-2xl bg-white p-2">
             <div className="w-24 h-24 rounded-xl overflow-hidden bg-white flex items-center justify-center">
               {!logoError ? (
                 <img src={AppLogo} alt="Logo" className="w-full h-full object-contain p-2" onError={() => setLogoError(true)} />
               ) : (
                 <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                    <Briefcase size={36} className="text-white" />
                 </div>
               )}
             </div>
          </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-8 pt-16 pb-safe overflow-y-auto">
          <div className="text-center mb-6">
             <h1 className="text-2xl font-black text-gray-900 mb-1">{t('login_title')}</h1>
             <p className="text-gray-500 text-sm font-medium">{t('login_subtitle')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3 w-full max-w-sm mx-auto">
            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 px-1">{t('email_label')}</label>
                <div className="relative group">
                    <div className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none`}>
                        <Mail size={18} className="text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                    </div>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`block w-full py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-sm ${language === 'ar' ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left'}`}
                        placeholder={t('email_placeholder')}
                        dir="ltr"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 px-1">{t('password_label')}</label>
                <div className="relative group">
                    <div className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none`}>
                        <Lock size={18} className="text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                    </div>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`block w-full py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-sm ${language === 'ar' ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left'}`}
                        placeholder="••••••••"
                        dir="ltr"
                    />
                </div>
            </div>

            {error && (
              <div className="py-3 px-4 rounded-xl bg-red-50 text-red-600 text-xs font-bold text-center border border-red-100 flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-200">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-base shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
              ) : (
                  <>
                    <span>{t('login_button')}</span>
                    {language === 'ar' ? <ArrowLeft size={18} /> : <ArrowRightIcon size={18} />}
                  </>
              )}
            </button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
             <button type="button" onClick={() => setIsForgotPasswordOpen(true)} className="text-xs text-gray-500 hover:text-blue-600 transition-colors font-bold">
                {t('forgot_password')}
             </button>
             <div className="flex items-center w-full gap-4">
                <div className="h-px bg-gray-100 flex-1"></div>
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">OR</span>
                <div className="h-px bg-gray-100 flex-1"></div>
             </div>
             <button onClick={() => setIsRegisterOpen(true)} className="w-full py-3 border-2 border-gray-100 hover:border-blue-100 bg-white text-gray-700 hover:text-blue-600 rounded-xl font-bold text-sm transition-all">
               {t('create_new_account')}
             </button>
          </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => { setIsForgotPasswordOpen(false); setResetMessage(null); }} />
            <div className="bg-white w-full max-w-md rounded-t-3xl relative z-10 animate-in slide-in-from-bottom duration-300 pb-safe shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-gray-900">{t('forgot_password_title')}</h3>
                    <button onClick={() => { setIsForgotPasswordOpen(false); setResetMessage(null); }} className="bg-gray-50 p-2 rounded-full hover:bg-gray-100 transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>
                <div className="space-y-4">
                    <p className="text-sm text-gray-500 font-medium leading-relaxed">{t('forgot_password_desc')}</p>
                    <div className="relative group">
                        <div className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none`}>
                            <Mail size={20} className="text-gray-400" />
                        </div>
                        <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className={`block w-full py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-sm ${language === 'ar' ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'}`} placeholder={t('email_placeholder')} dir="ltr" />
                    </div>
                    {resetMessage && (
                        <div className={`py-3 px-4 rounded-xl text-xs font-bold text-center border flex items-center justify-center gap-2 animate-in zoom-in ${resetMessage.type === 'success' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                            {resetMessage.type === 'success' ? <Check size={16} /> : <X size={16} />}
                            {resetMessage.text}
                        </div>
                    )}
                    <button onClick={handleResetPassword} disabled={isResetting} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                        {isResetting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className={language === 'ar' ? 'rotate-180' : ''} />}
                        <span>{isResetting ? t('sending') : t('send')}</span>
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Registration Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => { setIsRegisterOpen(false); setRegisterError(null); }} />
            <div className="bg-white w-full max-w-md rounded-t-[2rem] p-6 relative z-10 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl">
                <div className="flex items-center justify-between mb-6 sticky top-0 bg-white z-20 pb-2 border-b border-gray-50">
                    <h2 className="text-xl font-black text-gray-900">{registerStep === 'type' ? t('register_title') : t('register_subtitle')}</h2>
                    <button onClick={() => { setIsRegisterOpen(false); setRegisterError(null); }} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors"><X size={20} className="text-gray-500" /></button>
                </div>
                {registerStep === 'type' ? (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500 font-bold mb-4">{t('register_choose_type')}</p>
                        <button onClick={() => handleRegisterTypeSelect('individual')} className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 transition-all group">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform shadow-sm"><User size={24} /></div>
                            <div className={`flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                                <h3 className="font-bold text-gray-900 text-base">{t('register_individual_title')}</h3>
                                <p className="text-xs text-gray-500 mt-1 font-medium">{t('register_individual_desc')}</p>
                            </div>
                            <ChevronRight className={`text-gray-300 group-hover:text-blue-500 ${language === 'ar' ? 'rotate-180' : ''}`} />
                        </button>
                        <button onClick={() => handleRegisterTypeSelect('company')} className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-purple-50 hover:border-purple-200 transition-all group">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform shadow-sm"><Building2 size={24} /></div>
                            <div className={`flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                                <h3 className="font-bold text-gray-900 text-base">{t('register_commercial_title')}</h3>
                                <p className="text-xs text-gray-500 mt-1 font-medium">{t('register_commercial_desc')}</p>
                            </div>
                            <ChevronRight className={`text-gray-300 group-hover:text-purple-500 ${language === 'ar' ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                ) : (
                    <div className={`space-y-4 animate-in ${language === 'ar' ? 'slide-in-from-right' : 'slide-in-from-left'} duration-300`}>
                        <div><label className="block text-xs font-bold text-gray-500 mb-1.5 px-1">{getPlaceholderName()}</label><input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} className={`w-full p-3.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-sm ${language === 'ar' ? 'text-right' : 'text-left'}`} placeholder={getPlaceholderName()} /></div>
                        <div><label className="block text-xs font-bold text-gray-500 mb-1.5 px-1">{t('email_label')}</label><input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className={`w-full p-3.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-sm dir-ltr ${language === 'ar' ? 'text-right' : 'text-left'}`} placeholder="example@mail.com" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1.5 px-1">{t('register_country_label')}</label><div className="relative"><div className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-3' : 'left-0 pl-3'} flex items-center pointer-events-none`}>{isDetectingCountry ? (<Loader2 size={16} className="text-blue-500 animate-spin" />) : (<MapPin size={16} className="text-gray-400" />)}</div><select value={regCountry} onChange={(e) => setRegCountry(e.target.value)} className={`w-full p-3.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-sm appearance-none ${language === 'ar' ? 'pr-10 text-right' : 'pl-10 text-left'}`}><option value="" disabled>{t('select_country')}</option>{ARAB_LOCATIONS.map((loc) => (<option key={loc.countryAr} value={loc.countryAr}>{language === 'en' ? loc.countryEn : loc.countryAr}</option>))}</select></div></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1.5 px-1">{t('register_phone_label')}</label><div className="relative dir-ltr"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 font-bold text-sm">{selectedPhoneCode ? `+${selectedPhoneCode}` : <Phone size={16} className="text-gray-400" />}</div><input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} className={`w-full p-3.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-sm ${selectedPhoneCode ? 'pl-16' : 'pl-10 text-left'}`} placeholder={selectedPhoneCode ? "5..." : "05..."} /></div></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1.5 px-1">{t('password_label')}</label><input type="password" value={regPass} onChange={(e) => setRegPass(e.target.value)} className={`w-full p-3.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-sm ${language === 'ar' ? 'text-right' : 'text-left'}`} placeholder="••••••••" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1.5 px-1">{t('confirm_password')}</label><input type="password" value={regConfirmPass} onChange={(e) => setRegConfirmPass(e.target.value)} className={`w-full p-3.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-sm ${language === 'ar' ? 'text-right' : 'text-left'}`} placeholder="••••••••" /></div>
                        </div>
                        <div className="flex items-center gap-2 mt-4 px-2 py-3 bg-blue-50 rounded-xl border border-blue-100">
                            <div onClick={() => { setAgreedToPolicy(!agreedToPolicy); if (!agreedToPolicy) setRegisterError(null); }} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-colors flex-shrink-0 ${agreedToPolicy ? 'bg-blue-600 border-blue-600' : 'border-gray-400 bg-white'}`}>{agreedToPolicy && <Check size={14} className="text-white" strokeWidth={3} />}</div>
                            <span className="text-xs font-bold text-gray-700">{t('i_agree_to')} <button type="button" onClick={() => setShowPrivacyPolicy(true)} className="text-blue-600 underline mx-1 font-bold hover:text-blue-700">{t('privacy_policy_link')}</button></span>
                        </div>
                        {registerError && <div className="py-3 px-4 bg-red-50 text-red-600 rounded-xl text-xs font-bold text-center border border-red-100 animate-in fade-in slide-in-from-top-1">{registerError}</div>}
                        <div className="pt-2 space-y-3">
                            <button onClick={handleRegisterSubmit} disabled={isRegistering} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-lg shadow-blue-200 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">{isRegistering && <Loader2 size={18} className="animate-spin" />}{isRegistering ? t('registering') : t('register_button')}</button>
                            <button onClick={() => { setRegisterStep('type'); setRegisterError(null); }} className="w-full py-3 text-gray-500 text-sm font-bold hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-colors">{t('back')}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Verification Code Bottom Sheet */}
      {isVerificationOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => { if(!isVerifying) setIsVerificationOpen(false); }} />
            <div className="bg-white w-full max-w-md rounded-t-[2.5rem] relative z-10 animate-in slide-in-from-bottom duration-300 pb-safe shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-br from-blue-600 via-cyan-500 to-green-500 p-6 pb-8 text-white relative">
                    <button onClick={() => { if(!isVerifying) setIsVerificationOpen(false); }} className="absolute top-4 right-4 bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"><X size={20} className="text-white" /></button>
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-inner border border-white/30"><ShieldCheck size={32} className="text-white" /></div>
                        <h3 className="font-bold text-xl">{t('verify_title')}</h3>
                    </div>
                </div>
                <div className="p-6 -mt-4 bg-white rounded-t-[2.5rem] relative z-20">
                    <div className="space-y-6 text-center">
                        <div><p className="text-sm text-gray-500 font-bold mb-1">{t('verify_sent_desc')}</p><p className="text-base text-gray-900 font-black dir-ltr">{email || regEmail}</p></div>
                        <div className="flex justify-center gap-2 dir-ltr">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <input key={index} ref={(el) => { otpRefs.current[index] = el; }} type="tel" maxLength={1} value={verificationCode[index]} onChange={(e) => handleOtpChange(index, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(index, e)} className="w-12 h-12 border border-gray-200 rounded-xl text-center text-xl font-bold focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all placeholder:text-gray-300 bg-gray-50 focus:bg-white shadow-sm caret-green-600 leading-none py-2" placeholder="-" />
                            ))}
                        </div>
                        <div className="space-y-3">
                            <button onClick={handleVerifyButton} disabled={isVerifying} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-green-500 hover:from-blue-700 hover:to-green-600 text-white rounded-xl font-bold text-base shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                                {isVerifying ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                                <span>{isVerifying ? t('verifying') : t('verify_submit')}</span>
                            </button>
                            <button className="text-xs text-gray-400 font-bold hover:text-gray-600 transition-colors flex items-center justify-center gap-2 w-full py-2" onClick={handleResendCode} disabled={isResending}>{isResending && <Loader2 size={12} className="animate-spin" />}{t('resend_code')}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Internal Privacy Policy View */}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-right duration-300">
            <div className="px-4 py-4 border-b border-gray-100 flex items-center gap-3 sticky top-0 bg-white z-10 pt-safe">
                <button onClick={() => setShowPrivacyPolicy(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft size={24} className={`text-gray-800 ${language === 'ar' ? '' : 'rotate-180'}`} /></button>
                <h2 className="text-lg font-bold text-gray-900">{t('privacy_policy_link')}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-5 pb-safe">
                <h3 className="text-xl font-black text-gray-900 mb-4">{t('privacy_title')}</h3>
                <p className="text-gray-600 text-sm leading-loose whitespace-pre-wrap">{t('privacy_desc')}</p>
            </div>
        </div>
      )}

    </div>
  );
};

export default LoginPage;
