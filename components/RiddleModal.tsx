

import React, { useState, useEffect, useRef } from 'react';
import { Riddle, ConnectionGroup, ADEDONHA_CATEGORIES } from '../types';
import { gameService } from '../services/gameService';

interface Props {
  riddle: Riddle;
  username: string; // Explicit username required for submissions
  dateString?: string;
  userAvatar?: string;
  onCorrect: (pointsEarned?: number) => void;
  onImageSubmit: (base64: string) => void;
  onFailure?: () => void;
  onClose: () => void;
}

// Helper to shuffle array
const shuffle = (array: any[]) => {
    return [...array].sort(() => Math.random() - 0.5);
};

interface MemoryCard {
    id: number;
    imageUrl: string;
    isFlipped: boolean;
    isMatched: boolean;
}

const GROUP_THEMES = [
    { bg: 'bg-yellow-300', border: 'border-yellow-400', text: 'text-yellow-900' }, 
    { bg: 'bg-green-300', border: 'border-green-400', text: 'text-green-900' },   
    { bg: 'bg-blue-300', border: 'border-blue-400', text: 'text-blue-900' },     
    { bg: 'bg-purple-300', border: 'border-purple-400', text: 'text-purple-900' }, 
];

const KEYBOARD_ROWS = [
    "QWERTYUIOP".split(""),
    "ASDFGHJKL".split(""),
    "ZXCVBNM".split("")
];

