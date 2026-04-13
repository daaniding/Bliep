'use client';

import { ButtonHTMLAttributes } from 'react';

type Variant = 'beige' | 'brown' | 'blue' | 'grey';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  xl?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  beige: '',
  brown: 'kenney-btn-brown',
  blue: 'kenney-btn-blue',
  grey: 'kenney-btn-grey',
};

export default function KenneyButton({
  variant = 'beige',
  xl = false,
  fullWidth = false,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={`kenney-btn ${VARIANT_CLASS[variant]} ${xl ? 'kenney-btn-xl' : ''} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  );
}
