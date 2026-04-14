'use client';

import { CSSProperties, ReactNode } from 'react';

/**
 * 9-slice background panel using CSS border-image. Tiny Swords UI sprites
 * (wood table, banner, paper, ribbons, buttons) are 3x3 cell sheets with
 * uniform corner/edge sizes — perfect for border-image stretch.
 *
 * The slice value tells border-image where the 3x3 grid lines are in the
 * source PNG. For 448x448 sprites with 3 cells, slice = 149. Border-width
 * controls how thick the rendered corners appear.
 */
export type UIPanelSkin =
  | 'wood_table'
  | 'banner'
  | 'paper'
  | 'paper_special'
  | 'big_red_button'
  | 'big_red_button_pressed'
  | 'big_blue_button'
  | 'big_blue_button_pressed';

interface SkinMeta {
  url: string;
  slice: number;
  defaultBorder: number;
  /** How the middle and edges should be repeated. `round` tiles cleanly. */
  repeat: 'stretch' | 'round' | 'repeat' | 'space';
}

const SKIN_META: Record<UIPanelSkin, SkinMeta> = {
  wood_table:               { url: '/assets/topdown/ui/wood_table.png',               slice: 149, defaultBorder: 28, repeat: 'stretch' },
  banner:                   { url: '/assets/topdown/ui/banner.png',                   slice: 149, defaultBorder: 28, repeat: 'stretch' },
  paper:                    { url: '/assets/topdown/ui/paper.png',                    slice: 106, defaultBorder: 24, repeat: 'round' },
  paper_special:            { url: '/assets/topdown/ui/paper_special.png',            slice: 106, defaultBorder: 24, repeat: 'round' },
  big_red_button:           { url: '/assets/topdown/ui/big_red_button.png',           slice: 106, defaultBorder: 20, repeat: 'stretch' },
  big_red_button_pressed:   { url: '/assets/topdown/ui/big_red_button_pressed.png',   slice: 106, defaultBorder: 20, repeat: 'stretch' },
  big_blue_button:          { url: '/assets/topdown/ui/big_blue_button.png',          slice: 106, defaultBorder: 20, repeat: 'stretch' },
  big_blue_button_pressed:  { url: '/assets/topdown/ui/big_blue_button_pressed.png',  slice: 106, defaultBorder: 20, repeat: 'stretch' },
};

interface Props {
  skin: UIPanelSkin;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Override the default border width (rendered thickness of the frame). */
  borderWidth?: number;
}

export default function UISprite({ skin, children, className = '', style = {}, borderWidth }: Props) {
  const meta = SKIN_META[skin];
  const bw = borderWidth ?? meta.defaultBorder;
  return (
    <div
      className={className}
      style={{
        borderStyle: 'solid',
        borderWidth: `${bw}px`,
        borderImageSource: `url("${meta.url}")`,
        borderImageSlice: `${meta.slice} fill`,
        borderImageWidth: `${bw}px`,
        borderImageOutset: 0,
        borderImageRepeat: meta.repeat,
        imageRendering: 'pixelated',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
