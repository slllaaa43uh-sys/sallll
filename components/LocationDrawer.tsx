
import React, { useState } from 'react';
import { X, MapPin, ChevronLeft, Globe } from 'lucide-react';
import { ARAB_LOCATIONS, LocationData } from '../data/locations';
import { useLanguage } from '../contexts/LanguageContext';

interface LocationDrawerProps {
  onClose: () => void;
  onSelect: (country: string, city: string | null) => void;
}

const LocationDrawer: React.FC<LocationDrawerProps> = ({ onClose, onSelect }) => {
  const { language, t } = useLanguage();
  const [view, setView] = useState<'countries' | 'cities'>('countries');
  const [selectedCountryObj, setSelectedCountryObj] = useState<LocationData | null>(null);

  const handleCountrySelect = (location: LocationData) => {
    setSelectedCountryObj(location);
    setView('cities');
  };

  const handleGeneralSelect = () => {
    onSelect('عام', null); // Always send Arabic 'عام'
    onClose();
  };

  const handleAllCitiesSelect = () => {
    if (selectedCountryObj) {
      onSelect(selectedCountryObj.countryAr, null); // Send Arabic Country
      onClose();
    }
  };

  const handleCitySelect = (cityAr: string) => {
    if (selectedCountryObj) {
      onSelect(selectedCountryObj.countryAr, cityAr); // Send Arabic Country & City
      onClose();
    }
  };

  const getCountryName = (loc: LocationData) => language === 'en' ? loc.countryEn : loc.countryAr;
  const getCityName = (city: { ar: string, en: string }) => language === 'en' ? city.en : city.ar;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 z-[90] transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 h-[60vh] bg-white z-[100] rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.15)] flex flex-col animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
           <div className="flex items-center gap-2">
             {view === 'cities' ? (
                <button 
                  onClick={() => setView('countries')}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <ChevronLeft size={24} className={`text-gray-600 ${language === 'en' ? 'rotate-180' : ''}`} />
                </button>
             ) : (
                <div className="w-8"></div> // Spacer
             )}
             <span className="font-bold text-gray-800 text-lg">
               {view === 'countries' 
                 ? t('location_select_country') 
                 : (language === 'en' ? `Cities in ${selectedCountryObj?.countryEn}` : `مدن ${selectedCountryObj?.countryAr}`)
               }
             </span>
           </div>
           
           <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
             <X size={24} className="text-gray-500" />
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
          
          {view === 'countries' && (
            <div className="flex flex-col gap-1">
              {/* General Option */}
              <button 
                onClick={handleGeneralSelect}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
              >
                <div className="bg-blue-100 p-2 rounded-full group-hover:bg-blue-200 transition-colors">
                  <Globe size={20} className="text-blue-600" />
                </div>
                <span className="font-bold text-gray-700">{t('location_general')}</span>
              </button>
              
              <div className="h-px bg-gray-100 my-1 mx-4"></div>

              {/* Countries List */}
              {ARAB_LOCATIONS.map((loc) => (
                <button 
                  key={loc.countryAr}
                  onClick={() => handleCountrySelect(loc)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                      <span className="text-2xl">{loc.flag}</span>
                      <span className="font-medium text-gray-800">{getCountryName(loc)}</span>
                  </div>
                  <ChevronLeft size={18} className={`text-gray-300 ${language === 'en' ? 'rotate-180' : ''}`} />
                </button>
              ))}
            </div>
          )}

          {view === 'cities' && selectedCountryObj && (
            <div className="flex flex-col gap-1">
              {/* All Cities Option */}
              <button 
                onClick={handleAllCitiesSelect}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
              >
                <div className="bg-blue-100 p-2 rounded-full group-hover:bg-blue-200 transition-colors">
                  <MapPin size={20} className="text-blue-600" />
                </div>
                <span className="font-bold text-gray-700">{t('location_all_cities')}</span>
              </button>

              <div className="h-px bg-gray-100 my-1 mx-4"></div>

              {/* Cities List */}
              {selectedCountryObj.cities.map((city) => (
                <button 
                  key={city.ar}
                  onClick={() => handleCitySelect(city.ar)} // Pass AR name
                  className="flex items-center justify-start p-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-700">{getCityName(city)}</span>
                </button>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default LocationDrawer;
