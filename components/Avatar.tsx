import React from 'react';

interface AvatarProps {
  name: string;
  src?: string | null;
  className?: string;
  textClassName?: string;
}

const Avatar: React.FC<AvatarProps> = ({ name, src, className = 'w-10 h-10', textClassName = 'text-lg' }) => {

  const getFirstLetter = (nameStr: string): string => {
    if (!nameStr) return '?';
    return nameStr.trim().charAt(0).toUpperCase();
  };

  // Consistent gradient generation from name
  const generateGradient = (nameStr: string): string => {
    let hash = 0;
    if (!nameStr) {
        nameStr = "Default";
    }
    for (let i = 0; i < nameStr.length; i++) {
        hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    const s = 60 + (hash % 10);
    const l = 45 + (hash % 10);
    const l2 = 55 + (hash % 10);
    
    return `linear-gradient(135deg, hsl(${h}, ${s}%, ${l}%) 0%, hsl(${(h + 40) % 360}, ${s}%, ${l2}%) 100%)`;
  };

  const initial = getFirstLetter(name);

  // Check if src is a valid-looking URL or path.
  const isValidSrc = src && (src.startsWith('http') || src.startsWith('/') || src.startsWith('blob:'));

  if (isValidSrc) {
    return (
      <img
        src={src}
        alt={name}
        className={`${className} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${className} rounded-full flex items-center justify-center text-white font-bold select-none`}
      style={{ background: generateGradient(name) }}
    >
      <span className={textClassName}>{initial}</span>
    </div>
  );
};

export default Avatar;
