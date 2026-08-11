import React from 'react';

/**
 * MockMate Official Logo Icon Mark
 */
export function LogoMark({ className = "h-8 w-8", darkBg = true, ariaLabel = "MockMate Icon" }) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={ariaLabel}
      role="img"
    >
      {darkBg && <rect width="128" height="128" rx="30" fill="#0A0712" />}
      {/* White Ring 'O' */}
      <circle cx="64" cy="48" r="22" stroke="#FFFFFF" strokeWidth="12" fill="none" />
      {/* Purple Smile Arc */}
      <path
        d="M 40 76 A 25 25 0 0 0 88 76"
        stroke="#7C3AED"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * MockMate Official Full Wordmark Logo with Signature Purple Smile under 'o'
 */
export function LogoWordmark({
  className = "h-8",
  textColor = "text-slate-900",
  showIcon = true,
  darkBg = true
}) {
  return (
    <div className={`inline-flex items-center gap-2.5 font-bold text-xl tracking-tight ${textColor} select-none`}>
      {showIcon && <LogoMark className={`${className} w-auto aspect-square flex-shrink-0`} darkBg={darkBg} />}
      <span className="relative font-extrabold tracking-tight text-current flex items-center">
        {/* MockMate typography with signature purple smile under the first 'o' */}
        <span>M</span>
        <span className="relative inline-block">
          o
          <svg
            viewBox="0 0 40 20"
            className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-[115%] h-2.5 overflow-visible pointer-events-none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M 4 4 A 16 16 0 0 0 36 4"
              stroke="#7C3AED"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span>ckMate</span>
      </span>
    </div>
  );
}

export default function Logo({ variant = "full", size = "md", dark = false, className = "" }) {
  const sizeMap = {
    sm: "h-6 text-lg",
    md: "h-8 text-xl",
    lg: "h-10 text-2xl",
    xl: "h-14 text-4xl"
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const textColor = dark ? "text-white" : "text-slate-900";

  if (variant === "mark") {
    return <LogoMark className={`${currentSize} w-auto ${className}`} darkBg={true} />;
  }

  return (
    <LogoWordmark
      className={currentSize.split(' ')[0]}
      textColor={textColor}
      showIcon={variant === "full"}
      darkBg={true}
    />
  );
}
