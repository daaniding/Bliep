'use client';

import { ReactNode } from 'react';
import StoneArchNav from './StoneArchNav';
import TopHud from './TopHud';

interface Props {
  children: ReactNode;
  hideNav?: boolean;
  hideTopBar?: boolean;
}

export default function GameShell({ children, hideNav = false, hideTopBar = false }: Props) {
  return (
    <div className="app-shell">
      {!hideTopBar && <TopHud />}

      <div className="content-stack relative z-10">
        {children}
      </div>

      {!hideNav && <StoneArchNav />}
    </div>
  );
}
