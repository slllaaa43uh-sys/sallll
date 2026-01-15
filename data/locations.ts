
export interface City {
  ar: string;
  en: string;
}

export interface LocationData {
  countryAr: string;
  countryEn: string;
  flag: string;
  cities: City[];
}

export const ARAB_LOCATIONS: LocationData[] = [
  {
    countryAr: "السعودية",
    countryEn: "Saudi Arabia",
    flag: "🇸🇦",
    cities: [
      { ar: "الرياض", en: "Riyadh" }, { ar: "جدة", en: "Jeddah" }, { ar: "مكة المكرمة", en: "Makkah" }, { ar: "المدينة المنورة", en: "Madinah" }, { ar: "الدمام", en: "Dammam" }, { ar: "الخبر", en: "Khobar" }, { ar: "الطائف", en: "Taif" }, { ar: "تبوك", en: "Tabuk" }, { ar: "بريدة", en: "Buraydah" }, { ar: "خميس مشيط", en: "Khamis Mushait" }, { ar: "الهفوف", en: "Al Hofuf" }, { ar: "المبرز", en: "Al Mubarraz" }, { ar: "حائل", en: "Hail" }, { ar: "نجران", en: "Najran" }, { ar: "الجبيل", en: "Jubail" }, { ar: "أبها", en: "Abha" }, { ar: "ينبع", en: "Yanbu" }, { ar: "الخرج", en: "Al Kharj" }, { ar: "عرعر", en: "Arar" }, { ar: "سكاكا", en: "Sakaka" }
    ]
  },
  {
    countryAr: "الإمارات",
    countryEn: "UAE",
    flag: "🇦🇪",
    cities: [
      { ar: "أبو ظبي", en: "Abu Dhabi" }, { ar: "دبي", en: "Dubai" }, { ar: "الشارقة", en: "Sharjah" }, { ar: "عجمان", en: "Ajman" }, { ar: "رأس الخيمة", en: "Ras Al Khaimah" }, { ar: "الفجيرة", en: "Fujairah" }, { ar: "أم القيوين", en: "Umm Al Quwain" }, { ar: "العين", en: "Al Ain" }, { ar: "خورفكان", en: "Khor Fakkan" }, { ar: "كلباء", en: "Kalba" }
    ]
  },
  {
    countryAr: "مصر",
    countryEn: "Egypt",
    flag: "🇪🇬",
    cities: [
      { ar: "القاهرة", en: "Cairo" }, { ar: "الإسكندرية", en: "Alexandria" }, { ar: "الجيزة", en: "Giza" }, { ar: "شبرا الخيمة", en: "Shubra Al Khaymah" }, { ar: "بورسعيد", en: "Port Said" }, { ar: "السويس", en: "Suez" }, { ar: "الأقصر", en: "Luxor" }, { ar: "أسوان", en: "Aswan" }, { ar: "المنصورة", en: "Mansoura" }, { ar: "طنطا", en: "Tanta" }, { ar: "المحلة الكبرى", en: "El Mahalla El Kubra" }, { ar: "أسيوط", en: "Asyut" }, { ar: "الإسماعيلية", en: "Ismailia" }, { ar: "الفيوم", en: "Faiyum" }, { ar: "الزقازيق", en: "Zagazig" }, { ar: "دمياط", en: "Damietta" }, { ar: "قنا", en: "Qena" }, { ar: "سوهاج", en: "Sohag" }, { ar: "بني سويف", en: "Beni Suef" }, { ar: "الغردقة", en: "Hurghada" }
    ]
  },
  {
    countryAr: "الكويت",
    countryEn: "Kuwait",
    flag: "🇰🇼",
    cities: [
      { ar: "مدينة الكويت", en: "Kuwait City" }, { ar: "الأحمدي", en: "Al Ahmadi" }, { ar: "حولي", en: "Hawally" }, { ar: "السالمية", en: "Salmiya" }, { ar: "صباح السالم", en: "Sabah Al Salem" }, { ar: "الفروانية", en: "Al Farwaniyah" }, { ar: "الفحيحيل", en: "Fahaheel" }, { ar: "الجهراء", en: "Al Jahra" }
    ]
  },
  {
    countryAr: "قطر",
    countryEn: "Qatar",
    flag: "🇶🇦",
    cities: [
      { ar: "الدوحة", en: "Doha" }, { ar: "الريان", en: "Al Rayyan" }, { ar: "الوكرة", en: "Al Wakrah" }, { ar: "الخور", en: "Al Khor" }, { ar: "أم صلال", en: "Umm Salal" }, { ar: "الشمال", en: "Al Shamal" }, { ar: "مسيعيد", en: "Mesaieed" }
    ]
  },
  {
    countryAr: "عمان",
    countryEn: "Oman",
    flag: "🇴🇲",
    cities: [
      { ar: "مسقط", en: "Muscat" }, { ar: "صلالة", en: "Salalah" }, { ar: "صحار", en: "Sohar" }, { ar: "نزوى", en: "Nizwa" }, { ar: "صور", en: "Sur" }, { ar: "الرستاق", en: "Rustaq" }, { ar: "بركاء", en: "Barka" }, { ar: "السيب", en: "Seeb" }
    ]
  },
  {
    countryAr: "البحرين",
    countryEn: "Bahrain",
    flag: "🇧🇭",
    cities: [
      { ar: "المنامة", en: "Manama" }, { ar: "المحرق", en: "Muharraq" }, { ar: "الرفاع", en: "Riffa" }, { ar: "مدينة حمد", en: "Hamad Town" }, { ar: "مدينة عيسى", en: "Isa Town" }, { ar: "سترة", en: "Sitra" }
    ]
  },
  {
    countryAr: "الأردن",
    countryEn: "Jordan",
    flag: "🇯🇴",
    cities: [
      { ar: "عمان", en: "Amman" }, { ar: "الزرقاء", en: "Zarqa" }, { ar: "إربد", en: "Irbid" }, { ar: "الرصيفة", en: "Russeifa" }, { ar: "العقبة", en: "Aqaba" }, { ar: "السلط", en: "Salt" }, { ar: "مادبا", en: "Madaba" }, { ar: "جرش", en: "Jerash" }, { ar: "الكرك", en: "Karak" }
    ]
  },
  {
    countryAr: "المغرب",
    countryEn: "Morocco",
    flag: "🇲🇦",
    cities: [
      { ar: "الدار البيضاء", en: "Casablanca" }, { ar: "الرباط", en: "Rabat" }, { ar: "فاس", en: "Fes" }, { ar: "مراكش", en: "Marrakesh" }, { ar: "أكادير", en: "Agadir" }, { ar: "طنجة", en: "Tangier" }, { ar: "مكناس", en: "Meknes" }, { ar: "وجدة", en: "Oujda" }, { ar: "القنيطرة", en: "Kenitra" }, { ar: "تطوان", en: "Tetouan" }
    ]
  },
  {
    countryAr: "الجزائر",
    countryEn: "Algeria",
    flag: "🇩🇿",
    cities: [
      { ar: "الجزائر العاصمة", en: "Algiers" }, { ar: "وهران", en: "Oran" }, { ar: "قسنطينة", en: "Constantine" }, { ar: "عنابة", en: "Annaba" }, { ar: "البليدة", en: "Blida" }, { ar: "باتنة", en: "Batna" }, { ar: "سطيف", en: "Setif" }
    ]
  },
  {
    countryAr: "تونس",
    countryEn: "Tunisia",
    flag: "🇹🇳",
    cities: [
      { ar: "تونس", en: "Tunis" }, { ar: "صفاقس", en: "Sfax" }, { ar: "سوسة", en: "Sousse" }, { ar: "القيروان", en: "Kairouan" }, { ar: "بنزرت", en: "Bizerte" }, { ar: "قابس", en: "Gabes" }
    ]
  },
  {
    countryAr: "العراق",
    countryEn: "Iraq",
    flag: "🇮🇶",
    cities: [
      { ar: "بغداد", en: "Baghdad" }, { ar: "الموصل", en: "Mosul" }, { ar: "البصرة", en: "Basra" }, { ar: "أربيل", en: "Erbil" }, { ar: "النجف", en: "Najaf" }, { ar: "كربلاء", en: "Karbala" }, { ar: "كركوك", en: "Kirkuk" }, { ar: "السليمانية", en: "Sulaymaniyah" }
    ]
  },
  {
    countryAr: "لبنان",
    countryEn: "Lebanon",
    flag: "🇱🇧",
    cities: [
      { ar: "بيروت", en: "Beirut" }, { ar: "طرابلس", en: "Tripoli" }, { ar: "صيدا", en: "Sidon" }, { ar: "صور", en: "Tyre" }, { ar: "جونيه", en: "Jounieh" }, { ar: "زحلة", en: "Zahle" }, { ar: "بعلبك", en: "Baalbek" }
    ]
  },
  {
    countryAr: "اليمن",
    countryEn: "Yemen",
    flag: "🇾🇪",
    cities: [
      { ar: "صنعاء", en: "Sanaa" }, { ar: "عدن", en: "Aden" }, { ar: "تعز", en: "Taiz" }, { ar: "الحديدة", en: "Al Hudaydah" }, { ar: "إب", en: "Ibb" }, { ar: "المكلا", en: "Mukalla" }
    ]
  },
  {
    countryAr: "فلسطين",
    countryEn: "Palestine",
    flag: "🇵🇸",
    cities: [
      { ar: "القدس", en: "Jerusalem" }, { ar: "غزة", en: "Gaza" }, { ar: "الخليل", en: "Hebron" }, { ar: "نابلس", en: "Nablus" }, { ar: "رام الله", en: "Ramallah" }, { ar: "جنين", en: "Jenin" }, { ar: "بيت لحم", en: "Bethlehem" }, { ar: "أريحا", en: "Jericho" }
    ]
  },
  {
    countryAr: "السودان",
    countryEn: "Sudan",
    flag: "🇸🇩",
    cities: [
      { ar: "الخرطوم", en: "Khartoum" }, { ar: "أم درمان", en: "Omdurman" }, { ar: "بحري", en: "Bahri" }, { ar: "نيالا", en: "Nyala" }, { ar: "بورتسودان", en: "Port Sudan" }, { ar: "كسلا", en: "Kassala" }
    ]
  },
  {
    countryAr: "ليبيا",
    countryEn: "Libya",
    flag: "🇱🇾",
    cities: [
      { ar: "طرابلس", en: "Tripoli" }, { ar: "بنغازي", en: "Benghazi" }, { ar: "مصراتة", en: "Misrata" }, { ar: "البيضاء", en: "Bayda" }, { ar: "الزاوية", en: "Zawiya" }, { ar: "طبرق", en: "Tobruk" }
    ]
  },
  {
    countryAr: "سوريا",
    countryEn: "Syria",
    flag: "🇸🇾",
    cities: [
      { ar: "دمشق", en: "Damascus" }, { ar: "حلب", en: "Aleppo" }, { ar: "حمص", en: "Homs" }, { ar: "اللاذقية", en: "Latakia" }, { ar: "حماة", en: "Hama" }
    ]
  }
];

// Helper to get display string based on current language
export const getDisplayLocation = (
  countryAr: string, 
  cityAr: string | null, 
  language: 'ar' | 'en'
): { countryDisplay: string; cityDisplay: string | null; flag: string | null } => {
  
  if (countryAr === 'عام') {
    return {
      countryDisplay: language === 'en' ? 'General' : 'عام',
      cityDisplay: null,
      flag: '🌍'
    };
  }

  const countryData = ARAB_LOCATIONS.find(c => c.countryAr === countryAr);
  
  if (!countryData) {
    return {
      countryDisplay: countryAr,
      cityDisplay: cityAr,
      flag: null
    };
  }

  let cityDisplay = cityAr;
  if (cityAr) {
    if (cityAr === 'كل المدن' || cityAr === 'All Cities') {
       cityDisplay = language === 'en' ? 'All Cities' : 'كل المدن';
    } else {
       const cityData = countryData.cities.find(c => c.ar === cityAr);
       if (cityData && language === 'en') {
         cityDisplay = cityData.en;
       }
    }
  }

  return {
    countryDisplay: language === 'en' ? countryData.countryEn : countryData.countryAr,
    cityDisplay: cityDisplay,
    flag: countryData.flag
  };
};
