export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  GAME_OVER = 'GAME_OVER',
}

export interface Block {
  id: number;
  width: number;
  x: number; // Center position percentage (0-100)
  y: number; // Vertical index
  color: string;
  isPerfect?: boolean;
}

export interface LevelConfig {
  levelNumber: number;
  targetBlocks: number;
  initialWidth: number; // Percentage of screen width
  baseSpeed: number; // Multiplier for swing speed
  colorPalette: string[];
}

export interface GameStats {
  score: number;
  perfectDrops: number;
  maxCombo: number;
  currentLevel: number;
  stars: number;
}