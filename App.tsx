import React, { useState, useEffect, useRef } from 'react';
import { GameBoard } from './components/GameBoard';
import { AvatarCreator } from './components/AvatarCreator';
import { RiddleModal } from './components/RiddleModal';
import { AdminDashboard } from './components/AdminDashboard';
import { IntroModal } from './components/IntroModal';
import { EXTRA_RIDDLE } from './constants';
import { 
    gameService, 
    registerPlayer, 
    getTodayString
} from './services/gameService';
import { GameState, Player, TileType, Riddle, Tile, Settings, GameLog, Notification, Attempt } from './types';
import { db } from './firebaseConfig';

const useGameSync = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [riddles, setRiddles] = useState<Riddle[]>([]);
  const [boardLayout, setBoardLayout] = useState<Tile[]>([]);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    if (!db) {
        setConfigError(true);
        setLoading(false);
        return;
    }

    const unsubPlayers = gameService.subscribeToPlayers((data) => {
        setPlayers(data);
        setLoading(false);
    });

    const unsubRiddles = gameService.subscribeToRiddles((data) => {
        setRiddles(data);
    });

    const unsubBoard = gameService.subscribeToBoard((data) => {
        setBoardLayout(data);
    });

    return () => {
        unsubPlayers();
        unsubRiddles();
        unsubBoard();
    };
  }, []);

  return { players, riddles, boardLayout, loading, configError };
};

// Helper to safely get attempt regardless of key type (string vs number)
const getAttempt = (p: Player | null, day: number) => {
    if (!p) return undefined;
    if (!p.attempts) return undefined;
    
    // Check both number and string access just to be sure
    // Firestore map keys are always strings
    return p.attempts[day] || p.attempts[String(day)];
}

