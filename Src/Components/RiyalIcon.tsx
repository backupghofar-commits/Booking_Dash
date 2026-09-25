import React from 'react';

/**
 * Official Saudi Riyal symbol (glyph introduced 2025) as a scalable vector.
 * Uses currentColor so it adapts to any context (amber on light, white on dark).
 */
export const RiyalIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className = 'w-4 h-4',
  style,
}) => (
  <svg
    viewBox="0 0 120 120"
    className={className}
    style={style}
    fill="currentColor"
    role="img"
    aria-label="Saudi Riyal (SAR)"
  >
    {/* Left vertical stroke with bottom-left hook */}
    <path d="M46 11 L56 5 L56 77 C56 83.5 52.8 87.6 47.5 89.8 L18.5 101 L15.5 91 L45 79.6 C45.7 79.3 46 78.9 46 78 Z" />
    {/* Right vertical stroke */}
    <path d="M68 21 L78 14.5 L78 85 L68 89 Z" />
    {/* Main long crossbar (both strokes) */}
    <path d="M20.5 63 L103 45.5 L105 55.5 L22.5 73 Z" />
    {/* Middle-right bar */}
    <path d="M78 75.5 L103 70 L105 80 L78 85.5 Z" />
    {/* Bottom-right bar */}
    <path d="M70.5 105 L103 97.5 L105 107.5 L72.5 115 Z" />
  </svg>
);

export default RiyalIcon;
