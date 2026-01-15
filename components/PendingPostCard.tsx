
import React from 'react';
import { Post } from '../types';
import { Loader2, CheckCircle } from 'lucide-react';

interface PendingPostCardProps {
  post: Post;
  status?: 'publishing' | 'success';
}

const PendingPostCard: React.FC<PendingPostCardProps> = ({ status = 'publishing' }) => {
  const isSuccess = status === 'success';

  return (
    <div className={`mx-3 my-2 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm border transition-all duration-500 transform ${
        isSuccess 
        ? 'bg-green-50 border-green-200' 
        : 'bg-white border-blue-100'
    }`}>
      
      {/* Right Side: Text & Subtext */}
      <div className="flex-1">
        <h3 className={`text-sm font-bold transition-colors duration-300 ${isSuccess ? 'text-green-700' : 'text-gray-800'}`}>
           {isSuccess ? 'تم نشر المنشور بنجاح' : 'جاري نشر منشورك...'}
        </h3>
        {!isSuccess && (
           <p className="text-[10px] text-gray-500 mt-0.5">يرجى الانتظار، يتم الرفع في الخلفية</p>
        )}
      </div>

      {/* Left Side: Icon Indicator */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${isSuccess ? 'bg-green-200' : 'bg-blue-50'}`}>
        {isSuccess ? (
           <CheckCircle size={18} className="text-green-700 animate-in zoom-in duration-300" />
        ) : (
           <Loader2 size={18} className="text-blue-600 animate-spin" />
        )}
      </div>

    </div>
  );
};

export default PendingPostCard;
