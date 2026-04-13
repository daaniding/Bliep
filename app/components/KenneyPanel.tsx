'use client';

import { ReactNode, HTMLAttributes } from 'react';

type Variant = 'beige' | 'brown' | 'blue' | 'inset-beige' | 'inset-brown';

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  beige: 'kenney-panel',
  brown: 'kenney-panel-brown',
  blue: 'kenney-panel-blue',
  'inset-beige': 'kenney-panel-inset',
  'inset-brown': 'kenney-panel-inset-brown',
};

export default function KenneyPanel({
  variant = 'beige',
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <div {...rest} className={`${VARIANT_CLASS[variant]} ${className}`}>
      {children}
    </div>
  );
}
