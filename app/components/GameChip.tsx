'use client';

import CountUp from './CountUp';

interface Props {
  variant: 'gold' | 'trophy' | 'streak';
  value: number;
  icon: string;
  href?: string;
  onClick?: () => void;
}

const VARIANT_CLASS: Record<Props['variant'], string> = {
  gold: 'chip-game',
  trophy: 'chip-game chip-trophy',
  streak: 'chip-game chip-streak',
};

export default function GameChip({ variant, value, icon, href, onClick }: Props) {
  const className = `${VARIANT_CLASS[variant]} active:scale-95 transition-transform`;
  const inner = (
    <>
      <span className="text-base leading-none">{icon}</span>
      <CountUp value={value} />
    </>
  );
  if (href) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}
