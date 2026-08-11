import React from 'react';

/**
 * MockMate Official Logo Icon Mark (Tile)
 */
export function LogoMark({ className = "h-8 w-8", alt = "MockMate Icon" }) {
  return (
    <img
      src="/logo-tile.png"
      alt={alt}
      className={`object-contain rounded-lg flex-shrink-0 ${className}`}
    />
  );
}

/**
 * MockMate Official Full Wordmark Logo (Text + Smile Arc)
 */
export function LogoWordmark({
  className = "h-7",
  dark = false,
  alt = "MockMate",
  nudge = true
}) {
  const logoSrc = dark ? "/logo-dark.png" : "/logo-transparent.png";
  return (
    <img
      src={logoSrc}
      alt={alt}
      className={`object-contain w-auto flex-shrink-0 ${nudge ? 'translate-y-[2.5px]' : ''} ${className}`}
    />
  );
}

export default function Logo({ variant = "full", size = "md", dark = false, nudge = true, className = "" }) {
  const heightMap = {
    sm: "h-5 sm:h-6",
    md: "h-6 sm:h-7",
    lg: "h-9 sm:h-10",
    xl: "h-12 sm:h-14"
  };

  const currentHeight = heightMap[size] || heightMap.md;

  if (variant === "mark") {
    return <LogoMark className={`${currentHeight} w-auto ${className}`} />;
  }

  return (
    <LogoWordmark
      className={`${currentHeight} ${className}`}
      dark={dark}
      nudge={nudge}
    />
  );
}
