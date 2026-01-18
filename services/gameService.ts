import { GameState, Player, Riddle, TileType, Tile, RiddleLibraryItem, DbSchema, Settings, GameLog, Notification, ChallengeAnswer, Attempt, AdedonhaSubmission, ADEDONHA_CATEGORIES } from '../types';
import { BOARD_LAYOUT as DEFAULT_BOARD_LAYOUT, TOTAL_TILES, RIDDLES as DEFAULT_RIDDLES } from '../constants';
import { db } from '../firebaseConfig';
import { 
    collection, 
    doc, 
    setDoc, 
    getDocs, 
    getDoc,
    onSnapshot, 
    updateDoc, 
    deleteDoc, 
    query, 
    where,
    addDoc,
    orderBy,
    limit,
    arrayUnion
} from 'firebase/firestore';

// --- CONSTANTS ---
const COLLECTIONS = {
    PLAYERS: 'players',
    CREDENTIALS: 'secure_credentials', 
    RIDDLES: 'riddles',
    CHALLENGE_ANSWERS: 'challenge_answers', 
    RIDDLE_LIBRARY: 'riddle_library',
    SETTINGS: 'settings',
    BOARD: 'board',
    LOGS: 'game_logs',
    ADEDONHA_SUBMISSIONS: 'adedonha_submissions'
};

