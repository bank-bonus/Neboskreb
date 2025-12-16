import { LevelConfig } from './types';

export const BLOCK_HEIGHT = 40; // Pixels
export const GAME_WIDTH_PERCENT = 100; // Working with percentages for responsiveness
export const HOOK_Y_OFFSET = 100; // Distance from top where hook hangs
export const PERFECT_TOLERANCE = 3; // +/- 3% is considered perfect
export const MAX_LEVELS = 10;

// Vivid colors for blocks
export const COLORS = [
  ['#ef4444', '#f87171'], // Red
  ['#f97316', '#fb923c'], // Orange
  ['#eab308', '#facc15'], // Yellow
  ['#22c55e', '#4ade80'], // Green
  ['#06b6d4', '#22d3ee'], // Cyan
  ['#3b82f6', '#60a5fa'], // Blue
  ['#a855f7', '#c084fc'], // Purple
  ['#ec4899', '#f472b6'], // Pink
];

// Generate levels with increasing difficulty
export const LEVELS: LevelConfig[] = Array.from({ length: MAX_LEVELS }, (_, i) => {
  const levelNum = i + 1;
  return {
    levelNumber: levelNum,
    targetBlocks: 5 + (levelNum * 2), // Level 1: 7 blocks, Level 2: 9, etc.
    initialWidth: Math.max(20, 50 - (levelNum * 2)), // Gets narrower
    baseSpeed: 1 + (levelNum * 0.2), // Gets faster
    colorPalette: COLORS[i % COLORS.length],
  };
});

export const SOUNDS = {
  // Ideally these would be Audio objects, but for this constraint we'll just define keys
  DROP: 'drop',
  PERFECT: 'perfect',
  GAME_OVER: 'game_over',
  WIN: 'win',
};