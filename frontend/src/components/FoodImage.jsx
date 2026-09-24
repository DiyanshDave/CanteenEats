import { useEffect, useState } from "react";

const FoodImage = ({ src, alt = "", className = "", imageClassName = "", fallbackClassName = "" }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  return (
    <div className={`overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-blue-50 ${className}`}>
      {src && !failed ? (
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`h-full w-full object-cover ${imageClassName}`} />
      ) : (
        <div className={`flex h-full w-full items-center justify-center text-orange-300 ${fallbackClassName}`} aria-hidden="true">
          <svg viewBox="0 0 64 64" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 30h36l-3.5 20h-29L14 30Z" strokeLinejoin="round" />
            <path d="M22 30a10 10 0 0 1 20 0M24 37v5m8-5v5m8-5v5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default FoodImage;
