import type { CSSProperties } from 'react';

interface BrandMarkProps {
  size?: number;
  alt?: string;
  src?: '/brand/quantnance-mark.svg' | '/brand/quantnance-app-icon.svg';
  style?: CSSProperties;
}

export default function BrandMark({
  size = 32,
  alt = 'Quantnance',
  src = '/brand/quantnance-mark.svg',
  style,
}: BrandMarkProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}