const App: React.FC = () => {
  const { players, riddles, boardLayout, loading, configError } = useGameSync();
  
  // Auth State
  const [isRegistering, setIsRegistering] = useState(false); 
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loginError, setLoginError] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Security Setup State
  const [needsSecuritySetup, setNeedsSecuritySetup] = useState(false);
  const [setupAdminPwd, setSetupAdminPwd] = useState('');
  const [setupTestPwd, setSetupTestPwd] = useState('');

  // Game State
  const [showRiddle, setShowRiddle] = useState(false);
  const [activeRiddle, setActiveRiddle] = useState<Riddle | null>(null);
  const [interactionType, setInteractionType] = useState<'BOOST' | 'TRAP' | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  
  // Modals & Logs
  const [showLogs, setShowLogs] = useState(false);
  const [gameLogs, setGameLogs] = useState<GameLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // OPTIMISTIC STORAGE REF
  // Stores attempts locally to prevent UI flickering/reverting while waiting for DB sync
  const optimisticAttemptsRef = useRef<Record<string, Attempt>>({});

  // CLEANUP REF ON USER CHANGE
  useEffect(() => {
      optimisticAttemptsRef.current = {};
  }, [currentPlayer?.username]);

  // Test User State
  const isTestUser = currentPlayer?.username === 'teste';
  const [testTeleportPos, setTestTeleportPos] = useState('0');

  // --- NEW LOGIC: FIND TODAY'S RIDDLE ---
  const todayString = getTodayString();
  const todaysRiddle = riddles.find(r => r.date === todayString);
  
  // Calculate Attempt Status using robust helper + Optimistic Ref
  const attempt = currentPlayer && todaysRiddle ? (
      getAttempt(currentPlayer, todaysRiddle.day) || optimisticAttemptsRef.current[todaysRiddle.day]
  ) : undefined;
  
  const hasAttemptedToday = !!attempt;
  const attemptStatus = attempt?.status; // 'WIN' | 'LOSS' | 'PENDING'

  useEffect(() => {
      const checkSetup = async () => {
          const isSetup = await gameService.checkSecuritySetup();
          setNeedsSecuritySetup(!isSetup);
      };
      checkSetup();
  }, []);

  // SYNC PLAYER DATA WITH ROBUST MERGE
  useEffect(() => {
    if (currentPlayer) {
        const updated = players.find(p => p.username === currentPlayer.username);
        if (updated) {
            // MERGE LOGIC: Overlay optimistic attempts on top of server data
            // This ensures that if we played locally, the button STAYS disabled even if server update lags
            const mergedAttempts = { ...updated.attempts };
            
            Object.entries(optimisticAttemptsRef.current).forEach(([day, attempt]) => {
                // Keep local attempt if server doesn't have it yet
                if (!mergedAttempts[day] && !mergedAttempts[Number(day)]) {
                    mergedAttempts[day] = attempt;
                }
            });

            // Update current player state with merged data
            const finalPlayer = { ...updated, attempts: mergedAttempts };
            setCurrentPlayer(finalPlayer);

            if (updated.notifications && updated.notifications.length > 0) {
                setNotifications(updated.notifications);
                setShowNotificationModal(true);
            }
        }
    }
  }, [players, currentPlayer?.username]);

  const handleSecuritySetup = async (e: React.FormEvent) => {
      e.preventDefault();
      if (setupAdminPwd.length < 4 || setupTestPwd.length < 4) {
          alert("Passwords must be at least 4 chars.");
          return;
      }
      setIsSavingUser(true);
      try {
          await gameService.registerCredential('admin', setupAdminPwd);
          await gameService.registerCredential('teste', setupTestPwd);
          setNeedsSecuritySetup(false);
          alert("Security Initialized.");
      } catch (e) {
          alert("Failed to save credentials.");
      } finally {
          setIsSavingUser(false);
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSavingUser(true);
    
    try {
        const cleanUser = username.trim();
        if (!cleanUser) { setIsSavingUser(false); return; }

        if (cleanUser.toLowerCase() === 'admin') {
            setIsSavingUser(false);
            setIsAdmin(true);
            setIsLoggedIn(true);
            return;
        }

        const isValid = await gameService.verifyCredentials(cleanUser, password);

        if (!isValid) {
             setLoginError('Usuário ou senha inválidos.');
             setIsSavingUser(false);
             return;
        }

        const player = players.find(p => p.username.toLowerCase() === cleanUser.toLowerCase());

        if (player) {
            setCurrentPlayer(player);
            setIsLoggedIn(true);
            if (!player.hasSeenIntro) {
                setShowIntro(true);
            }
        } else if (cleanUser.toLowerCase() === 'teste') {
            handleTestUserCreation();
        } else {
            setLoginError('Credenciais válidas, mas perfil de jogador não encontrado.');
        }

    } catch (e) {
        setLoginError('Erro de conexão.');
    } finally {
        setIsSavingUser(false);
    }
  };

  const handleTestUserCreation = async () => {
      setIsSavingUser(true);
      try {
        await registerPlayer('teste', 'https://ui-avatars.com/api/?name=Teste&background=random', undefined, 'Test User');
        const tempPlayer: Player = { 
             username: 'teste', fullName: 'Test User', avatarUrl: '', position: 0, completedDays: [], attempts: {}, imageSubmissions: [], lastActive: '', hasSeenIntro: false 
        };
        setCurrentPlayer(tempPlayer);
        setIsLoggedIn(true);
      } catch (e) {
          setLoginError("Failed to create test user in DB.");
      } finally {
          setIsSavingUser(false);
      }
  }

  const handleRegisterStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const cleanUser = username.trim();
    const cleanName = fullName.trim();
    
    if (!cleanUser || !cleanName || !password) { setLoginError('Preencha todos os campos.'); return; }
    if (cleanUser.toLowerCase() === 'admin') { setLoginError('Nome de usuário inválido.'); return; }

    const exists = players.some(p => p.username.toLowerCase() === cleanUser.toLowerCase());
    if (exists) { setLoginError('Usuário já existe. Tente outro.'); return; }
    if (password.length < 4) { setLoginError('A senha deve ter no mínimo 4 caracteres.'); return; }

    setIsLoggedIn(true); 
  };

  const handleAvatarCreated = async (avatarUrl: string) => {
    setIsSavingUser(true);
    try {
        await registerPlayer(username, avatarUrl, password, fullName);
        const tempPlayer: Player = { 
            username, fullName, avatarUrl, position: 1, completedDays: [], attempts: {}, imageSubmissions: [], lastActive: '', hasSeenIntro: false 
        };
        setCurrentPlayer(tempPlayer);
        setShowIntro(true);
    } catch (error) {
        console.error("Registration Error", error);
        alert("Erro ao salvar no banco de dados.");
        setIsLoggedIn(false); 
    } finally {
        setIsSavingUser(false);
    }
  };

  const handleCloseIntro = () => {
      if (currentPlayer) {
          gameService.markIntroSeen(currentPlayer.username);
          setShowIntro(false);
      }
  };

  // Set active riddle when user wants to play
  const startChallenge = () => {
      if (!todaysRiddle) return;
      setActiveRiddle(todaysRiddle);
      setShowRiddle(true);
  }

  const handleTestRiddle = (day: number) => {
      let targetRiddle = riddles.find(r => r.day === day);
      if (!targetRiddle) {
          targetRiddle = {
              day, date: '2025-01-01', type: 'TEXT', question: `(TEST MODE) No riddle for Day ${day}.`,
              answerKeywords: ['test'], points: 3, timeLimit: 0, options: [], connectionGroups: []
          };
      }
      setActiveRiddle(targetRiddle);
      setShowRiddle(true);
  };

  const handleRiddleCorrect = async (customPoints?: number) => {
    if (!currentPlayer || !activeRiddle) return;
    
    setShowRiddle(false);

    try {
        const freshPlayer = players.find(p => p.username === currentPlayer.username);
        if (!freshPlayer) {
            alert("Erro: Jogador não encontrado para salvar progresso.");
            return;
        }

        // Safety check
        if (!isTestUser && getAttempt(freshPlayer, activeRiddle.day)) {
            return;
        }
        
        // OPTIMISTIC UPDATE: Update Ref immediately
        const winAttempt: Attempt = { status: 'WIN', timestamp: new Date().toISOString() };
        optimisticAttemptsRef.current[activeRiddle.day] = winAttempt;

        // Force local state update immediately to update UI
        setCurrentPlayer(prev => prev ? ({
            ...prev,
            attempts: { ...prev.attempts, [activeRiddle.day]: winAttempt }
        }) : null);

        const pointsRaw = customPoints !== undefined ? customPoints : Number(activeRiddle.points);
        const points = isNaN(pointsRaw) ? 0 : pointsRaw;
        const newPosition = (freshPlayer.position || 0) + points;
        
        await gameService.logGameEvent(freshPlayer.username, activeRiddle.day, 'WIN', `Venceu e avançou ${points} casas.`);
        await gameService.updatePlayerPosition(freshPlayer.username, newPosition, boardLayout);
        
        if (!isTestUser) {
            await gameService.registerAttempt(freshPlayer.username, activeRiddle.day, 'WIN');
        }

        setTimeout(() => {
            processTileEffect(newPosition);
        }, 1000);

    } catch (error) {
        console.error("Error saving game progress:", error);
        alert("Erro ao salvar progresso! Tente novamente.");
    }
  };

  const handleRiddleFailure = async () => {
      if (!currentPlayer || !activeRiddle) return;
      
      // OPTIMISTIC UPDATE
      const lossAttempt: Attempt = { status: 'LOSS', timestamp: new Date().toISOString() };
      optimisticAttemptsRef.current[activeRiddle.day] = lossAttempt;

      setCurrentPlayer(prev => prev ? ({
            ...prev,
            attempts: { ...prev.attempts, [activeRiddle.day]: lossAttempt }
      }) : null);
      
      await gameService.logGameEvent(currentPlayer.username, activeRiddle.day, 'LOSS', 'Falhou ou Desistiu.');
      
      // Mark as played (LOSS)
      if (!isTestUser) {
          await gameService.registerAttempt(currentPlayer.username, activeRiddle.day, 'LOSS');
      }
  }

  const handleImageChallengeSubmit = (imageUrl: string) => {
      if (!currentPlayer || !activeRiddle) return;
      setShowRiddle(false);
      
      // OPTIMISTIC
      const pendingAttempt: Attempt = { status: 'PENDING', timestamp: new Date().toISOString() };
      optimisticAttemptsRef.current[activeRiddle.day] = pendingAttempt;
      setCurrentPlayer(prev => prev ? ({ ...prev, attempts: { ...prev.attempts, [activeRiddle.day]: pendingAttempt } }) : null);

      gameService.submitImage(currentPlayer.username, activeRiddle.day, imageUrl, currentPlayer.imageSubmissions);
      gameService.logGameEvent(currentPlayer.username, activeRiddle.day, 'IMAGE_SUBMIT', 'Enviou foto.');
  };

  // --- TILE LOGIC ---

  const processTileEffect = async (position: number) => {
      if (!currentPlayer) return;
      
      const tileIndex = position - 1;
      if (tileIndex < 0 || tileIndex >= boardLayout.length) return;
      
      const tile = boardLayout[tileIndex];
      const player = currentPlayer.username;

      if (tile.type === TileType.FORWARD_1) {
          alert("🚀 CASA ESPECIAL: Você ganhou um turbo! Avançando +1 casa.");
          const newPos = position + 1;
          await gameService.updatePlayerPosition(player, newPos, boardLayout);
          await gameService.logGameEvent(player, 0, 'AUTO_FORWARD', 'Caiu na casa de Avanço Automatico');
      } 
      else if (tile.type === TileType.BACK_1) {
          alert("🔻 CASA ESPECIAL: Ops! Escorregou... Voltando -1 casa.");
          const newPos = Math.max(1, position - 1);
          await gameService.updatePlayerPosition(player, newPos, boardLayout);
          await gameService.logGameEvent(player, 0, 'AUTO_BACK', 'Caiu na casa de Recuo Automatico');
      }
      else if (tile.type === TileType.CHOOSE_FORWARD) {
          setInteractionType('BOOST');
      }
      else if (tile.type === TileType.CHOOSE_BACK) {
          setInteractionType('TRAP');
      }
      else if (tile.type === TileType.EXTRA_CHALLENGE) {
          setActiveRiddle({...EXTRA_RIDDLE, type: 'TEXT', day: 99});
          setTimeout(() => setShowRiddle(true), 500);
      }
  };

  const handlePlayerInteraction = async (targetUsername: string) => {
      if (!currentPlayer || !interactionType) return;
      
      const target = players.find(p => p.username === targetUsername);
      if (target) {
          const isBoost = interactionType === 'BOOST';
          const shift = isBoost ? 1 : -1;
          const newPos = Math.max(1, target.position + shift);

          await gameService.updatePlayerPosition(targetUsername, newPos, boardLayout);
          
          const actionType = isBoost ? 'BOOST' : 'TRAP';
          const desc = isBoost ? 'Escolheu avançar amigo' : 'Escolheu voltar amigo';
          await gameService.logGameEvent(currentPlayer.username, 0, actionType, desc, targetUsername);

          const msg = isBoost 
              ? `🤝 ${currentPlayer.fullName} te escolheu para AVANÇAR 1 casa! Toca aí!` 
              : `😈 ${currentPlayer.fullName} te escolheu para VOLTAR 1 casa! Que sacanagem!`;
          await gameService.sendNotification(targetUsername, msg);

          alert(`Você ${isBoost ? 'ajudou' : 'atrapalhou'} ${target.fullName}!`);
          setInteractionType(null);
      }
  };

  const handleDismissNotifications = async () => {
      if (currentPlayer) {
          await gameService.clearNotifications(currentPlayer.username);
          setShowNotificationModal(false);
          setNotifications([]);
      }
  };

  const handleShowLogs = async () => {
      setIsLoadingLogs(true);
      try {
        const logs = await gameService.getAllLogs(100);
        setGameLogs(logs);
        setShowLogs(true);
      } catch (e) {
          alert("Erro ao buscar logs.");
      } finally {
          setIsLoadingLogs(false);
      }
  };

  if (loading) {
      return (
          <div className="min-h-screen bg-slate-900 flex items-center justify-center flex-col text-white">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin-slow mb-4"></div>
              <h1 className="font-display text-xl">Loading Vacation...</h1>
          </div>
      )
  }

  if (configError) {
      return (
          <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-xl shadow-xl border border-red-200 max-w-lg text-center">
                  <h2 className="text-2xl font-bold text-red-600 mb-4">Firebase Config Error</h2>
              </div>
          </div>
      )
  }

  if (needsSecuritySetup) {
      return (
          <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
                  <h2 className="text-2xl font-bold text-red-600 mb-4">Security Setup</h2>
                  <form onSubmit={handleSecuritySetup} className="space-y-4">
                      <div><input type="text" value={setupAdminPwd} onChange={e => setSetupAdminPwd(e.target.value)} className="w-full border p-2 rounded" required placeholder="Admin Pwd"/></div>
                      <div><input type="text" value={setupTestPwd} onChange={e => setSetupTestPwd(e.target.value)} className="w-full border p-2 rounded" required placeholder="Test Pwd"/></div>
                      <button disabled={isSavingUser} className="w-full bg-red-600 text-white py-3 rounded font-bold">Save</button>
                  </form>
              </div>
          </div>
      )
  }

  if (isLoggedIn && isAdmin) {
      return <AdminDashboard onLogout={() => { setIsAdmin(false); setIsLoggedIn(false); }} />;
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-display font-bold text-center text-gray-800 mb-2">Vacation Game</h1>
          <p className="text-center text-gray-500 mb-8 tracking-widest uppercase text-xs">USA Version</p>
          
          {!isRegistering ? (
            <form onSubmit={handleLogin} className="space-y-4">
                <div><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none" placeholder="Username" required /></div>
                <div><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none" placeholder="Password" required /></div>
                {loginError && <p className="text-red-500 text-sm font-bold text-center">{loginError}</p>}
                <button type="submit" disabled={isSavingUser} className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition disabled:bg-gray-400">{isSavingUser ? '...' : 'Entrar'}</button>
                <div className="pt-4 border-t border-gray-100 text-center"><button type="button" onClick={() => { setIsRegistering(true); setLoginError(''); }} className="text-purple-600 font-bold hover:underline">Criar Conta</button></div>
            </form>
          ) : (
            <form onSubmit={handleRegisterStep1} className="space-y-4 animate-fade-in">
                <div><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none" placeholder="Full Name" required /></div>
                <div><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none" placeholder="Username" required /></div>
                <div><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none" placeholder="Password" required /></div>
                {loginError && <p className="text-red-500 text-sm font-bold text-center">{loginError}</p>}
                <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-lg font-bold">Next</button>
                <div className="pt-2 text-center"><button type="button" onClick={() => setIsRegistering(false)} className="text-gray-400 text-sm">Cancel</button></div>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (isLoggedIn && !currentPlayer) {
    return <div className="min-h-screen bg-gray-100 py-12 px-4"><AvatarCreator onComplete={handleAvatarCreated} /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center space-x-3">
                <img src={currentPlayer?.avatarUrl} alt="Me" className="w-10 h-10 rounded-full border border-gray-300" />
                <div>
                    <h1 className="font-bold text-gray-800 leading-none">{currentPlayer?.username}</h1>
                    <span className="text-xs text-gray-500">Casa #{currentPlayer?.position}</span>
                </div>
            </div>
            <div className="text-center hidden md:block">
                <h2 className="font-display font-bold text-purple-700 text-xl">Vacation Game</h2>
                <span className="text-xs text-gray-400">{todayString}</span>
            </div>
            <button onClick={() => { setIsLoggedIn(false); setCurrentPlayer(null); setUsername(''); setPassword(''); }} className="text-sm text-red-500 font-semibold">Sair</button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 space-y-6 relative">
        {isTestUser && (
            <div className="bg-slate-800 text-white p-4 rounded-lg shadow-xl mb-6 border border-yellow-500">
                <h3 className="font-bold text-yellow-400 mb-2">🕵️ Test User Panel</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-slate-700 p-2 rounded flex gap-1 flex-wrap">
                        {[1,2,3,4,5,6,7,8,9,10].map(d => <button key={d} onClick={() => handleTestRiddle(d)} className="px-2 py-1 bg-blue-600 rounded text-xs font-bold">{d}</button>)}
                    </div>
                    <div className="bg-slate-700 p-2 rounded flex gap-2">
                        <input type="number" value={testTeleportPos} onChange={e => setTestTeleportPos(e.target.value)} className="w-16 text-black px-1 rounded"/>
                        <button onClick={async () => { await gameService.updatePlayerPosition('teste', parseInt(testTeleportPos), boardLayout); processTileEffect(parseInt(testTeleportPos)); }} className="bg-green-600 px-2 py-1 rounded font-bold">Teleport</button>
                    </div>
                    <div className="bg-slate-700 p-2 rounded">
                        <button onClick={() => gameService.resetPlayerSpecific('teste')} className="w-full bg-red-600 py-2 rounded font-bold">Reset Me</button>
                    </div>
                </div>
            </div>
        )}

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
                <h3 className="text-lg font-bold text-gray-800">
                    {todaysRiddle ? `Desafio do Dia (Day #${todaysRiddle.day})` : 'Descanso'}
                </h3>
                <p className="text-gray-600 text-sm">
                    {todaysRiddle 
                        ? hasAttemptedToday && !isTestUser
                            ? attemptStatus === 'WIN' 
                                ? "Você já completou o desafio de hoje!" 
                                : attemptStatus === 'PENDING' ? "Seu envio está em análise."
                                : "Você jogou hoje (e falhou). Mais sorte amanhã!"
                            : "Um novo desafio está disponível!"
                        : "Nenhum desafio agendado para hoje. Volte amanhã!"
                    }
                </p>
            </div>
            
            <div className="flex gap-2">
                 <button onClick={handleShowLogs} disabled={isLoadingLogs} className="px-4 py-3 rounded-full font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 transition flex items-center gap-2">
                    {isLoadingLogs ? '...' : '📜 Histórico'} 
                 </button>

                 {/* MAIN ACTION BUTTON */}
                 {todaysRiddle && (!hasAttemptedToday || isTestUser) ? (
                    <button onClick={startChallenge} className="px-6 py-3 rounded-full font-bold shadow-lg bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:shadow-orange-500/30 animate-pulse transition-transform active:scale-95">
                        Start Challenge #{todaysRiddle.day} ⚔️
                    </button>
                 ) : (
                    <div className={`px-6 py-3 rounded-full font-bold border flex items-center gap-2 ${
                        !todaysRiddle ? 'bg-gray-100 text-gray-400 border-gray-200' :
                        attemptStatus === 'WIN' ? 'bg-green-100 text-green-700 border-green-200' : 
                        attemptStatus === 'PENDING' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        'bg-red-100 text-red-700 border-red-200'
                    }`}>
                        {!todaysRiddle ? 'Sem Desafio' : 
                          attemptStatus === 'WIN' ? '✅ Concluído' : 
                          attemptStatus === 'PENDING' ? '⏳ Em Análise' :
                          '❌ Você jogou hoje'}
                    </div>
                 )}
            </div>
        </div>

        <GameBoard players={players} currentUser={currentPlayer!.username} layout={boardLayout} />

        <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-display font-bold text-gray-800 mb-4">Status do Time</h3>
            <div className="space-y-3">
                {players.map(p => {
                    // Check if player played today's riddle
                    const pAttempt = todaysRiddle ? getAttempt(p, todaysRiddle.day) : undefined;
                    return (
                        <div key={p.username} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                                <img src={p.avatarUrl} className="w-8 h-8 rounded-full grayscale-[0.2]" alt={p.username} />
                                <div className="flex flex-col">
                                    <span className="font-medium text-gray-700 leading-tight">{p.fullName}</span>
                                    <span className="text-xs text-gray-400">@{p.username}</span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-4">
                                <span className="text-xs text-gray-500">Pos: {p.position}</span>
                                {todaysRiddle && (
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        !pAttempt ? 'bg-gray-200 text-gray-500' :
                                        pAttempt.status === 'WIN' ? 'bg-green-100 text-green-700' : 
                                        pAttempt.status === 'PENDING' ? 'bg-blue-100 text-blue-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                        {pAttempt ? (
                                            pAttempt.status === 'WIN' ? 'Venceu' : 
                                            pAttempt.status === 'PENDING' ? 'Pendente' : 
                                            'Perdeu'
                                        ) : 'Pendente'}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </main>

      {showRiddle && activeRiddle && (
          <RiddleModal 
            key={activeRiddle.day} 
            riddle={activeRiddle} 
            username={currentPlayer?.username || 'Guest'}
            dateString={todayString}
            userAvatar={currentPlayer?.avatarUrl}
            onCorrect={handleRiddleCorrect} 
            onFailure={handleRiddleFailure}
            onImageSubmit={handleImageChallengeSubmit} 
            onClose={() => setShowRiddle(false)} 
          />
      )}
      
      {showIntro && <IntroModal onClose={handleCloseIntro} />}
      
      {showNotificationModal && notifications.length > 0 && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-bounce-small text-center">
                  <div className="text-4xl mb-2">🔔</div>
                  <h3 className="text-xl font-bold mb-4">Novas Notificações</h3>
                  <div className="space-y-3 mb-6">
                      {notifications.map((n, i) => <div key={i} className="bg-blue-50 p-3 rounded-lg text-sm text-blue-900 border border-blue-200">{n.message}</div>)}
                  </div>
                  <button onClick={handleDismissNotifications} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold">Marcar como Lidas</button>
              </div>
          </div>
      )}

      {showLogs && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-lg w-full h-[70vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold">Histórico do Jogo</h3>
                      <button onClick={() => setShowLogs(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                      {gameLogs.map((log, i) => (
                            <div key={i} className="p-3 rounded border border-gray-100 bg-gray-50 text-sm">
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                                </div>
                                <div><span className="font-bold">{log.username}</span>: {log.details}</div>
                            </div>
                        ))
                      }
                  </div>
              </div>
          </div>
      )}

      {interactionType && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
                <h3 className="text-xl font-bold text-center mb-4">{interactionType === 'BOOST' ? '🚀 Ajude um amigo!' : '😈 Atrase um amigo!'}</h3>
                <div className="grid grid-cols-2 gap-2">
                    {players.filter(p => p.username !== currentPlayer!.username).map(p => (
                        <button key={p.username} onClick={() => handlePlayerInteraction(p.username)} className="p-2 bg-gray-100 hover:bg-indigo-50 rounded-lg flex flex-col items-center border hover:border-indigo-300">
                            <img src={p.avatarUrl} className="w-10 h-10 rounded-full mb-1 object-cover" alt={p.username}/>
                            <span className="text-xs font-bold text-gray-700">{p.fullName}</span>
                        </button>
                    ))}
                </div>
                <button onClick={() => setInteractionType(null)} className="w-full mt-4 text-gray-400 text-sm">Cancelar</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;