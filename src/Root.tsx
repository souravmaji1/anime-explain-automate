import React from 'react';
import { Composition } from 'remotion';
import { AnimeVideo } from './AnimeVideo';
import data from './remotion-data.json';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="AnimeVideo"
      component={AnimeVideo}
      durationInFrames={data.totalDurationInFrames}
      fps={data.fps}
      width={1920}   // YouTube long-form
      height={1080}  // 16:9
    />
  );
};