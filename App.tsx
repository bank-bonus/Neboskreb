import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Home, Hammer, Trophy } from 'lucide-react';
import { GameState, Block, GameStats } from './types';
import { LEVELS, BLOCK_HEIGHT, PERFECT_TOLERANCE, HOOK_Y_OFFSET } from './constants';
import { Button } from './components/Button';
import { StarRating } from './components/StarRating';

export default function App() {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [hookX, setHookX] = useState(50); // Percentage 0-100
  const [currentBlockWidth, setCurrentBlockWidth] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string, type: 'perfect' | 'good' | 'bad' } | null>(null);
  const [cameraY, setCameraY] = useState(0);

  // --- Refs for Game Loop ---
  const requestRef = useRef<number>();
  const startTimeRef = useRef<number>();
  const speedRef = useRef<number>(1);
  const isDroppingRef = useRef(false); // To debounce clicks

  const currentLevelConfig = LEVELS[currentLevelIdx];

  // --- Helpers ---
  
  // Calculate swing position based on time
  const updateHookPosition = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING) return;
    
    // Speed increases slightly with every block placed in the current level
    const difficultyMultiplier = 1 + (blocks.length * 0.05); 
    const speed = currentLevelConfig.baseSpeed * difficultyMultiplier * 0.002;
    
    // Sine wave movement centered at 50%
    // Range is adjusted so block doesn't hit walls instantly (90% width usable)
    const range = 45; 
    const x = 50 + Math.sin(time * speed) * range;
    
    setHookX(x);
  }, [gameState, currentLevelConfig.baseSpeed, blocks.length]);

  // Game Loop
  const animate = useCallback((time: number) => {
    if (!startTimeRef.current) startTimeRef.current = time;
    
    updateHookPosition(time);
    
    requestRef.current = requestAnimationFrame(animate);
  }, [updateHookPosition]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [animate]);

  // --- Game Logic ---

  const startGame = () => {
    setBlocks([]);
    setScore(0);
    setCombo(0);
    setCameraY(0);
    setCurrentBlockWidth(currentLevelConfig.initialWidth);
    setGameState(GameState.PLAYING);
    startTimeRef.current = undefined; // Reset timer for sine wave consistency
  };

  const nextLevel = () => {
    if (currentLevelIdx < LEVELS.length - 1) {
      setCurrentLevelIdx(prev => prev + 1);
      // Wait for state to update then start
      setTimeout(() => {
        // We need to trigger the start game logic with the NEW level config
        // But since we use state, we can just call a specialized reset
        setBlocks([]);
        setScore(0);
        setCombo(0);
        setCameraY(0);
        // Important: Use the next level's width
        setCurrentBlockWidth(LEVELS[currentLevelIdx + 1].initialWidth);
        setGameState(GameState.PLAYING);
      }, 50);
    } else {
      // Completed all levels? Restart from 0 or show credits (Looping for now)
      setCurrentLevelIdx(0);
      setTimeout(startGame, 50);
    }
  };

  const retryLevel = () => {
    startGame();
  };

  const handleDrop = () => {
    if (gameState !== GameState.PLAYING || isDroppingRef.current) return;

    const previousBlock = blocks.length > 0 ? blocks[blocks.length - 1] : { x: 50, width: currentLevelConfig.initialWidth + 20 }; // Base platform is wider
    const currentX = hookX;
    const diff = currentX - previousBlock.x;
    const absDiff = Math.abs(diff);

    // Calculate max allowed difference (half of current + half of prev width is touching, but we use percentages)
    // Actually simpler: The tower width is strictly decreasing or staying same.
    // We compare centers. If |center1 - center2| > (width1/2 + width2/2), it's a miss.
    // But in this "Stack" style game, we usually care if the NEW block overlaps the OLD block.
    
    const overlapLimit = (currentBlockWidth / 2) + (previousBlock.width / 2);
    
    if (absDiff > currentBlockWidth) {
      // Missed completely (simplified logic: if center diff > width, it's basically gone)
      endGame(false);
      return;
    }

    let newWidth = currentBlockWidth;
    let isPerfect = false;
    let placedX = currentX;

    // Perfect Hit Logic
    if (absDiff <= PERFECT_TOLERANCE) {
      isPerfect = true;
      placedX = previousBlock.x; // Snap to center
      setCombo(c => c + 1);
      setScore(s => s + 20 + (combo * 5));
      setFeedback({ text: 'ИДЕАЛЬНО!', type: 'perfect' });
    } else {
      // Imperfect Hit: Trim the block
      isPerfect = false;
      setCombo(0);
      
      // Reduce width by the offset
      const penalty = absDiff;
      newWidth = currentBlockWidth - penalty;
      
      // If block gets too small, game over
      if (newWidth < 5) {
        endGame(false);
        return;
      }

      // Visual placement is exactly where dropped
      placedX = currentX; 
      
      setScore(s => s + 10);
      setFeedback({ text: 'Хорошо', type: 'good' });
    }

    // Add new block
    const newBlock: Block = {
      id: Date.now(),
      width: isPerfect ? currentBlockWidth : newWidth, // If perfect, don't shrink, else shrink
      x: placedX,
      y: blocks.length,
      color: currentLevelConfig.colorPalette[blocks.length % currentLevelConfig.colorPalette.length],
      isPerfect
    };

    const newBlocks = [...blocks, newBlock];
    setBlocks(newBlocks);
    setCurrentBlockWidth(newBlock.width); // Update width for NEXT block

    // Clear feedback
    setTimeout(() => setFeedback(null), 800);

    // Check Level Complete
    if (newBlocks.length >= currentLevelConfig.targetBlocks) {
      endGame(true);
      return;
    }

    // Move Camera if tower is high
    if (newBlocks.length > 3) {
      setCameraY(prev => prev + BLOCK_HEIGHT);
    }
  };

  const endGame = (success: boolean) => {
    setGameState(success ? GameState.LEVEL_COMPLETE : GameState.GAME_OVER);
  };

  const calculateStars = (): number => {
    // 3 stars: > 60% perfect drops
    // 2 stars: Completed level
    // 1 star: (Not possible if completed, handled by game over logic? Actually 1 star for completion, 2 for good, 3 for great)
    
    if (gameState === GameState.GAME_OVER) return 0;

    const perfectCount = blocks.filter(b => b.isPerfect).length;
    const ratio = perfectCount / blocks.length;

    if (ratio >= 0.6) return 3;
    if (ratio >= 0.3) return 2;
    return 1;
  };

  // --- Rendering ---

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden select-none font-sans" onMouseDown={handleDrop} onTouchStart={handleDrop}>
      
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-950 pointer-events-none" />

      {/* Grid Background Effect */}
      <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
      }}></div>

      {/* Game Area */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-0 transition-transform duration-500 ease-out"
           style={{ transform: `translateY(${cameraY}px)` }}>
        
        {/* Base Platform */}
        <div className="w-full h-10 bg-slate-700 border-t-4 border-slate-600 absolute bottom-0 z-10"></div>
        <div 
          className="absolute bottom-10 h-10 bg-slate-600 rounded-sm"
          style={{ width: `${currentLevelConfig.initialWidth + 10}%`, left: '50%', transform: 'translateX(-50%)' }}
        />

        {/* Placed Blocks */}
        {blocks.map((block) => (
          <div
            key={block.id}
            className="absolute transition-all duration-300"
            style={{
              bottom: `${40 + (block.y * BLOCK_HEIGHT)}px`,
              left: `${block.x}%`,
              width: `${block.width}%`,
              height: `${BLOCK_HEIGHT}px`,
              transform: 'translateX(-50%)',
              backgroundColor: block.color,
              boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)'
            }}
          >
            {block.isPerfect && (
              <div className="absolute inset-0 bg-white opacity-30 animate-pulse" />
            )}
          </div>
        ))}
      </div>

      {/* Swinging Hook & Current Block */}
      {gameState === GameState.PLAYING && (
        <div 
          className="absolute top-0 left-0 w-full pointer-events-none z-20"
          style={{ height: '100%' }}
        >
          {/* The Crane/Hook Line */}
          <div 
            className="absolute bg-gray-400 w-1"
            style={{ 
              height: `${HOOK_Y_OFFSET}px`, 
              left: `${hookX}%`,
              top: 0,
              transition: 'left 0.1s linear' // Slight smoothing, but mostly driven by loop
            }}
          />
          
          {/* The Hook Icon */}
          <div 
            className="absolute text-gray-300"
            style={{ 
              left: `${hookX}%`, 
              top: `${HOOK_Y_OFFSET - 20}px`,
              transform: 'translateX(-50%)' 
            }}
          >
            <div className="w-6 h-6 border-4 border-gray-400 rounded-full border-t-0 border-l-0 rotate-45"></div>
          </div>

          {/* Current Block hanging */}
          <div
            className="absolute shadow-xl"
            style={{
              top: `${HOOK_Y_OFFSET}px`,
              left: `${hookX}%`,
              width: `${currentBlockWidth}%`,
              height: `${BLOCK_HEIGHT}px`,
              transform: 'translateX(-50%)',
              backgroundColor: currentLevelConfig.colorPalette[blocks.length % currentLevelConfig.colorPalette.length],
              boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.2)'
            }}
          >
            {/* Guide line for player help */}
            <div className="absolute top-full left-1/2 w-0.5 h-full bg-white opacity-20 -translate-x-1/2" style={{ height: '50vh' }}></div>
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-30 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-slate-400 text-sm font-display uppercase tracking-wider">Уровень {currentLevelIdx + 1}</span>
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-yellow-500" />
            <span className="text-2xl font-bold font-display">{score}</span>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
           <span className="text-slate-400 text-sm font-display uppercase tracking-wider">Блоки</span>
           <span className="text-2xl font-bold font-display">{blocks.length} / {currentLevelConfig.targetBlocks}</span>
        </div>
      </div>

      {/* Combo / Feedback Text */}
      {feedback && (
        <div className="absolute top-1/4 left-0 right-0 flex justify-center z-40 pointer-events-none">
          <div className={`text-4xl font-black font-display text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] animate-pop ${feedback.type === 'perfect' ? 'text-yellow-400' : 'text-blue-200'}`}>
            {feedback.text}
            {combo > 1 && <span className="block text-xl text-center text-white mt-1">x{combo}</span>}
          </div>
        </div>
      )}

      {/* --- MENUS --- */}

      {/* Main Menu */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="mb-8 animate-float">
            <Hammer size={64} className="text-blue-500 mx-auto mb-4" />
            <h1 className="text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
              НЕБОСКРЕБ
            </h1>
            <p className="text-slate-400">Построй самую высокую башню</p>
          </div>

          <div className="space-y-4 w-full max-w-xs">
            <Button onClick={startGame} size="lg">
              <Play className="mr-2" size={24} /> ИГРАТЬ
            </Button>
            <div className="text-xs text-slate-500 mt-8">
              Нажми на экран, чтобы сбросить блок. Старайся попадать ровно в центр!
            </div>
          </div>
        </div>
      )}

      {/* Level Complete Screen */}
      {gameState === GameState.LEVEL_COMPLETE && (
        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <h2 className="text-3xl font-display font-bold text-white mb-6">Уровень Пройден!</h2>
          
          <StarRating stars={calculateStars()} animated={true} />
          
          <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-xs mb-8 border border-slate-700">
            <div className="flex justify-between mb-2">
              <span className="text-slate-400">Счет:</span>
              <span className="font-bold text-xl">{score}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Точность:</span>
              <span className="font-bold text-green-400">{Math.round((blocks.filter(b => b.isPerfect).length / blocks.length) * 100)}%</span>
            </div>
          </div>

          <Button onClick={nextLevel} size="lg" className="mb-4">
             {currentLevelIdx < LEVELS.length - 1 ? 'СЛЕДУЮЩИЙ УРОВЕНЬ' : 'НАЧАТЬ ЗАНОВО'}
          </Button>
          
          <Button onClick={retryLevel} variant="secondary" size="sm">
            <RotateCcw className="mr-2" size={16} /> Переиграть
          </Button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <h2 className="text-4xl font-display font-bold text-red-500 mb-2">БАШНЯ УПАЛА!</h2>
          <p className="text-slate-400 mb-8">Ты промахнулся мимо платформы</p>
          
          <div className="mb-8">
            <span className="text-6xl font-display font-bold text-white">{score}</span>
            <span className="block text-slate-500 text-sm mt-2">ТВОЙ СЧЕТ</span>
          </div>

          <div className="space-y-4 w-full max-w-xs">
            <Button onClick={retryLevel} size="lg" variant="primary">
              <RotateCcw className="mr-2" size={24} /> ЕЩЁ РАЗ
            </Button>
            <Button onClick={() => setGameState(GameState.MENU)} variant="secondary">
              <Home className="mr-2" size={20} /> МЕНЮ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}