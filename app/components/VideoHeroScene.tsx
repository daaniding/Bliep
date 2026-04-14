'use client';

/**
 * VideoHeroScene — looping Runway-generated medieval kingdom video
 * (/dashboard-hero.mp4) as the home backdrop. Lightweight wrapper:
 * just the video plus a bottom fade so the CTA stays legible. No
 * 3D, no sprite scene — this is the version the user actually liked.
 */

export default function VideoHeroScene() {
  return (
    <div className="video-hero">
      <video
        src="/dashboard-hero.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="video-el"
      />
      <div className="bottom-fade" />
      <div className="top-fade" />

      <style jsx>{`
        .video-hero {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background: #0d0a06;
        }
        .video-el {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(1.08) contrast(1.03);
        }
        .bottom-fade {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 38%;
          background: linear-gradient(
            180deg,
            rgba(10, 5, 0, 0)   0%,
            rgba(10, 5, 0, 0.55) 55%,
            rgba(10, 5, 0, 0.88) 100%
          );
          pointer-events: none;
        }
        .top-fade {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 22%;
          background: linear-gradient(
            180deg,
            rgba(10, 5, 0, 0.55) 0%,
            rgba(10, 5, 0, 0)    100%
          );
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