// --- DATE HELPERS ---
export const getTodayString = (): string => {
    // Returns YYYY-MM-DD in local time
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- FIRESTORE SERVICE WRAPPER ---
const checkDb = () => {
    if (!db) {
        console.error("Firebase is not configured in firebaseConfig.ts");
        return false;
    }
    return true;
};

// HELPER: Sanitize for PUBLIC collection (Remove Answers)
const sanitizeRiddle = (riddle: Riddle): any => {
    const publicRiddle: any = {
        day: Number(riddle.day) || 0,
        date: riddle.date || '', // Include date in public doc
        type: riddle.type || 'TEXT',
        question: riddle.question || '',
        points: Number(riddle.points) || 0,
        timeLimit: Number(riddle.timeLimit) || 0,
        options: Array.isArray(riddle.options) ? riddle.options : [], 
        connectionsLives: Number(riddle.connectionsLives) || 4,
        flappyThreshold: Number(riddle.flappyThreshold) || 0,
        flappyLives: Number(riddle.flappyLives) || 2,
        customImage: riddle.customImage || '',
        scavengerItem: riddle.scavengerItem || '',
        memoryImages: Array.isArray(riddle.memoryImages) ? riddle.memoryImages : [],
        pongScoreThreshold: Number(riddle.pongScoreThreshold) || 10,
        pongSpeed: riddle.pongSpeed || 'MEDIUM',
        pongLives: Number(riddle.pongLives) || 3,
        platformerLives: Number(riddle.platformerLives) || 3,
        letter: riddle.letter || '', // Adedonha
        status: riddle.status || 'ACTIVE'
    };

    if (riddle.type === 'SCRAMBLED' && riddle.scrambledWord) {
        const word = riddle.scrambledWord.toUpperCase();
        let shuffled = word.split('').sort(() => Math.random() - 0.5).join('');
        if (word.length > 1 && shuffled === word) shuffled = word.split('').reverse().join('');
        publicRiddle.publicScrambledString = shuffled;
    }
    
    if (riddle.type === 'CONNECTIONS' && riddle.connectionGroups) {
        const flatItems = riddle.connectionGroups.flatMap(g => 
            g.items.map(item => ({ word: item })) 
        );
        publicRiddle.connectionItems = flatItems.sort(() => Math.random() - 0.5);
    }
    
    // NEW: Sanitize Multiple Choice SubQuestions (Remove correct index)
    if (riddle.type === 'MULTIPLE_CHOICE' && riddle.subQuestions) {
        publicRiddle.subQuestions = riddle.subQuestions.map(sq => ({
            question: sq.question,
            options: sq.options
        }));
    }

    return publicRiddle;
};

export const gameService = {
    subscribeToPlayers: (callback: (players: Player[]) => void) => {
        if (!checkDb()) return () => {};
        const q = collection(db, COLLECTIONS.PLAYERS);
        return onSnapshot(q, (snapshot) => {
            const players = snapshot.docs.map(doc => {
                const data = doc.data() as any;
                // Ensure attempts object exists for migration
                if (!data.attempts) data.attempts = {};
                return data as Player;
            });
            callback(players);
        });
    },
    subscribeToRiddles: (callback: (riddles: Riddle[]) => void) => {
        if (!checkDb()) return () => {};
        const q = collection(db, COLLECTIONS.RIDDLES);
        return onSnapshot(q, (snapshot) => {
            const riddles = snapshot.docs.map(doc => doc.data() as Riddle);
            riddles.sort((a, b) => a.day - b.day);
            callback(riddles);
        });
    },
    subscribeToBoard: (callback: (layout: Tile[]) => void) => {
        if (!checkDb()) return () => {};
        const docRef = doc(db, COLLECTIONS.BOARD, 'layout');
        return onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data().tiles as Tile[]);
            } else {
                gameService.saveBoardLayout(DEFAULT_BOARD_LAYOUT);
                callback(DEFAULT_BOARD_LAYOUT);
            }
        });
    },
    subscribeToLibrary: (callback: (items: RiddleLibraryItem[]) => void) => {
         if (!checkDb()) return () => {};
         const q = collection(db, COLLECTIONS.RIDDLE_LIBRARY);
         return onSnapshot(q, (snapshot) => {
             const items = snapshot.docs.map(doc => doc.data() as RiddleLibraryItem);
             callback(items);
         });
    },
    subscribeToAdedonhaSubmissions: (callback: (subs: AdedonhaSubmission[]) => void) => {
        if (!checkDb()) return () => {};
        const q = collection(db, COLLECTIONS.ADEDONHA_SUBMISSIONS);
        return onSnapshot(q, (snapshot) => {
            const subs = snapshot.docs.map(doc => doc.data() as AdedonhaSubmission);
            callback(subs);
        });
    },
    subscribeToSettings: (callback: (settings: Settings) => void) => {
        if (!checkDb()) return () => {};
        const docRef = doc(db, COLLECTIONS.SETTINGS, 'config');
        return onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data() as Settings);
            } else {
                callback({ boardStartDate: '' });
            }
        });
    },
    verifyCredentials: async (username: string, passwordInput: string): Promise<boolean> => {
        if (!checkDb()) return false;
        try {
            const credRef = doc(db, COLLECTIONS.CREDENTIALS, username.toLowerCase());
            const snap = await getDoc(credRef);
            if (snap.exists()) {
                const data = snap.data();
                return data.password === passwordInput;
            }
            return false;
        } catch (e) {
            console.error("Auth check failed", e);
            return false;
        }
    },
    registerCredential: async (username: string, password: string) => {
        if (!checkDb()) return;
        await setDoc(doc(db, COLLECTIONS.CREDENTIALS, username.toLowerCase()), {
            username: username.toLowerCase(),
            password: password
        });
    },
    checkSecuritySetup: async (): Promise<boolean> => {
        if (!checkDb()) return true;
        const adminRef = doc(db, COLLECTIONS.CREDENTIALS, 'admin');
        const snap = await getDoc(adminRef);
        return snap.exists();
    },
    saveSettings: async (settings: Settings) => {
        if (!checkDb()) return;
        await setDoc(doc(db, COLLECTIONS.SETTINGS, 'config'), settings);
    },
    savePlayer: async (player: Player) => {
        if (!checkDb()) return;
        await setDoc(doc(db, COLLECTIONS.PLAYERS, player.username), player);
    },
    deletePlayer: async (username: string) => {
        if (!checkDb()) return;
        await deleteDoc(doc(db, COLLECTIONS.PLAYERS, username));
        await deleteDoc(doc(db, COLLECTIONS.CREDENTIALS, username.toLowerCase()));
        // Note: Clean up associated logs/submissions if necessary
    },
    
    // --- MAIN RIDDLE SAVING (SPLITS PUBLIC/PRIVATE) ---
    saveRiddles: async (riddles: Riddle[]) => {
        if (!checkDb()) return;
        
        const batchPromises = riddles.map(async r => {
            const id = `day_${r.day}`;
            // 1. Save Public Data (Sanitized)
            await setDoc(doc(db, COLLECTIONS.RIDDLES, id), sanitizeRiddle(r));
            
            // 2. Save Private Answers
            // CRITICAL FIX: Manually construct object to avoid circular references or Firestore objects
            const secretPayload: any = {
                answerKeywords: Array.isArray(r.answerKeywords) ? [...r.answerKeywords] : [],
                correctAnswerIndex: r.correctAnswerIndex,
                wordleTarget: r.wordleTarget,
                scrambledWord: r.scrambledWord,
                connectionGroups: Array.isArray(r.connectionGroups) ? r.connectionGroups.map(g => ({
                    title: g.title,
                    items: [...g.items]
                })) : []
            };

            // NEW: Extract SubQuestions Answers
            if (r.type === 'MULTIPLE_CHOICE' && r.subQuestions) {
                secretPayload.subQuestionAnswers = r.subQuestions.map(sq => sq.correctAnswerIndex || 0);
            }

            // Convert to string safely
            let jsonString = '{}';
            try {
                jsonString = JSON.stringify(secretPayload);
            } catch(e) {
                console.error("JSON Stringify failed for riddle " + id, e);
            }

            const secretData: ChallengeAnswer = {
                challengeId: id,
                correctAnswer: jsonString
            };
            await setDoc(doc(db, COLLECTIONS.CHALLENGE_ANSWERS, id), secretData);
        });

        await Promise.all(batchPromises);
    },

    saveBoardLayout: async (layout: Tile[]) => {
        if (!checkDb()) return;
        await setDoc(doc(db, COLLECTIONS.BOARD, 'layout'), { tiles: layout });
    },

    saveToLibrary: async (item: RiddleLibraryItem) => {
        if (!checkDb()) return;
        const r = item.riddleContent as Riddle;
        const sanitizedContent = sanitizeRiddle(r);
        const itemToSave = { ...item, riddleContent: sanitizedContent };
        await setDoc(doc(db, COLLECTIONS.RIDDLE_LIBRARY, item.id), itemToSave);

        // Private
        const secretPayload: any = {
            answerKeywords: r.answerKeywords || [],
            correctAnswerIndex: r.correctAnswerIndex,
            wordleTarget: r.wordleTarget,
            scrambledWord: r.scrambledWord,
            connectionGroups: Array.isArray(r.connectionGroups) ? r.connectionGroups.map(g => ({
                title: g.title, items: [...g.items]
            })) : []
        };
        
        if (r.type === 'MULTIPLE_CHOICE' && r.subQuestions) {
             secretPayload.subQuestionAnswers = r.subQuestions.map(sq => sq.correctAnswerIndex || 0);
        }

        const secretData: ChallengeAnswer = {
            challengeId: item.id,
             correctAnswer: JSON.stringify(secretPayload)
        };
        await setDoc(doc(db, COLLECTIONS.CHALLENGE_ANSWERS, item.id), secretData);
    },

    deleteFromLibrary: async (id: string) => {
        if (!checkDb()) return;
        await updateDoc(doc(db, COLLECTIONS.RIDDLE_LIBRARY, id), { status: 'INACTIVE' });
    },

    // --- ADEDONHA FUNCTIONS ---
    submitAdedonha: async (username: string, day: number, answers: Record<string, string>) => {
        if (!checkDb()) return;
        const id = `${username}-${day}`;
        const submission: AdedonhaSubmission = {
            username,
            day,
            answers,
            validation: {}, // Start empty
            status: 'PENDING',
            timestamp: new Date().toISOString()
        };
        await setDoc(doc(db, COLLECTIONS.ADEDONHA_SUBMISSIONS, id), submission);
        
        // Mark player attempt as PENDING (so they can't replay but don't move yet)
        await gameService.registerAttempt(username, day, 'PENDING');
        await gameService.logGameEvent(username, day, 'ADEDONHA_SUBMIT', 'Submeteu respostas de Adedonha');
    },

    validateAdedonhaItem: async (username: string, day: number, category: string, status: 'APPROVED' | 'REJECTED') => {
        if (!checkDb()) return;
        const id = `${username}-${day}`;
        // Use setDoc merge to be safe
        await setDoc(doc(db, COLLECTIONS.ADEDONHA_SUBMISSIONS, id), {
            validation: { [category]: status }
        }, { merge: true });
    },

    calculateAdedonhaScore: async (username: string, day: number) => {
        if (!checkDb()) return;
        const id = `${username}-${day}`;
        const snap = await getDoc(doc(db, COLLECTIONS.ADEDONHA_SUBMISSIONS, id));
        if (!snap.exists()) return;
        
        const data = snap.data() as AdedonhaSubmission;
        const approvedCount = Object.values(data.validation || {}).filter(v => v === 'APPROVED').length;
        
        const casas = Math.floor(approvedCount / 3);

        await setDoc(doc(db, COLLECTIONS.ADEDONHA_SUBMISSIONS, id), {
            score: casas,
            status: 'COMPLETED'
        }, { merge: true });

        // Award movement
        if (casas > 0) {
            const pRef = doc(db, COLLECTIONS.PLAYERS, username);
            const pSnap = await getDoc(pRef);
            let currentPos = 1;
            if (pSnap.exists()) {
                currentPos = pSnap.data().position || 1;
            }
            // Use setDoc merge to avoid crash if player missing
            await setDoc(pRef, { position: currentPos + casas }, { merge: true });
            
            await gameService.registerAttempt(username, day, 'WIN');
        } else {
             await gameService.registerAttempt(username, day, 'WIN');
        }
    },

    // --- VERIFICATION ---
    verifyAnswer: async (riddle: Riddle, userAnswer: any, subQuestionIndex?: number): Promise<{correct: boolean, details?: any}> => {
        if (!checkDb()) return { correct: false };

        const lookupId = riddle.day ? `day_${riddle.day}` : null;
        if (!lookupId) return { correct: true }; 

        try {
            const snap = await getDoc(doc(db, COLLECTIONS.CHALLENGE_ANSWERS, lookupId));
            if (!snap.exists()) {
                console.warn(`No answer sheet found for ${lookupId}`);
                return { correct: false };
            }

            const secret = JSON.parse(snap.data().correctAnswer || '{}');

            if (riddle.type === 'TEXT' || riddle.type === 'TIMED') {
                const keywords = secret.answerKeywords || [];
                return { correct: keywords.some((k: string) => String(userAnswer).toLowerCase().includes(k.toLowerCase())) };
            }
            if (riddle.type === 'MULTIPLE_CHOICE') {
                if (typeof subQuestionIndex === 'number' && secret.subQuestionAnswers && Array.isArray(secret.subQuestionAnswers)) {
                     const correctIndex = secret.subQuestionAnswers[subQuestionIndex];
                     return { correct: Number(userAnswer) === Number(correctIndex) };
                }
                return { correct: Number(userAnswer) === Number(secret.correctAnswerIndex) };
            }
            if (riddle.type === 'TERMO') {
                 return { correct: String(userAnswer).toUpperCase() === String(secret.wordleTarget).toUpperCase() };
            }
            if (riddle.type === 'SCRAMBLED') {
                return { correct: String(userAnswer).toUpperCase() === String(secret.scrambledWord).toUpperCase() };
            }
            if (riddle.type === 'CONNECTIONS') {
                const groups = secret.connectionGroups || [];
                const submitted = userAnswer as string[];
                const firstItem = submitted[0];
                const matchingGroup = groups.find((g: any) => g.items.includes(firstItem));
                
                if (matchingGroup) {
                    const allMatch = submitted.every(s => matchingGroup.items.includes(s));
                    if (allMatch) return { correct: true, details: matchingGroup };
                }
                return { correct: false };
            }
        } catch (error) {
            console.error("Verification error:", error);
            return { correct: false };
        }
        return { correct: false };
    },
    
    verifyTermoGuess: async (riddle: Riddle, guess: string): Promise<string[]> => {
        if (!checkDb()) return Array(5).fill('ABSENT');
        const lookupId = riddle.day ? `day_${riddle.day}` : null;
        if (!lookupId) return Array(5).fill('ABSENT');

        try {
            const snap = await getDoc(doc(db, COLLECTIONS.CHALLENGE_ANSWERS, lookupId));
            if (!snap.exists()) return Array(5).fill('ABSENT');
            const secret = JSON.parse(snap.data().correctAnswer || '{}');
            const target = (secret.wordleTarget || '').toUpperCase();
            const g = guess.toUpperCase();

            const result = Array(5).fill('ABSENT');
            const targetChars = target.split('');

            for (let i=0; i<5; i++) {
                if (g[i] === target[i]) {
                    result[i] = 'CORRECT';
                    targetChars[i] = null;
                }
            }
            for (let i=0; i<5; i++) {
                if (result[i] === 'ABSENT' && targetChars.includes(g[i])) {
                    result[i] = 'PRESENT';
                    const idx = targetChars.indexOf(g[i]);
                    if (idx > -1) targetChars[idx] = null;
                }
            }
            return result;
        } catch (e) {
            return Array(5).fill('ABSENT');
        }
    },

    getAnswerForAdmin: async (id: string): Promise<any> => {
        if (!checkDb()) return {};
        const snap = await getDoc(doc(db, COLLECTIONS.CHALLENGE_ANSWERS, id));
        if (snap.exists()) {
            return JSON.parse(snap.data().correctAnswer || '{}');
        }
        return {};
    },

    logGameEvent: async (username: string, day: number, action: GameLog['action'], details?: string, targetUser?: string) => {
        if (!checkDb()) return;
        const log: GameLog = { username, day, action, details: details || '', timestamp: new Date().toISOString() };
        if (targetUser) log.targetUser = targetUser;
        await addDoc(collection(db, COLLECTIONS.LOGS), log);
    },
    getAllLogs: async (limitCount = 50) => {
        if (!checkDb()) return [];
        const q = query(collection(db, COLLECTIONS.LOGS), orderBy("timestamp", "desc"), limit(limitCount));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as GameLog);
    },

    // --- SAFE UPDATES (SET MERGE) ---
    sendNotification: async (username: string, message: string) => {
        if (!checkDb()) return;
        const playerRef = doc(db, COLLECTIONS.PLAYERS, username);
        const notification: Notification = { id: crypto.randomUUID(), message, timestamp: new Date().toISOString(), read: false };
        await setDoc(playerRef, { notifications: arrayUnion(notification) }, { merge: true });
    },
    clearNotifications: async (username: string) => {
         if (!checkDb()) return;
         await setDoc(doc(db, COLLECTIONS.PLAYERS, username), { notifications: [] }, { merge: true });
    },
    updatePlayerPosition: async (username: string, newPosition: number, boardLayout: Tile[]) => {
        if (!checkDb()) return;
        let pos = Number(newPosition);
        if (isNaN(pos)) pos = 1; 
        pos = Math.max(1, Math.min(pos, TOTAL_TILES));
        // FIX: use setDoc with merge to prevent 'No document to update'
        await setDoc(doc(db, COLLECTIONS.PLAYERS, username), { position: pos }, { merge: true });
    },
    
    registerAttempt: async (username: string, day: number, status: 'WIN' | 'LOSS' | 'PENDING') => {
        if (!checkDb()) return;
        
        const attemptData: Attempt = {
            status,
            timestamp: new Date().toISOString()
        };

        // CRITICAL FIX: Use nested object structure for setDoc to handle merging correctly
        // This avoids issues where updateDoc fails if the map doesn't exist, 
        // or where dot notation in setDoc keys creates literal keys instead of nesting.
        const payload: any = {
            attempts: {
                [day]: attemptData 
            },
            lastActive: new Date().toISOString()
        };

        if (status === 'WIN') {
            payload.completedDays = arrayUnion(day);
        }

        const docRef = doc(db, COLLECTIONS.PLAYERS, username);
        await setDoc(docRef, payload, { merge: true });
    },

    submitImage: async (username: string, day: number, imageUrl: string, currentSubmissions: any[]) => {
        if (!checkDb()) return;
        const newSubmissions = currentSubmissions.filter(s => s.day !== day);
        newSubmissions.push({ day, imageUrl, timestamp: new Date().toISOString() });
        
        const attemptData: Attempt = { status: 'WIN', timestamp: new Date().toISOString() };
        
        // CRITICAL FIX: Use setDoc with proper nesting
        const payload = {
            imageSubmissions: newSubmissions, 
            completedDays: arrayUnion(day),
            attempts: {
                [day]: attemptData
            }
        };

        const docRef = doc(db, COLLECTIONS.PLAYERS, username);
        await setDoc(docRef, payload, { merge: true });
    },
    markIntroSeen: async (username: string) => {
        if (!checkDb()) return;
        await setDoc(doc(db, COLLECTIONS.PLAYERS, username), { hasSeenIntro: true }, { merge: true });
    },
    resetPlayerSpecific: async (username: string) => {
        if (!checkDb()) return;
        await setDoc(doc(db, COLLECTIONS.PLAYERS, username), { position: 1, completedDays: [], attempts: {}, imageSubmissions: [], notifications: [] }, { merge: true });
    },
    seedDefaults: async () => {
        if (!checkDb()) return;
        console.log("Seeding default data...");
        await gameService.saveRiddles(DEFAULT_RIDDLES as Riddle[]);
        await gameService.saveBoardLayout(DEFAULT_BOARD_LAYOUT);
    },
    forceSyncAnswers: async () => {
        if (!checkDb()) return;
        console.log("Forcing Answer Table Sync...");
        await gameService.saveRiddles(DEFAULT_RIDDLES as Riddle[]);
        console.log("Answers Synced.");
    },
    resetGameContentOnly: async (hardReset: boolean = false) => {
        if (!checkDb()) return;
        
        console.log(`STARTING ${hardReset ? 'HARD' : 'SOFT'} RESET...`);

        // 1. Players & Credentials
        const playersSnap = await getDocs(collection(db, COLLECTIONS.PLAYERS));
        const playerPromises = playersSnap.docs.map(async d => {
            const pid = d.id;
            const isSystemAccount = pid === 'teste' || pid === 'admin';

            if (hardReset && !isSystemAccount) {
                // HARD RESET: Delete user profile AND credentials to free up the username
                await deleteDoc(d.ref); 
                await deleteDoc(doc(db, COLLECTIONS.CREDENTIALS, pid.toLowerCase()));
            } else {
                // SOFT RESET: Reset state but keep account (for everyone including system accounts)
                await setDoc(d.ref, { 
                    position: 1, 
                    completedDays: [], 
                    attempts: {}, 
                    imageSubmissions: [], 
                    notifications: [], 
                    lastActive: new Date().toISOString(), 
                    hasSeenIntro: false 
                }, { merge: true });
            }
        });

        // 2. Game Logs (Always clear on both resets)
        const logsSnap = await getDocs(collection(db, COLLECTIONS.LOGS));
        const logPromises = logsSnap.docs.map(d => deleteDoc(d.ref));

        // 3. Adedonha Submissions (Always clear on both resets)
        const adedonhaSnap = await getDocs(collection(db, COLLECTIONS.ADEDONHA_SUBMISSIONS));
        const adedonhaPromises = adedonhaSnap.docs.map(d => deleteDoc(d.ref));

        await Promise.all([...playerPromises, ...logPromises, ...adedonhaPromises]);
        console.log("RESET COMPLETE.");
    }
};

export const registerPlayer = async (username: string, avatarUrl: string, password?: string, fullName?: string) => {
    const newPlayer: Player = {
        username, fullName: fullName || username, avatarUrl, position: 1, completedDays: [], attempts: {}, imageSubmissions: [], lastActive: new Date().toISOString(), hasSeenIntro: false, notifications: []
    };
    await gameService.savePlayer(newPlayer);
    if (password) await gameService.registerCredential(username, password);
};