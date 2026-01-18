

export enum TileType {
  NORMAL = 'NORMAL',
  FORWARD_1 = 'FORWARD_1',
  BACK_1 = 'BACK_1',
  CHOOSE_FORWARD = 'CHOOSE_FORWARD',
  CHOOSE_BACK = 'CHOOSE_BACK',
  EXTRA_CHALLENGE = 'EXTRA_CHALLENGE',
  FINISH = 'FINISH',
}

export type RiddleType = 'TEXT' | 'CONNECTIONS' | 'IMAGE' | 'TIMED' | 'MULTIPLE_CHOICE' | 'TERMO' | 'FLAPPY' | 'SCAVENGER' | 'MEMORY' | 'SCRAMBLED' | 'PONG' | 'PLATFORMER' | 'ADEDONHA';

export const ADEDONHA_CATEGORIES = [
    "Nome",
    "CEP (cidade, estado ou país)",
    "Animal",
    "Cor",
    "Comida",
    "Filme ou série",
    "Minha gestora é",
    "Carro",
    "Time"
];

export interface ConnectionGroup {
    title: string;
    items: string[]; // Should be exactly 4 items
}

export interface SubQuestion {
    question: string;
    options: string[];
    correctAnswerIndex?: number; // Only present in admin, removed in public
}

export interface AdedonhaSubmission {
    username: string;
    day: number;
    answers: Record<string, string>; // Category -> Answer
    validation: Record<string, 'APPROVED' | 'REJECTED' | 'PENDING'>;
    score?: number; // Final calculated score (casas to move)
    status: 'PENDING' | 'COMPLETED';
    timestamp: string;
}

export interface Riddle {
  day: number; // Represents the ID / Sequence Number (Challenge #1, #2...)
  date?: string; // YYYY-MM-DD - The specific calendar date this unlocks
  type: RiddleType;
  question: string;
  
  // Public Display Fields (Sanitized)
  publicScrambledString?: string;
  connectionItems?: { word: string, group?: string }[]; 
  letter?: string; // For Adedonha

  // Secret/Admin Fields
  answerKeywords?: string[]; 
  connectionGroups?: ConnectionGroup[]; 
  options?: string[]; 
  correctAnswerIndex?: number; 
  wordleTarget?: string; 
  scrambledWord?: string; 
  
  // New Multi-Question Support
  subQuestions?: SubQuestion[];

  // Configs
  connectionsLives?: number; 
  flappyThreshold?: number; 
  flappyLives?: number; 
  customImage?: string; 
  scavengerItem?: string; 
  memoryImages?: string[]; 
  pongScoreThreshold?: number; 
  pongSpeed?: 'SLOW' | 'MEDIUM' | 'FAST'; 
  pongLives?: number; 
  platformerLives?: number; 
  
  points: number; 
  timeLimit?: number; 
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface RiddleLibraryItem {
    id: string;
    name: string; 
    riddleContent: Omit<Riddle, 'day' | 'date'>;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt: string;
}

export interface ImageSubmission {
    day: number;
    imageUrl: string;
    timestamp: string;
}

export interface Attempt {
    status: 'WIN' | 'LOSS' | 'PENDING';
    timestamp: string;
}

export interface GameLog {
    id?: string;
    username: string;
    targetUser?: string;
    day?: number;
    action: 'WIN' | 'LOSS' | 'BOOST' | 'TRAP' | 'IMAGE_SUBMIT' | 'AUTO_FORWARD' | 'AUTO_BACK' | 'TILE_INTERACTION' | 'ADEDONHA_SUBMIT';
    details?: string;
    timestamp: string;
}

export interface Notification {
    id: string;
    message: string;
    timestamp: string;
    read: boolean;
}

export interface Tile {
  id: number;
  type: TileType;
  label?: string;
}

export interface SecureCredential {
    username: string;
    password: string; 
}

export interface ChallengeAnswer {
    challengeId: string; 
    correctAnswer: string; 
}

export interface Player {
  username: string;
  fullName: string;
  avatarUrl?: string; 
  position: number;
  
  // New Attempt Tracking Logic
  // Key is the day number (e.g., "1", "2"), Value is the result
  attempts: Record<number, Attempt>; 
  
  // Legacy support / Redundant quick access for UI
  completedDays: number[]; 
  
  imageSubmissions: ImageSubmission[];
  lastActive: string; 
  hasSeenIntro?: boolean;
  notifications?: Notification[];
}

export interface GameState {
  players: Player[];
  currentDay: number; 
}

export interface Settings {
    // Legacy field, can be kept for reference or removed later
    boardStartDate: string; 
}

export interface UserSession {
  username: string;
  isAuthenticated: boolean;
}

export interface DbSchema {
    players: Player[];
    secure_credentials: SecureCredential[];
    riddles: Riddle[];
    challenge_answers: ChallengeAnswer[];
    riddleLibrary: RiddleLibraryItem[];
    settings: Settings;
    gameLogs: GameLog[];
}
