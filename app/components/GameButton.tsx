'use client';

import { ButtonHTMLAttributes } from 'react';

type Variant = 'gold' | 'blood' | 'forest' | 'night';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  gold: 'btn-game',
  blood: 'btn-game btn-game-blood',
  forest: 'btn-game btn-game-forest',
  night: 'btn-game btn-game-night',
};

export default function GameButton({
  variant = 'gold',
  fullWidth = false,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={`${VARIANT_CLASS[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  );
}
