import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Series,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';
import data from './remotion-data.json';

const Scene: React.FC<{ scene: (typeof data.scenes)[0] }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // === Cinematic Ken Burns (slow zoom + subtle pan) ===
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.12], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  const translateX = interpolate(frame, [0, durationInFrames], [0, -40], {
    extrapolateRight: 'clamp',
  });

  // === Smooth fade in / out ===
  const opacity = interpolate(
    frame,
    [0, 18, durationInFrames - 22, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // === Word-by-word spring reveal ===
  const words = (scene.textOverlay || '').split(' ');

  const isCharacterScene = Array.isArray(scene.image);

  // === Corner bracket entrance (anime UI style) ===
  const cornerSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 120, mass: 0.6 },
  });
  const cornerOpacity = interpolate(cornerSpring, [0, 1], [0, 1]);
  const cornerInset = interpolate(cornerSpring, [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* ========== BACKGROUND ========== */}
      {isCharacterScene ? (
        // Character collage - horizontal for long-form
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            height: '100%',
            opacity,
          }}
        >
          {scene.image.map((img: string, i: number) => (
            <Img
              key={i}
              src={staticFile(img)}
              style={{
                width: `${100 / scene.image.length}%`,
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center top',
              }}
            />
          ))}
        </div>
      ) : (
        <Img
          src={staticFile(scene.image)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            transform: `scale(${scale}) translateX(${translateX}px)`,
            opacity,
          }}
        />
      )}

      {/* ========== CINEMATIC GRADIENT + VIGNETTE ========== */}
      <AbsoluteFill
        style={{
          background: `
            linear-gradient(
              to bottom,
              rgba(0,0,0,0.65) 0%,
              rgba(0,0,0,0.25) 35%,
              rgba(0,0,0,0.35) 65%,
              rgba(0,0,0,0.88) 100%
            )
          `,
        }}
      />
      {/* Soft vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ========== ANIME HALFTONE CORNER ACCENTS ========== */}
      <AbsoluteFill style={{ pointerEvents: 'none', opacity: cornerOpacity }}>
        {/* top-left halftone burst */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 260,
            height: 260,
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.55) 2.5px, transparent 2.5px)',
            backgroundSize: '16px 16px',
            WebkitMaskImage:
              'radial-gradient(circle at top left, black 0%, transparent 70%)',
            maskImage:
              'radial-gradient(circle at top left, black 0%, transparent 70%)',
          }}
        />
        {/* bottom-right halftone burst */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 260,
            height: 260,
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.4) 2.5px, transparent 2.5px)',
            backgroundSize: '16px 16px',
            WebkitMaskImage:
              'radial-gradient(circle at bottom right, black 0%, transparent 70%)',
            maskImage:
              'radial-gradient(circle at bottom right, black 0%, transparent 70%)',
          }}
        />
      </AbsoluteFill>

      {/* ========== MANGA-STYLE CORNER BRACKETS ========== */}
      <AbsoluteFill style={{ pointerEvents: 'none', opacity: cornerOpacity }}>
        {/* top-left */}
        <div
          style={{
            position: 'absolute',
            top: 36 + cornerInset,
            left: 36 + cornerInset,
            width: 70,
            height: 70,
            borderTop: '5px solid #ffffff',
            borderLeft: '5px solid #ffffff',
            filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.8))',
          }}
        />
        {/* top-right */}
        <div
          style={{
            position: 'absolute',
            top: 36 + cornerInset,
            right: 36 + cornerInset,
            width: 70,
            height: 70,
            borderTop: '5px solid #ffffff',
            borderRight: '5px solid #ffffff',
            filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.8))',
          }}
        />
        {/* bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: 36 + cornerInset,
            left: 36 + cornerInset,
            width: 70,
            height: 70,
            borderBottom: '5px solid #ffffff',
            borderLeft: '5px solid #ffffff',
            filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.8))',
          }}
        />
        {/* bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: 36 + cornerInset,
            right: 36 + cornerInset,
            width: 70,
            height: 70,
            borderBottom: '5px solid #ffffff',
            borderRight: '5px solid #ffffff',
            filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.8))',
          }}
        />
      </AbsoluteFill>

      {/* ========== MANGA PANEL FRAME (double border) ========== */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          border: '14px solid #ffffff',
          boxSizing: 'border-box',
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          margin: 14,
          border: '4px solid #0a0a0a',
          boxSizing: 'border-box',
        }}
      />

      {/* ========== TEXT OVERLAY ========== */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 110,
          paddingLeft: 80,
          paddingRight: 80,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '0 14px',
            maxWidth: 1500,
          }}
        >
          {words.map((word, i) => {
            const delay = 12 + i * 4; // staggered entrance

            const wordSpring = spring({
              frame: frame - delay,
              fps,
              config: {
                damping: 18,
                stiffness: 160,
                mass: 0.7,
              },
            });

            const wordOpacity = interpolate(
              frame - delay,
              [0, 10],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );

            const translateY = interpolate(wordSpring, [0, 1], [28, 0]);
            const scaleWord = interpolate(wordSpring, [0, 1], [0.86, 1]);

            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  color: 'white',
                  fontSize: 64,
                  fontWeight: 800,
                  lineHeight: 1.25,
                  letterSpacing: '-0.5px',
                  fontFamily:
                    '"Poppins", "Arial Black", "Helvetica Neue", sans-serif',
                  // anime-subtitle style hard outline + soft glow
                  textShadow: `
                    -3px -3px 0 #000,
                    3px -3px 0 #000,
                    -3px 3px 0 #000,
                    3px 3px 0 #000,
                    0 0 18px rgba(255, 90, 160, 0.55),
                    0 6px 28px rgba(0,0,0,0.95)
                  `,
                  opacity: wordOpacity,
                  transform: `translateY(${translateY}px) scale(${scaleWord})`,
                  willChange: 'transform, opacity',
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* ========== AUDIO ========== */}
      <Audio src={staticFile(`anime-assets/${scene.audio}`)} />
    </AbsoluteFill>
  );
};

export const AnimeVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <Series>
        {data.scenes.map((scene) => (
          <Series.Sequence
            key={scene.id}
            durationInFrames={scene.durationInFrames}
            name={scene.id}
          >
            <Scene scene={scene} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};