export const RiddleModal: React.FC<Props> = ({ riddle, username, dateString, userAvatar, onCorrect, onImageSubmit, onFailure, onClose }) => {
  const getInitialTime = () => {
      const val = Number(riddle.timeLimit);
      if (!isNaN(val) && val > 0) return val;
      if (riddle.type === 'SCAVENGER') return 120;
      if (riddle.type === 'MEMORY') return 120; 
      if (riddle.type === 'SCRAMBLED') return 60;
      if (riddle.type === 'ADEDONHA') return 120; // Default Adedonha
      // Pong has no time limit
      if (riddle.type === 'PLATFORMER') return 60;
      return (riddle.type === 'TIMED' || riddle.type === 'MULTIPLE_CHOICE') ? 60 : 0;
  };

  const shouldHaveTimer = () => {
      const val = getInitialTime();
      if (riddle.type === 'SCAVENGER') return false;
      if (riddle.type === 'PONG') return false; // Pong doesn't show timer
      return (riddle.type === 'TIMED' || riddle.type === 'MULTIPLE_CHOICE' || riddle.type === 'MEMORY' || riddle.type === 'SCRAMBLED' || riddle.type === 'PLATFORMER' || riddle.type === 'ADEDONHA') && val > 0;
  };

  // Determine if this riddle type requires a manual "Start" button click
  const needsManualStart = riddle.type === 'TIMED' || riddle.type === 'MULTIPLE_CHOICE' || riddle.type === 'SCRAMBLED' || riddle.type === 'ADEDONHA';

  // UI State
  const [hasStarted, setHasStarted] = useState(!needsManualStart);
  const [isValidating, setIsValidating] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  
  // Connections State
  const [allItems, setAllItems] = useState<{word: string, group?: string}[]>([]); // Items are now public flat list
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [solvedGroups, setSolvedGroups] = useState<ConnectionGroup[]>([]);
  const [lives, setLives] = useState(riddle.connectionsLives || 4);
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(() => getInitialTime());
  const [isTimerActive, setIsTimerActive] = useState(false); // Init false, handled in useEffect

  // TERMO (Wordle) State
  const [guesses, setGuesses] = useState<string[]>([]);
  const [guessResults, setGuessResults] = useState<string[][]>([]); // Store colors returned from server
  const [currentGuess, setCurrentGuess] = useState('');
  const [termoStatus, setTermoStatus] = useState<'PLAYING' | 'WON' | 'LOST'>('PLAYING');

  // MULTIPLE CHOICE STATE
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState<'NONE' | 'CORRECT' | 'WRONG'>('NONE');

  // ADEDONHA STATE
  const [adedonhaAnswers, setAdedonhaAnswers] = useState<Record<string, string>>({});
  const [adedonhaSubmitted, setAdedonhaSubmitted] = useState(false);
  
  // REF TO TRACK ANSWERS FOR AUTO-SUBMIT (Avoids stale closure in timer)
  const answersRef = useRef(adedonhaAnswers);
  useEffect(() => {
      answersRef.current = adedonhaAnswers;
  }, [adedonhaAnswers]);

  // FLAPPY BIRD STATE
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [flappyLives, setFlappyLives] = useState(riddle.flappyLives || 2);
  const [flappyScore, setFlappyScore] = useState(0);
  const [flappyState, setFlappyState] = useState<'START' | 'PLAYING' | 'GAME_OVER' | 'WIN'>('START');
  const gameLoopRef = useRef<number>(0);
  const birdRef = useRef({ y: 150, velocity: 0 });
  const pipesRef = useRef<{x: number, y: number, passed: boolean}[]>([]);
  const scoreRef = useRef(0);

  // PONG STATE
  const pongCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pongState, setPongState] = useState<'START' | 'PLAYING' | 'GAME_OVER' | 'WIN'>('START');
  const pongLoopRef = useRef<number>(0);
  const [pongScore, setPongScore] = useState(0);
  const [pongLives, setPongLives] = useState(riddle.pongLives || 3);
  const pongLivesRef = useRef(riddle.pongLives || 3);
  const pongResetTimeRef = useRef<number>(0); 
  const paddleRef = useRef({ y: 150 }); 
  const ballRef = useRef({ x: 200, y: 150, dx: 4, dy: 4 });

  // PLATFORMER STATE
  const platformerCanvasRef = useRef<HTMLCanvasElement>(null);
  const [platformerState, setPlatformerState] = useState<'START' | 'PLAYING' | 'WIN' | 'GAME_OVER'>('START');
  const [platformerLives, setPlatformerLives] = useState(riddle.platformerLives || 3);
  const platformerLivesRef = useRef(riddle.platformerLives || 3);
  const platformerLoopRef = useRef<number>(0);
  const playerRef = useRef({ x: 50, y: 0, vx: 0, vy: 0, grounded: false, dead: false });
  const keysRef = useRef<{ [key: string]: boolean }>({});
  
  const LEVEL_MAP = [
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "..................................???...............................................................",
    "..........................B?B?B...........................................................F.........",
    ".................................................BBB...............#...#..................#.........",
    ".......................................E..................K.......#.....#.................#.........",
    "............?........................#####......#####............#.......#................#.........",
    ".......................E........................................#.........#...............#.........",
    "######...#####...###..........####...........###.........#######...........#######........#.........",
  ];

  // SCAVENGER STATE
  const [scavengerState, setScavengerState] = useState<'INTRO' | 'HUNTING'>('INTRO');

  // MEMORY GAME STATE
  const [memoryCards, setMemoryCards] = useState<MemoryCard[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [isProcessingMatch, setIsProcessingMatch] = useState(false);

  // SCRAMBLED STATE
  // We use publicScrambledString from server now, fall back to empty if missing
  const [scrambledDisplay, setScrambledDisplay] = useState('');

  // General Game State
  const [isGameOver, setIsGameOver] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); 
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [feedback, setFeedback] = useState('');

  // --- INITIALIZATION ---
  useEffect(() => {
      setIsGameOver(false);
      setIsSuccess(false);
      setIsValidating(false);
      setTextAnswer('');
      setFeedback('');
      setShake(false);
      setImagePreview(null);
      setGuesses([]);
      setGuessResults([]);
      setCurrentGuess('');
      setTermoStatus('PLAYING');
      setScavengerState('INTRO');
      setQuizIndex(0);
      setQuizScore(0);
      setQuizFeedback('NONE');
      setAdedonhaSubmitted(false);
      setAdedonhaAnswers({});

      // Manual Start Check
      const requiresStart = riddle.type === 'TIMED' || riddle.type === 'MULTIPLE_CHOICE' || riddle.type === 'SCRAMBLED' || riddle.type === 'ADEDONHA';
      setHasStarted(!requiresStart);

      // CONNECTIONS INIT
      // Use public connectionItems if available, otherwise empty
      if (riddle.type === 'CONNECTIONS' && riddle.connectionItems) {
          setAllItems(shuffle(riddle.connectionItems)); // Items are just { word: string }
          setLives(riddle.connectionsLives || 4);
          setSolvedGroups([]);
          setSelectedItems([]);
      } else {
          setAllItems([]);
      }

      // MEMORY INIT
      if (riddle.type === 'MEMORY' && riddle.memoryImages) {
          const images = riddle.memoryImages;
          const pairs = [...images, ...images];
          const shuffled = shuffle(pairs.map((img, idx) => ({
              id: idx,
              imageUrl: img,
              isFlipped: false,
              isMatched: false
          })));
          setMemoryCards(shuffled);
          setFlippedIndices([]);
          setIsProcessingMatch(false);
      }
      
      // FLAPPY INIT
      if (riddle.type === 'FLAPPY') {
          setFlappyLives(riddle.flappyLives || 2);
          setFlappyState('START');
          setFlappyScore(0);
      }

      // PONG INIT
      if (riddle.type === 'PONG') {
          setPongState('START');
          setPongScore(0);
          setPongLives(riddle.pongLives || 3);
          pongLivesRef.current = riddle.pongLives || 3;
      }

      // PLATFORMER INIT
      if (riddle.type === 'PLATFORMER') {
          setPlatformerState('START');
          setPlatformerLives(riddle.platformerLives || 3);
          platformerLivesRef.current = riddle.platformerLives || 3;
          playerRef.current = { x: 50, y: 100, vx: 0, vy: 0, grounded: false, dead: false };
      }

      // SCRAMBLED INIT
      if (riddle.type === 'SCRAMBLED' && riddle.publicScrambledString) {
          setScrambledDisplay(riddle.publicScrambledString);
      } else {
          setScrambledDisplay('???');
      }

      const time = getInitialTime();
      const active = shouldHaveTimer();
      setTimeLeft(time);
      
      // Only activate timer immediately if it DOES NOT require manual start
      if (requiresStart) {
          setIsTimerActive(false);
      } else {
          setIsTimerActive(active);
      }
      
  }, [riddle]);

  // --- TIMER (REFACTORED) ---
  // 1. Tick the timer down
  useEffect(() => {
      if (!isTimerActive) return;
      const timerId = setInterval(() => {
          setTimeLeft((prevTime) => Math.max(0, prevTime - 1));
      }, 1000);
      return () => clearInterval(timerId);
  }, [isTimerActive]);

  // 2. Watch for timeout (Accesses fresh state)
  useEffect(() => {
      if (timeLeft === 0 && isTimerActive) {
          // Time is up!
          if (riddle.type === 'MULTIPLE_CHOICE') {
              finishQuiz();
          } else if (riddle.type === 'ADEDONHA') {
              handleAdedonhaSubmit(true); // Now accesses fresh adedonhaAnswers via Ref or State if logic allows
          } else if (riddle.type === 'SCRAMBLED') {
               handleGameOver('Tempo Esgotado! Você perdeu.');
          } else if (riddle.type === 'TIMED' || riddle.type === 'PLATFORMER' || riddle.type === 'MEMORY') {
               handleGameOver('Tempo Esgotado! Você perdeu.');
          }
      }
  }, [timeLeft, isTimerActive, riddle.type]); 

  // --- GAME LOGIC ---

  const handleManualStart = () => {
      setHasStarted(true);
      if (shouldHaveTimer()) {
          setIsTimerActive(true);
      }
  };

  const handleAttemptClose = () => {
      // If the game is already over (success or fail), just close naturally
      if (isSuccess || isGameOver || adedonhaSubmitted) {
          onClose();
          return;
      }

      // Confirm giving up
      const confirmed = window.confirm("Tem certeza que deseja sair? Se você fechar agora, será considerado desistência e você NÃO poderá tentar o desafio de hoje novamente.");
      
      if (confirmed) {
          if (onFailure) onFailure(); // Trigger loss in parent (locks the day)
          onClose();
      }
  };

  const handleSuccess = (customPoints?: number) => {
      setIsTimerActive(false);
      setIsSuccess(true);
      setTimeout(() => onCorrect(customPoints), 2500);
  };

  const handleGameOver = (msg: string) => {
      setIsTimerActive(false);
      setIsGameOver(true);
      triggerError(msg);
      if (onFailure) setTimeout(onFailure, 2500);
  };

  // --- SERVER VERIFICATION HANDLERS ---

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGameOver || isValidating) return;

    setIsValidating(true);
    const result = await gameService.verifyAnswer(riddle, textAnswer);
    setIsValidating(false);

    if (result.correct) {
      handleSuccess();
    } else {
      triggerError('Incorrect. Try again!');
    }
  };

  // ADEDONHA LOGIC
  const handleAdedonhaChange = (category: string, value: string) => {
      setAdedonhaAnswers(prev => ({...prev, [category]: value}));
  };
  
  const handleAdedonhaSubmit = async (auto = false) => {
      if (adedonhaSubmitted) return;
      setIsTimerActive(false);
      setIsValidating(true);
      
      // CRITICAL FIX: Use ref to get the absolute latest keystrokes even if triggered by timer closure
      const finalAnswers = answersRef.current; 

      try {
          // Use explicitly passed username prop instead of fragile extraction
          await gameService.submitAdedonha(username, riddle.day, finalAnswers);
          setAdedonhaSubmitted(true);
      } catch (e) {
          console.error("Adedonha submit failed", e);
          if (!auto) {
              alert("Erro ao enviar respostas. Verifique sua conexão e tente novamente.");
              setIsTimerActive(true); 
          } else {
              // If auto-submit failed (e.g. network), allow the UI to show submitted state 
              // but maybe alert the user.
              // For Adedonha auto-submit, we generally want to fail gracefully.
              console.warn("Auto-submit encountered an error");
              // Force submitted state so user isn't stuck
              setAdedonhaSubmitted(true);
          }
      } finally {
          setIsValidating(false);
      }
  };

  // MULTIPLE CHOICE LOGIC (SEQUENTIAL)
  const handleMultipleChoice = async (optionIndex: number) => {
      if (isGameOver || isValidating || quizFeedback !== 'NONE') return;
      setIsValidating(true);
      const result = await gameService.verifyAnswer(riddle, optionIndex, quizIndex);
      setIsValidating(false);
      
      let newScore = quizScore;
      if (result.correct) {
          newScore += 1;
          setQuizScore(newScore);
          setQuizFeedback('CORRECT');
      } else {
          setQuizFeedback('WRONG');
      }

      setTimeout(() => {
          setQuizFeedback('NONE');
          const nextIndex = quizIndex + 1;
          const totalQuestions = riddle.subQuestions?.length || 0;

          if (nextIndex >= totalQuestions) {
              finishQuiz(newScore);
          } else {
              setQuizIndex(nextIndex);
          }
      }, 1500);
  };

  const finishQuiz = (finalScore = quizScore) => {
      setIsTimerActive(false);
      if (finalScore > 0) {
          setIsSuccess(true);
          setTimeout(() => onCorrect(finalScore), 2500);
      } else {
          handleGameOver("0 Acertos! Você não anda nenhuma casa.");
      }
  };

  // CONNECTIONS SUBMIT
  const handleConnectionClick = (word: string) => {
      if (isGameOver || isValidating) return;
      if (selectedItems.includes(word)) {
          setSelectedItems(prev => prev.filter(i => i !== word));
      } else {
          if (selectedItems.length < 4) setSelectedItems(prev => [...prev, word]);
      }
  };

  const submitConnections = async () => {
      if (selectedItems.length !== 4 || isGameOver || isValidating) return;
      
      setIsValidating(true);
      const result = await gameService.verifyAnswer(riddle, selectedItems);
      setIsValidating(false);

      if (result.correct && result.details) {
          const newGroup: ConnectionGroup = { title: result.details.title, items: result.details.items };
          setSolvedGroups(prev => [...prev, newGroup]);
          setAllItems(prev => prev.filter(i => !result.details.items.includes(i.word)));
          setSelectedItems([]);
          
          if (solvedGroups.length + 1 === 4) handleSuccess();
      } else {
          const newLives = lives - 1;
          setLives(newLives);
          setSelectedItems([]);
          if (newLives === 0) handleGameOver('Game Over! No more lives.');
          else triggerError('Incorrect group!');
      }
  };

  // TERMO SUBMIT
  const handleTermoKey = (key: string) => {
      if (termoStatus !== 'PLAYING' || isValidating) return;
      if (key === 'BACKSPACE') {
          setCurrentGuess(prev => prev.slice(0, -1));
          return;
      }
      if (key === 'ENTER') {
          if (currentGuess.length !== 5) {
              triggerError('Must be 5 letters');
              return;
          }
          submitTermoGuess();
          return;
      }
      if (currentGuess.length < 5) setCurrentGuess(prev => prev + key);
  };

  const submitTermoGuess = async () => {
      if (isValidating) return;
      setIsValidating(true);
      const colors = await gameService.verifyTermoGuess(riddle, currentGuess);
      setIsValidating(false);

      const newGuesses = [...guesses, currentGuess];
      const newResults = [...guessResults, colors];
      
      setGuesses(newGuesses);
      setGuessResults(newResults);
      setCurrentGuess('');

      const isWin = colors.every(c => c === 'CORRECT');

      if (isWin) {
          setTermoStatus('WON');
          handleSuccess();
      } else if (newGuesses.length >= 5) {
          setTermoStatus('LOST');
          handleGameOver(`Game Over!`);
      }
  };

  const getTermoLetterStyle = (rowIndex: number, colIndex: number) => {
      if (rowIndex >= guessResults.length) return 'bg-white border-gray-300 text-black';
      
      const status = guessResults[rowIndex][colIndex];
      if (status === 'CORRECT') return 'bg-green-500 border-green-600 text-white';
      if (status === 'PRESENT') return 'bg-yellow-500 border-yellow-600 text-white';
      return 'bg-gray-500 border-gray-600 text-white';
  };

  const getKeypadStyle = (key: string) => {
      let finalStatus = 'bg-gray-200 text-gray-700';
      guesses.forEach((guess, gIdx) => {
          guess.split('').forEach((char, cIdx) => {
              if (char === key) {
                   const status = guessResults[gIdx][cIdx];
                   if (status === 'CORRECT') finalStatus = 'bg-green-500 text-white';
                   else if (status === 'PRESENT' && finalStatus !== 'bg-green-500 text-white') finalStatus = 'bg-yellow-500 text-white';
                   else if (status === 'ABSENT' && finalStatus !== 'bg-green-500 text-white' && finalStatus !== 'bg-yellow-500 text-white') finalStatus = 'bg-slate-400 text-white';
              }
          });
      });
      return finalStatus;
  };

  // --- SCAVENGER / IMAGE ---
  const handleScavengerStart = () => {
      setScavengerState('HUNTING');
      setIsTimerActive(true);
  };
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setImagePreview(reader.result as string);
          reader.readAsDataURL(file);
      }
  };
  const handleImageUploadSubmit = () => {
      if (imagePreview) {
          setFeedback('Uploading to Jana...');
          setTimeout(() => {
              onImageSubmit(imagePreview);
          }, 1000);
      }
  };

  // --- MEMORY ---
  const handleMemoryCardClick = (index: number) => {
      if (isGameOver || isProcessingMatch) return;
      if (memoryCards[index].isFlipped || memoryCards[index].isMatched) return;
      const newCards = [...memoryCards];
      newCards[index].isFlipped = true;
      setMemoryCards(newCards);
      const newFlipped = [...flippedIndices, index];
      setFlippedIndices(newFlipped);
      if (newFlipped.length === 2) {
          setIsProcessingMatch(true);
          const idx1 = newFlipped[0];
          const idx2 = newFlipped[1];
          if (newCards[idx1].imageUrl === newCards[idx2].imageUrl) {
              newCards[idx1].isMatched = true;
              newCards[idx2].isMatched = true;
              setMemoryCards(newCards);
              setFlippedIndices([]);
              setIsProcessingMatch(false);
              if (newCards.every(c => c.isMatched)) handleSuccess();
          } else {
              setTimeout(() => {
                  const resetCards = [...newCards];
                  resetCards[idx1].isFlipped = false;
                  resetCards[idx2].isFlipped = false;
                  setMemoryCards(resetCards);
                  setFlippedIndices([]);
                  setIsProcessingMatch(false);
              }, 1000);
          }
      }
  };

  // --- ENGINE GAMES (PONG / PLATFORMER / FLAPPY) ---
  // ... FLAPPY ...
  useEffect(() => {
    if (riddle.type !== 'FLAPPY' || flappyState !== 'PLAYING' || !canvasRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const avatarImg = new Image();
    if (riddle.customImage) avatarImg.src = riddle.customImage;
    else if (userAvatar) avatarImg.src = userAvatar;

    const GRAVITY = 0.5;
    const SPEED = 2.5;
    const PIPE_WIDTH = 50;
    const PIPE_GAP = 140;
    const PIPE_SPACING = 250;

    if (pipesRef.current.length === 0) pipesRef.current.push({ x: 400, y: Math.random() * (canvas.height - PIPE_GAP - 100) + 50, passed: false });

    const loop = () => {
        birdRef.current.velocity += GRAVITY;
        birdRef.current.y += birdRef.current.velocity;
        if (pipesRef.current.length > 0 && pipesRef.current[pipesRef.current.length - 1].x < canvas.width - PIPE_SPACING) {
            pipesRef.current.push({ x: canvas.width, y: Math.random() * (canvas.height - PIPE_GAP - 100) + 50, passed: false });
        }
        pipesRef.current.forEach(p => p.x -= SPEED);
        pipesRef.current = pipesRef.current.filter(p => p.x > -PIPE_WIDTH);
        const birdSize = 30;
        const birdRect = { x: 50, y: birdRef.current.y, w: birdSize, h: birdSize };
        let crash = false;
        let justWon = false;
        if (birdRef.current.y + birdRect.h >= canvas.height || birdRef.current.y <= 0) crash = true;
        pipesRef.current.forEach(p => {
            if (birdRect.x < p.x + PIPE_WIDTH && birdRect.x + birdRect.w > p.x && birdRect.y < p.y) crash = true;
            if (birdRect.x < p.x + PIPE_WIDTH && birdRect.x + birdRect.w > p.x && birdRect.y + birdRect.h > p.y + PIPE_GAP) crash = true;
            if (!p.passed && birdRect.x > p.x + PIPE_WIDTH) {
                p.passed = true;
                scoreRef.current += 1;
                setFlappyScore(scoreRef.current);
                if (scoreRef.current >= (riddle.flappyThreshold || 10)) {
                    setFlappyState('WIN');
                    handleSuccess();
                    justWon = true;
                }
            }
        });
        if (justWon) return;
        if (crash) { handleFlappyCrash(); return; }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#70c5ce';
        ctx.fillRect(0,0, canvas.width, canvas.height);
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(birdRect.x + 15, birdRect.y + 15, 15, 0, Math.PI * 2);
        ctx.closePath();
        if (avatarImg.complete && avatarImg.naturalHeight !== 0) {
            ctx.save();
            ctx.clip();
            ctx.drawImage(avatarImg, birdRect.x, birdRect.y, 30, 30);
            ctx.restore();
        } else {
            ctx.fillStyle = '#FFD700';
            ctx.fill();
        }
        ctx.restore(); 

        ctx.fillStyle = '#73bf2e';
        pipesRef.current.forEach(p => {
            ctx.fillRect(p.x, 0, PIPE_WIDTH, p.y);
            ctx.fillRect(p.x, p.y + PIPE_GAP, PIPE_WIDTH, canvas.height - (p.y + PIPE_GAP));
        });
        gameLoopRef.current = requestAnimationFrame(loop);
    };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [flappyState]);

  const handleFlappyJump = (e?: React.MouseEvent | React.TouchEvent) => {
      if (e) e.preventDefault();
      if (flappyState === 'START') {
          setFlappyState('PLAYING');
          birdRef.current = { y: 150, velocity: -6 };
          pipesRef.current = [];
          scoreRef.current = 0;
          setFlappyScore(0);
      } else if (flappyState === 'PLAYING') {
          birdRef.current.velocity = -7;
      }
  };

  const handleFlappyCrash = () => {
      const newLives = flappyLives - 1;
      setFlappyLives(newLives);
      if (newLives <= 0) {
          setFlappyState('GAME_OVER');
          handleGameOver('Game Over! No more lives.');
      } else {
          setFlappyState('START');
          triggerError('Crash! Try again.');
          birdRef.current = { y: 150, velocity: 0 };
          pipesRef.current = [];
          scoreRef.current = 0;
          setFlappyScore(0);
      }
  };

  // ... PONG LOGIC ...
  useEffect(() => {
    if (riddle.type !== 'PONG' || pongState !== 'PLAYING' || !pongCanvasRef.current) {
        cancelAnimationFrame(pongLoopRef.current);
        return;
    }
    const canvas = pongCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const PADDLE_HEIGHT = 60;
    const PADDLE_WIDTH = 10;
    const BALL_RADIUS = 6;
    let baseSpeed = riddle.pongSpeed === 'FAST' ? 6 : riddle.pongSpeed === 'SLOW' ? 3 : 4;

    if (pongState === 'PLAYING' && ballRef.current.x === 200 && pongResetTimeRef.current === 0) {
        ballRef.current.dx = baseSpeed;
        ballRef.current.dy = baseSpeed;
    }
    const loop = () => {
        if (Date.now() < pongResetTimeRef.current) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.fillRect(10, paddleRef.current.y, PADDLE_WIDTH, PADDLE_HEIGHT);
            ctx.font = "bold 20px monospace";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.fillText("READY?", canvas.width / 2, canvas.height / 2 - 20);
            pongLoopRef.current = requestAnimationFrame(loop);
            return;
        }
        const ball = ballRef.current;
        const paddle = paddleRef.current;
        ball.x += ball.dx;
        ball.y += ball.dy;
        if (ball.y + BALL_RADIUS > canvas.height || ball.y - BALL_RADIUS < 0) ball.dy = -ball.dy;
        if (ball.x + BALL_RADIUS > canvas.width) ball.dx = -ball.dx;

        // COLLISION LOGIC
        if (ball.x - BALL_RADIUS <= 10 + PADDLE_WIDTH && ball.x + BALL_RADIUS >= 10) {
            if (ball.y + BALL_RADIUS >= paddle.y && ball.y - BALL_RADIUS <= paddle.y + PADDLE_HEIGHT) {
                if (ball.dx < 0) {
                    ball.dx = -ball.dx; 
                    ball.x = 10 + PADDLE_WIDTH + BALL_RADIUS + 2; 
                    ball.dy += (Math.random() - 0.5) * 2;
                    ball.dx *= 1.05;
                    const newScore = scoreRef.current + 1;
                    scoreRef.current = newScore;
                    setPongScore(newScore);
                    if (newScore >= (riddle.pongScoreThreshold || 10)) { setPongState('WIN'); handleSuccess(); return; }
                }
            }
        } 
        
        if (ball.x < 0) {
            const newLives = pongLivesRef.current - 1;
            pongLivesRef.current = newLives;
            setPongLives(newLives);
            if (newLives <= 0) { setPongState('GAME_OVER'); handleGameOver('Game Over!'); return; }
            else { 
                triggerError("Life Lost!"); 
                pongResetTimeRef.current = Date.now() + 1500; 
                ball.x = 200; 
                ball.y = 150; 
                ball.dx = Math.abs(baseSpeed); 
                ball.dy = baseSpeed; 
                scoreRef.current = 0;
                setPongScore(0);
            }
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.fillRect(10, paddle.y, PADDLE_WIDTH, PADDLE_HEIGHT);
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        pongLoopRef.current = requestAnimationFrame(loop);
    };
    pongLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(pongLoopRef.current);
  }, [pongState]);

  const handlePongStart = () => { setPongState('PLAYING'); scoreRef.current = 0; setPongScore(0); setPongLives(riddle.pongLives || 3); pongLivesRef.current = riddle.pongLives || 3; ballRef.current = { x: 200, y: 150, dx: 4, dy: 4 }; pongResetTimeRef.current = 0; setIsTimerActive(false); };
  const handlePongMove = (e: React.MouseEvent | React.TouchEvent) => { if (pongState !== 'PLAYING' || !pongCanvasRef.current) return; const canvas = pongCanvasRef.current; const rect = canvas.getBoundingClientRect(); let clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY; paddleRef.current.y = Math.max(0, Math.min(canvas.height - 60, clientY - rect.top - 30)); };

  // ... PLATFORMER LOGIC ...
  useEffect(() => {
    if (riddle.type !== 'PLATFORMER' || platformerState !== 'PLAYING' || !platformerCanvasRef.current) { cancelAnimationFrame(platformerLoopRef.current); return; }
    const canvas = platformerCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const TILE_SIZE = 32; const GRAVITY = 0.5; const JUMP_FORCE = -10; const SPEED = 3; const FRICTION = 0.8;
    const tiles: any[] = []; const enemies: any[] = [];
    LEVEL_MAP.forEach((row, rowIndex) => { row.split('').forEach((char, colIndex) => { const x = colIndex * TILE_SIZE; const y = rowIndex * TILE_SIZE; if ('#B?F'.includes(char)) tiles.push({ x, y, type: char }); else if ('EK'.includes(char)) enemies.push({ x, y, type: char, vx: char === 'E' ? -1 : -1.5, dead: false }); }); });
    const avatarImg = new Image(); if (userAvatar) avatarImg.src = userAvatar;
    let cameraX = 0;
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    
    const loop = () => {
        const player = playerRef.current;
        if (keysRef.current['ArrowRight']) player.vx += 0.5;
        if (keysRef.current['ArrowLeft']) player.vx -= 0.5;
        player.vx *= FRICTION; player.vx = Math.max(Math.min(player.vx, SPEED), -SPEED);
        player.vy += GRAVITY;
        if ((keysRef.current['Space'] || keysRef.current['ArrowUp']) && player.grounded) { player.vy = JUMP_FORCE; player.grounded = false; }
        player.x += player.vx;
        let pRect = { x: player.x, y: player.y, w: 24, h: 24 };
        tiles.forEach(t => { if (t.type !== 'F' && pRect.x < t.x + TILE_SIZE && pRect.x + pRect.w > t.x && pRect.y < t.y + TILE_SIZE && pRect.y + pRect.h > t.y) { if (player.vx > 0) player.x = t.x - pRect.w; else if (player.vx < 0) player.x = t.x + TILE_SIZE; player.vx = 0; } });
        player.grounded = false; player.y += player.vy; pRect.x = player.x; pRect.y = player.y;
        tiles.forEach(t => { if (t.type !== 'F' && pRect.x < t.x + TILE_SIZE && pRect.x + pRect.w > t.x && pRect.y < t.y + TILE_SIZE && pRect.y + pRect.h > t.y) { if (player.vy > 0) { player.y = t.y - pRect.h; player.grounded = true; player.vy = 0; } else if (player.vy < 0) { player.y = t.y + TILE_SIZE; player.vy = 0; } } });
        
        const flag = tiles.find(t => t.type === 'F');
        if (flag && pRect.x < flag.x + TILE_SIZE && pRect.x + pRect.w > flag.x && pRect.y < flag.y + TILE_SIZE && pRect.y + pRect.h > flag.y) { setPlatformerState('WIN'); handleSuccess(); return; }
        if (player.y > canvas.height) { handlePlatformerDeath(); return; }

        cameraX = Math.max(0, player.x - 150);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#5c94fc'; ctx.fillRect(0,0, canvas.width, canvas.height);
        ctx.save(); ctx.translate(-cameraX, 0);
        tiles.forEach(t => { ctx.fillStyle = t.type === '#' ? '#c84c0c' : t.type === 'B' ? '#b13e53' : t.type === '?' ? '#f8d878' : '#fff'; ctx.fillRect(t.x, t.y, TILE_SIZE, TILE_SIZE); if(t.type === 'F') { ctx.fillStyle='#00aa00'; ctx.fillRect(t.x+14,t.y,4,32); } });
        if (avatarImg.complete) ctx.drawImage(avatarImg, player.x, player.y, 24, 24); else { ctx.fillStyle = 'red'; ctx.fillRect(player.x, player.y, 24, 24); }
        ctx.restore();
        platformerLoopRef.current = requestAnimationFrame(loop);
    };
    platformerLoopRef.current = requestAnimationFrame(loop);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); cancelAnimationFrame(platformerLoopRef.current); };
  }, [platformerState]);

  const handlePlatformerStart = () => { setPlatformerState('PLAYING'); setIsTimerActive(true); playerRef.current = { x: 50, y: 100, vx: 0, vy: 0, grounded: false, dead: false }; keysRef.current = {}; };
  const handlePlatformerDeath = () => { const newLives = platformerLivesRef.current - 1; platformerLivesRef.current = newLives; setPlatformerLives(newLives); if (newLives <= 0) { setPlatformerState('GAME_OVER'); handleGameOver('Game Over!'); } else { playerRef.current = { x: 50, y: 0, vx: 0, vy: 0, grounded: false, dead: false }; triggerError('Oops!'); } };
  const handleTouchControl = (key: string, pressed: boolean) => { if (platformerState !== 'PLAYING') return; keysRef.current[key] = pressed; };

  const triggerError = (msg: string) => { setShake(true); setFeedback(msg); setTimeout(() => { setShake(false); if (!msg.includes('Game Over') && !msg.includes('Failed')) setFeedback(''); }, 1500); };
  const totalTime = getInitialTime() || 1;
  const percentage = Math.max(0, (timeLeft / totalTime) * 100);
  const showTimer = (riddle.type === 'TIMED' || riddle.type === 'MULTIPLE_CHOICE' || riddle.type === 'MEMORY' || riddle.type === 'SCRAMBLED' || riddle.type === 'PLATFORMER' || riddle.type === 'ADEDONHA') || (riddle.type === 'SCAVENGER' && scavengerState === 'HUNTING');

  const renderPointsBadge = () => {
      if (riddle.type === 'MULTIPLE_CHOICE' || riddle.type === 'ADEDONHA') {
          return <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">🏆 Pontos Dinâmicos</span>
      }
      return <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">🏆 Vale {riddle.points} Casas</span>
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4">
      {isSuccess && (
          <div className="absolute inset-0 z-50 bg-green-600 flex flex-col items-center justify-center text-white animate-fade-in">
              <div className="text-8xl mb-4 animate-bounce">🏆</div>
              <h2 className="text-4xl font-black mb-2">{riddle.type === 'MULTIPLE_CHOICE' ? 'QUIZ COMPLETE!' : 'YOU WON!'}</h2>
              <p className="text-xl font-medium">
                  {riddle.type === 'MULTIPLE_CHOICE' 
                    ? `Você acertou ${quizScore} questões! Avançando ${quizScore} casas.` 
                    : `Advancing ${riddle.points} spaces...`}
              </p>
          </div>
      )}
      {adedonhaSubmitted && !isSuccess && (
           <div className="absolute inset-0 z-50 bg-blue-600 flex flex-col items-center justify-center text-white animate-fade-in text-center p-4">
               <div className="text-8xl mb-4">📤</div>
               <h2 className="text-3xl font-black mb-4">Respostas Enviadas!</h2>
               <p className="text-lg max-w-md mx-auto mb-6">
                   Suas respostas foram enviadas para correção. O Admin irá validar cada item. 
                   <br/><br/>
                   Volte mais tarde para ver se você pontuou!
               </p>
               <button onClick={onClose} className="bg-white text-blue-600 px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-50">
                   Entendido
               </button>
           </div>
      )}
      {isGameOver && !isSuccess && <div className="absolute inset-0 z-50 bg-red-600 flex flex-col items-center justify-center text-white animate-fade-in"><div className="text-8xl mb-4">☠️</div><h2 className="text-4xl font-black mb-2">FAILED</h2><p className="text-xl font-medium mb-6">{feedback}</p><button onClick={onClose} className="bg-white text-red-600 px-8 py-3 rounded-full font-bold shadow-lg hover:bg-gray-100">Close</button></div>}
      
      <div className={`bg-white rounded-2xl w-full shadow-2xl relative transform transition-transform flex flex-col max-h-[95vh] ${shake ? 'translate-x-2' : ''} ${riddle.type === 'MEMORY' || riddle.type === 'ADEDONHA' ? 'max-w-5xl' : 'max-w-xl'}`}>
        <div className="sticky top-0 bg-white/95 backdrop-blur z-20 border-b border-gray-100 rounded-t-2xl p-4 sm:p-6">
            <button onClick={handleAttemptClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl z-30">&times;</button>
            <div className="text-center">
                <div className="flex flex-wrap justify-center items-center gap-2 mb-2">
                    <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Day {riddle.day}</span>
                    {dateString && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">{dateString}</span>}
                    {renderPointsBadge()}
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-bold text-gray-800 leading-tight">{riddle.type === 'MULTIPLE_CHOICE' ? 'Quiz Mode' : riddle.type === 'ADEDONHA' ? 'Adedonha (Stop)' : riddle.type}</h3>
            </div>
            {showTimer && totalTime > 0 && !isSuccess && !isGameOver && !adedonhaSubmitted && (
                <div className="mt-4 bg-gray-100 p-3 rounded-xl border-2 border-gray-200 shadow-sm"><div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden shadow-inner"><div className={`h-full rounded-full transition-all duration-1000 ease-linear ${timeLeft <= 10 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${percentage}%` }}></div></div><div className="text-center text-xs font-bold text-gray-500 mt-1">{timeLeft}s left</div></div>
            )}
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto">
            {!hasStarted && needsManualStart ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="text-6xl mb-4">⏱️</div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Ready?</h3>
                    <p className="text-gray-600 mb-8 max-w-xs mx-auto">
                        {riddle.type === 'MULTIPLE_CHOICE' 
                            ? "Este é um desafio de 3 etapas! Você responderá 3 perguntas em sequência."
                            : riddle.type === 'ADEDONHA'
                            ? "Adedonha! Você terá que preencher 9 categorias com a letra sorteada. Seja rápido!"
                            : "This challenge is timed. The question and options will appear when you start."}
                    </p>
                    <button 
                        onClick={handleManualStart} 
                        className="bg-purple-600 text-white text-xl font-bold px-12 py-4 rounded-full shadow-xl hover:bg-purple-700 hover:scale-105 transition-all"
                    >
                        INICIAR
                    </button>
                </div>
            ) : (
                <div className="animate-fade-in">
                    {riddle.type === 'MULTIPLE_CHOICE' && riddle.subQuestions ? (
                        <p className="text-center text-purple-700 font-medium px-4 whitespace-pre-wrap mb-4">
                            Pergunta {quizIndex + 1} de {riddle.subQuestions.length}:<br/>
                            <span className="text-xl font-bold text-gray-900">{riddle.subQuestions[quizIndex].question}</span>
                        </p>
                    ) : riddle.type === 'ADEDONHA' ? (
                        <div className="text-center mb-6">
                             <div className="inline-block bg-slate-900 text-white px-8 py-4 rounded-xl text-6xl font-black mb-2 shadow-lg">
                                 {riddle.letter}
                             </div>
                             <p className="text-gray-500 text-sm font-bold uppercase">Letra da Rodada</p>
                        </div>
                    ) : (
                        <p className="text-center text-purple-700 font-medium px-4 whitespace-pre-wrap mb-4">{riddle.question}</p>
                    )}
                </div>
            )}

            {/* ADEDONHA GAME UI */}
            {riddle.type === 'ADEDONHA' && hasStarted && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ADEDONHA_CATEGORIES.map((cat, idx) => (
                            <div key={idx}>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{cat}</label>
                                <input 
                                    type="text" 
                                    disabled={isValidating || adedonhaSubmitted}
                                    value={adedonhaAnswers[cat] || ''}
                                    onChange={(e) => handleAdedonhaChange(cat, e.target.value)}
                                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 outline-none font-bold text-gray-800"
                                    placeholder={`Começa com ${riddle.letter}...`}
                                />
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={() => handleAdedonhaSubmit()} 
                        disabled={isValidating || adedonhaSubmitted}
                        className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-green-700 transition-colors"
                    >
                        {isValidating ? 'Enviando...' : 'ENVIAR RESPOSTAS'}
                    </button>
                </div>
            )}

            {/* ... EXISTING GAMES ... */}
            {/* PLATFORMER UI */}
            {riddle.type === 'PLATFORMER' && (
                <div className="relative w-full h-80 bg-slate-900 rounded-xl overflow-hidden border-4 border-slate-700 touch-none select-none">
                     <canvas ref={platformerCanvasRef} width={400} height={320} className="w-full h-full block" />
                     {platformerState === 'START' && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><button onClick={handlePlatformerStart} className="bg-red-600 text-white px-8 py-3 rounded-full font-bold">START</button></div>}
                     {platformerState === 'PLAYING' && <div className="absolute bottom-4 left-0 right-0 flex justify-between px-4 sm:hidden"><button className="w-16 h-16 bg-white/20 rounded-full border-2 border-white/50" onTouchStart={(e)=>{e.preventDefault();handleTouchControl('ArrowLeft',true)}} onTouchEnd={(e)=>{e.preventDefault();handleTouchControl('ArrowLeft',false)}}>←</button><button className="w-16 h-16 bg-white/20 rounded-full border-2 border-white/50" onTouchStart={(e)=>{e.preventDefault();handleTouchControl('ArrowRight',true)}} onTouchEnd={(e)=>{e.preventDefault();handleTouchControl('ArrowRight',false)}}>→</button><button className="w-16 h-16 bg-red-500/50 rounded-full border-2 border-red-300 font-bold text-white" onTouchStart={(e)=>{e.preventDefault();handleTouchControl('Space',true)}} onTouchEnd={(e)=>{e.preventDefault();handleTouchControl('Space',false)}}>JUMP</button></div>}
                </div>
            )}

            {/* PONG UI */}
            {riddle.type === 'PONG' && (
                <div className="relative w-full h-80 bg-slate-900 rounded-xl overflow-hidden border-4 border-green-500 touch-none" onMouseMove={handlePongMove} onTouchMove={handlePongMove}>
                    <canvas ref={pongCanvasRef} width={400} height={320} className="w-full h-full block cursor-none" />
                    {pongState === 'START' && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><button onClick={handlePongStart} className="bg-green-600 text-white px-8 py-3 rounded-full font-bold">START</button></div>}
                    {pongState === 'PLAYING' && <div className="absolute top-2 right-2 text-white font-mono font-bold">Score: {pongScore} / {riddle.pongScoreThreshold} | Lives: {pongLives}</div>}
                </div>
            )}

            {/* FLAPPY UI */}
            {riddle.type === 'FLAPPY' && (
                <div className="relative w-full h-80 bg-slate-900 rounded-xl overflow-hidden border-4 border-slate-300 touch-none" onMouseDown={(e)=>handleFlappyJump(e)} onTouchStart={(e)=>handleFlappyJump(e)}>
                    <canvas ref={canvasRef} width={400} height={320} className="w-full h-full block" />
                    {flappyState === 'START' && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><div className="text-white font-bold text-2xl">Tap to Jump</div></div>}
                </div>
            )}

            {/* SCRAMBLED */}
            {riddle.type === 'SCRAMBLED' && hasStarted && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-center flex-wrap gap-2">{scrambledDisplay.split('').map((char, i) => <div key={i} className="w-10 h-10 bg-indigo-100 text-indigo-800 border-2 border-indigo-300 rounded-lg flex items-center justify-center font-bold">{char}</div>)}</div>
                    <form onSubmit={handleTextSubmit}><input type="text" value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} className="w-full p-4 border-2 rounded-xl text-center font-bold uppercase" placeholder="Answer..." /><button disabled={isValidating} type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold mt-4">{isValidating ? 'Checking...' : 'Submit'}</button></form>
                </div>
            )}

            {/* TEXT / TIMED */}
            {(riddle.type === 'TEXT' || riddle.type === 'TIMED') && hasStarted && (
                <form onSubmit={handleTextSubmit} className="space-y-4 animate-fade-in">
                    <input type="text" value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} placeholder="Type answer..." disabled={isGameOver || isValidating} className="w-full p-4 border-2 rounded-xl text-center text-xl font-bold" />
                    <button type="submit" disabled={isGameOver || isValidating} className="w-full py-4 rounded-xl font-bold bg-indigo-600 text-white">{isValidating ? 'Validating...' : 'Submit Answer'}</button>
                </form>
            )}

            {/* MULTIPLE CHOICE (NEW SEQUENTIAL MODE) */}
            {riddle.type === 'MULTIPLE_CHOICE' && hasStarted && riddle.subQuestions && (
                <div className="grid grid-cols-1 gap-3 animate-fade-in relative">
                    {/* FEEDBACK OVERLAY */}
                    {quizFeedback !== 'NONE' && (
                        <div className={`absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-opacity-90 transition-all ${quizFeedback === 'CORRECT' ? 'bg-green-100' : 'bg-red-100'}`}>
                            <div className="text-center">
                                <div className="text-6xl mb-2">{quizFeedback === 'CORRECT' ? '✅' : '❌'}</div>
                                <h3 className={`text-2xl font-black ${quizFeedback === 'CORRECT' ? 'text-green-700' : 'text-red-600'}`}>
                                    {quizFeedback === 'CORRECT' ? 'CORRECT!' : 'WRONG!'}
                                </h3>
                            </div>
                        </div>
                    )}

                    {riddle.subQuestions[quizIndex]?.options.map((option, idx) => (
                        <button key={idx} onClick={() => handleMultipleChoice(idx)} disabled={isGameOver || isValidating || quizFeedback !== 'NONE'} className="p-4 rounded-xl border-2 text-left font-bold bg-white hover:bg-purple-50 disabled:bg-gray-50 transition-colors">{option}</button>
                    ))}
                    
                    <div className="flex justify-between items-center text-xs font-bold text-gray-400 mt-2 px-2">
                        <span>Score: {quizScore}</span>
                        <span>Question {quizIndex + 1}/{riddle.subQuestions.length}</span>
                    </div>
                </div>
            )}

            {/* TERMO */}
            {riddle.type === 'TERMO' && (
                <div className="select-none">
                    <div className="flex flex-col items-center gap-2 mb-6">
                        {Array.from({ length: 5 }).map((_, rowIndex) => {
                            const isCurrent = rowIndex === guesses.length;
                            const guess = guesses[rowIndex] || (isCurrent ? currentGuess : '');
                            return (
                                <div key={rowIndex} className="flex gap-2">
                                    {Array.from({ length: 5 }).map((_, colIndex) => {
                                        const letter = guess[colIndex] || '';
                                        const colorClass = (rowIndex < guesses.length) ? getTermoLetterStyle(rowIndex, colIndex) : 'bg-white border-gray-300 text-black';
                                        return <div key={colIndex} className={`w-10 h-10 border-2 rounded flex items-center justify-center font-bold uppercase ${colorClass}`}>{letter}</div>
                                    })}
                                </div>
                            )
                        })}
                    </div>
                    {termoStatus === 'PLAYING' && (
                        <div className="space-y-1.5">
                            {KEYBOARD_ROWS.map((row, i) => (
                                <div key={i} className="flex justify-center gap-1">{row.map(char => <button key={char} onClick={() => handleTermoKey(char)} disabled={isValidating} className={`h-10 w-8 rounded font-bold text-sm ${getKeypadStyle(char)}`}>{char}</button>)}{i === 2 && <button onClick={() => handleTermoKey('BACKSPACE')} disabled={isValidating} className="h-10 px-3 bg-gray-300 rounded text-xs font-bold">⌫</button>}</div>
                            ))}
                            <div className="flex justify-center mt-2"><button onClick={() => handleTermoKey('ENTER')} disabled={isValidating} className="h-10 px-8 bg-indigo-600 text-white rounded font-bold">{isValidating ? '...' : 'ENTER'}</button></div>
                        </div>
                    )}
                </div>
            )}

            {/* CONNECTIONS */}
            {riddle.type === 'CONNECTIONS' && (
                <div className="space-y-4 select-none">
                    <div className="space-y-2">
                        {solvedGroups.map((g, i) => (
                            <div key={i} className={`${GROUP_THEMES[i % 4].bg} p-3 rounded text-center border-b-4 ${GROUP_THEMES[i % 4].border}`}><div className="font-bold">{g.title}</div><div className="text-xs">{g.items.join(', ')}</div></div>
                        ))}
                    </div>
                    {allItems.length > 0 && !isGameOver && (
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {allItems.map((item, idx) => (
                                <button key={`${item.word}-${idx}`} onClick={() => handleConnectionClick(item.word)} className={`aspect-[4/3] rounded-lg p-1 text-xs font-bold border-b-4 ${selectedItems.includes(item.word) ? 'bg-slate-800 text-white border-slate-900' : 'bg-gray-100 text-gray-700 border-gray-300'}`}>{item.word}</button>
                            ))}
                        </div>
                    )}
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-xs font-bold text-gray-500 mb-1 ml-0.5">Vidas</div>
                            <div className="flex gap-1">{[...Array(lives)].map((_, i) => <div key={i} className="w-3 h-3 rounded-full bg-gray-600"/>)}</div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setSelectedItems([])} className="px-4 py-2 rounded-full border text-xs font-bold">Deselect</button>
                            <button onClick={submitConnections} disabled={selectedItems.length !== 4 || isValidating} className="px-6 py-2 rounded-full font-bold text-xs bg-black text-white disabled:opacity-50">{isValidating ? '...' : 'Submit'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MEMORY */}
            {riddle.type === 'MEMORY' && (
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 sm:gap-2 justify-center mx-auto w-full">
                    {memoryCards.map((card, index) => (
                        <div key={`${card.id}-${index}`} onClick={() => handleMemoryCardClick(index)} className={`aspect-square cursor-pointer ${card.isMatched ? 'opacity-50' : ''}`}>
                             <div className={`w-full h-full bg-purple-600 rounded flex items-center justify-center text-white font-bold ${card.isFlipped || card.isMatched ? 'hidden' : 'block'}`}>?</div>
                             <img src={card.imageUrl} className={`w-full h-full object-cover rounded border-2 border-purple-500 ${card.isFlipped || card.isMatched ? 'block' : 'hidden'}`} />
                        </div>
                    ))}
                </div>
            )}

            {/* SCAVENGER */}
            {riddle.type === 'SCAVENGER' && (
                <div className="space-y-4 text-center">
                    {scavengerState === 'INTRO' && (
                        <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
                            <h4 className="font-bold text-lg text-orange-800 mb-2">Desafio da Casa do Gugu</h4>
                            <p className="text-sm text-gray-700 mb-4">Encontre o objeto em {getInitialTime()} segundos!</p>
                            <button onClick={handleScavengerStart} className="w-full py-4 rounded-xl font-bold bg-orange-600 text-white">INICIAR TIMER</button>
                        </div>
                    )}
                    {scavengerState === 'HUNTING' && (
                        <div className="animate-fade-in">
                            <h2 className="text-2xl font-black text-purple-800 mb-4">{riddle.scavengerItem || "OBJETO MISTERIOSO"}</h2>
                            {!imagePreview ? (
                                <label className="block w-full cursor-pointer h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center"><span className="text-3xl">📸</span><input type="file" accept="image/*" onChange={handleImageChange} className="hidden" /></label>
                            ) : (
                                <div><img src={imagePreview} className="w-full h-48 object-contain bg-black rounded mb-2" /><button onClick={handleImageUploadSubmit} className="w-full py-3 bg-green-600 text-white font-bold rounded">ENVIAR</button></div>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {riddle.type === 'IMAGE' && (
                <div>
                     {!imagePreview ? <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-purple-50 file:text-purple-700"/> : <div><img src={imagePreview} className="w-full h-64 object-contain mb-4"/><button onClick={handleImageUploadSubmit} className="w-full py-3 bg-pink-600 text-white font-bold rounded">Submit Photo</button></div>}
                </div>
            )}

            {feedback && <p className={`text-center mt-4 text-sm font-bold ${feedback.includes('Incorrect') || feedback.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>{feedback}</p>}
        </div>
      </div>
    </div>
  );
};