
import { Riddle, Tile, TileType } from './types';

export const TOTAL_TILES = 30; // 10 days * approx 3 steps avg = 30 tiles

export const BOARD_LAYOUT: Tile[] = Array.from({ length: TOTAL_TILES }, (_, i) => {
  const id = i + 1;
  let type = TileType.NORMAL;
  let label = '';

  if (id === TOTAL_TILES) type = TileType.FINISH;
  else if (id % 5 === 0) type = TileType.FORWARD_1;
  else if (id === 3 || id === 12 || id === 21) type = TileType.BACK_1;
  else if (id === 7 || id === 18) type = TileType.EXTRA_CHALLENGE;
  else if (id === 15) type = TileType.CHOOSE_FORWARD;
  else if (id === 25) type = TileType.CHOOSE_BACK;

  if (type === TileType.FORWARD_1) label = '+1 Space';
  if (type === TileType.BACK_1) label = '-1 Space';
  if (type === TileType.EXTRA_CHALLENGE) label = 'Bonus?';
  if (type === TileType.CHOOSE_FORWARD) label = 'Boost Friend';
  if (type === TileType.CHOOSE_BACK) label = 'Trap Friend';

  return { id, type, label };
});

// DEFAULT RIDDLES WITH ANSWERS (Used for seeding the DB initially)
export const RIDDLES: Riddle[] = [
  {
    day: 1,
    type: 'TEXT',
    question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?",
    answerKeywords: ['echo'],
    points: 3,
    timeLimit: 60
  },
  {
    day: 2,
    type: 'TEXT',
    question: "You measure my life in hours and I serve you by expiring. I'm quick when I'm thin and slow when I'm fat. The wind is my enemy. What am I?",
    answerKeywords: ['candle'],
    points: 2,
    timeLimit: 60
  },
  {
    day: 3,
    type: 'TEXT',
    question: "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?",
    answerKeywords: ['map', 'mapa'],
    points: 3,
    timeLimit: 60
  },
  {
    day: 4,
    type: 'TEXT',
    question: "What is seen in the middle of March and April that can’t be seen at the beginning or end of either month?",
    answerKeywords: ['r'],
    points: 2,
    timeLimit: 60
  },
  {
    day: 5,
    type: 'TEXT',
    question: "You see a boat filled with people. It has not sunk, but when you look again you don’t see a single person on the boat. Why?",
    answerKeywords: ['married', 'couple', 'casados'], 
    points: 4,
    timeLimit: 90
  },
  {
    day: 6,
    type: 'SCRAMBLED',
    question: "Unscramble this word related to vacation!",
    scrambledWord: "TRAVEL",
    points: 2,
    timeLimit: 60
  },
  {
    day: 7,
    type: 'TEXT',
    question: "I have keys but no locks. I have a space but no room. You can enter, but can’t go outside. What am I?",
    answerKeywords: ['keyboard', 'teclado'],
    points: 3,
    timeLimit: 60
  },
  {
    day: 8,
    type: 'MULTIPLE_CHOICE',
    question: "Which of these is NOT a capital city?",
    options: ['Paris', 'London', 'New York', 'Tokyo'],
    correctAnswerIndex: 2,
    points: 2,
    timeLimit: 30
  },
  {
    day: 9,
    type: 'TEXT',
    question: "I am an odd number. Take away a letter and I become even. What number am I?",
    answerKeywords: ['seven', 'sete'],
    points: 4,
    timeLimit: 60
  },
  {
    day: 10,
    type: 'TEXT',
    question: "What has to be broken before you can use it?",
    answerKeywords: ['egg', 'ovo'],
    points: 3,
    timeLimit: 60
  },
];

export const EXTRA_RIDDLE: Riddle = {
  day: 99, // Special ID
  type: 'TEXT',
  question: "Bonus Challenge: I’m light as a feather, yet the strongest man can’t hold me for much more than a minute. What am I?",
  answerKeywords: ['breath'],
  points: 2
}
