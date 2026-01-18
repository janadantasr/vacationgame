

import React, { useState, useEffect } from 'react';
import { Riddle, TileType, Player, RiddleType, Tile, RiddleLibraryItem, ConnectionGroup, Settings, SubQuestion, ADEDONHA_CATEGORIES, AdedonhaSubmission } from '../types';
import { gameService } from '../services/gameService';

interface Props {
    onLogout: () => void;
}

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const maxWidth = 200; 
                const scaleSize = maxWidth / img.width;
                const width = maxWidth;
                const height = img.height * scaleSize;
                if (!ctx) { resolve(img.src); return; }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
};

interface RiddleEditorProps {
    riddle: Partial<Riddle>;
    onChange: (field: keyof Riddle, value: any) => void;
    uniqueId: string; 
}

const RiddleEditor: React.FC<RiddleEditorProps> = ({ riddle, onChange, uniqueId }) => {
    const handleTypeChange = (newType: string) => {
        onChange('type', newType);
        // Defaults...
        if (newType === 'CONNECTIONS') {
            // FIX: Create NEW objects for each item in array to avoid shared reference bugs
            const newGroups = [
                { title: '', items: ['', '', '', ''] },
                { title: '', items: ['', '', '', ''] },
                { title: '', items: ['', '', '', ''] },
                { title: '', items: ['', '', '', ''] }
            ];
            onChange('connectionGroups', newGroups);
        } else if (newType === 'MULTIPLE_CHOICE') {
            if (!riddle.subQuestions || riddle.subQuestions.length === 0) {
                 const defaultSubQs: SubQuestion[] = [
                    { question: '', options: ['', '', '', ''], correctAnswerIndex: 0 },
                    { question: '', options: ['', '', '', ''], correctAnswerIndex: 0 },
                    { question: '', options: ['', '', '', ''], correctAnswerIndex: 0 }
                ];
                onChange('subQuestions', defaultSubQs);
                onChange('points', 3);
            }
        } else if (newType === 'ADEDONHA') {
            onChange('timeLimit', 120);
            onChange('points', 0); // Dynamic
        }
    };

    const handleMemoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files) as File[];
            const compressedPromises = files.map(file => compressImage(file));
            const compressedImages = await Promise.all(compressedPromises);
            onChange('memoryImages', [...(riddle.memoryImages || []), ...compressedImages]);
        }
    };

    // Sub-component for editing the 3-question array
    const renderMultipleChoiceEditor = () => {
        const subQuestions = riddle.subQuestions || [];
        
        if (subQuestions.length === 0) {
            return (
                <div className="bg-red-900/20 border border-red-500 p-4 rounded text-center">
                    <p className="text-red-400 mb-2">Quiz configuration missing.</p>
                    <button 
                        onClick={() => {
                            const defaultSubQs: SubQuestion[] = [
                                { question: 'Nova Pergunta', options: ['Opção 1', 'Opção 2', 'Opção 3', 'Opção 4'], correctAnswerIndex: 0 },
                                { question: 'Nova Pergunta', options: ['Opção 1', 'Opção 2', 'Opção 3', 'Opção 4'], correctAnswerIndex: 0 },
                                { question: 'Nova Pergunta', options: ['Opção 1', 'Opção 2', 'Opção 3', 'Opção 4'], correctAnswerIndex: 0 }
                            ];
                            onChange('subQuestions', defaultSubQs);
                            onChange('points', 3);
                        }}
                        className="bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-500"
                    >
                        Initialize 3 Questions
                    </button>
                </div>
            )
        }

        const updateSubQ = (index: number, field: keyof SubQuestion, value: any) => {
            const updated = [...subQuestions];
            updated[index] = { ...updated[index], [field]: value };
            onChange('subQuestions', updated);
        };

        const updateOption = (qIndex: number, optIndex: number, val: string) => {
            const updated = [...subQuestions];
            const newOpts = [...updated[qIndex].options];
            newOpts[optIndex] = val;
            updated[qIndex] = { ...updated[qIndex], options: newOpts };
            onChange('subQuestions', updated);
        };

        return (
            <div className="space-y-4 mt-4 bg-slate-800 p-4 rounded-xl border border-slate-600">
                <div className="flex justify-between items-center border-b border-slate-600 pb-2 mb-4">
                    <p className="text-yellow-400 text-sm font-bold uppercase tracking-wider">Quiz Mode: 3 Sequential Questions</p>
                    <span className="text-xs text-gray-400">Total Points: {subQuestions.length} (Dynamic)</span>
                </div>
                
                {subQuestions.map((sq, i) => (
                    <div key={i} className="bg-slate-900 p-4 rounded-lg border border-slate-700 shadow-sm">
                        <div className="flex justify-between mb-2">
                            <span className="text-xs font-bold text-blue-400 uppercase">Question {i + 1}</span>
                        </div>
                        <div className="mb-3">
                            <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Enunciado</label>
                            <input 
                                type="text" 
                                value={sq.question} 
                                onChange={(e) => updateSubQ(i, 'question', e.target.value)}
                                className="w-full bg-slate-800 p-2 rounded text-white border border-slate-600 focus:border-blue-500 outline-none transition-colors"
                                placeholder="Ex: Qual a capital da França?"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Opções (Marque a correta)</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {sq.options.map((opt, optIdx) => (
                                    <div key={optIdx} className={`flex items-center gap-2 p-2 rounded border ${sq.correctAnswerIndex === optIdx ? 'bg-green-900/30 border-green-500' : 'bg-slate-800 border-slate-600'}`}>
                                        <input 
                                            type="radio" 
                                            name={`correct-${uniqueId}-${i}`}
                                            checked={sq.correctAnswerIndex === optIdx}
                                            onChange={() => updateSubQ(i, 'correctAnswerIndex', optIdx)}
                                            className="w-4 h-4 text-green-500 focus:ring-green-500 cursor-pointer"
                                            title="Mark as correct answer"
                                        />
                                        <input 
                                            type="text" 
                                            value={opt}
                                            onChange={(e) => updateOption(i, optIdx, e.target.value)}
                                            className="w-full bg-transparent p-1 text-sm text-gray-300 border-none focus:ring-0 outline-none"
                                            placeholder={`Option ${optIdx + 1}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-xs text-gray-400 mb-1">Type</label>
                      <select value={riddle.type} onChange={(e) => handleTypeChange(e.target.value)} className="w-full bg-slate-900 rounded text-white p-2 border border-slate-600">
                          <option value="TEXT">Text Riddle</option>
                          <option value="CONNECTIONS">Connections</option>
                          <option value="ADEDONHA">Adedonha (Stop)</option>
                          <option value="MULTIPLE_CHOICE">Multiple Choice (3 Questions)</option>
                          <option value="MEMORY">Memory Game</option>
                          <option value="IMAGE">Image Upload</option>
                          <option value="SCAVENGER">Scavenger Hunt</option>
                          <option value="TIMED">Timed Question</option>
                          <option value="TERMO">Termo</option>
                          <option value="FLAPPY">Flappy Bird</option>
                          <option value="SCRAMBLED">Scramble</option>
                          <option value="PONG">Pong</option>
                          <option value="PLATFORMER">Platformer</option>
                      </select>
                  </div>
                  <div>
                       <label className="block text-xs text-yellow-400 font-bold mb-1">Points</label>
                       {(riddle.type === 'MULTIPLE_CHOICE' || riddle.type === 'ADEDONHA') ? (
                           <div className="w-full bg-slate-800 p-2 rounded text-gray-500 border border-slate-700 italic">Dynamic (Based on Performance)</div>
                       ) : (
                           <input type="number" value={riddle.points} onChange={(e) => onChange('points', parseInt(e.target.value) || 0)} className="w-full bg-slate-800 p-2 rounded text-white border-2 border-yellow-500/50" />
                       )}
                  </div>
              </div>
              
              <div>
                   <label className="block text-xs text-green-400 font-bold mb-1">Release Date (YYYY-MM-DD)</label>
                   <input type="date" value={riddle.date || ''} onChange={(e) => onChange('date', e.target.value)} className="w-full bg-slate-900 text-white p-2 rounded border border-green-600" />
              </div>

              {riddle.type !== 'MULTIPLE_CHOICE' && riddle.type !== 'ADEDONHA' && (
                  <div>
                      <label className="block text-xs text-gray-400 mb-1">Question / Prompt</label>
                      <textarea value={riddle.question} onChange={(e) => onChange('question', e.target.value)} className="w-full bg-slate-900 border border-slate-600 p-3 rounded h-20 text-white" />
                  </div>
              )}

              {/* ADEDONHA EDITOR */}
              {riddle.type === 'ADEDONHA' && (
                  <div className="grid grid-cols-2 gap-4 bg-slate-800 p-4 rounded border border-slate-600">
                      <div>
                          <label className="block text-xs text-green-400 font-bold mb-1">Letra da Rodada</label>
                          <input 
                              type="text" 
                              maxLength={1} 
                              value={riddle.letter || ''} 
                              onChange={(e) => onChange('letter', e.target.value.toUpperCase())} 
                              className="w-full bg-slate-900 p-2 rounded text-white border border-green-600 font-bold text-center text-xl uppercase" 
                          />
                      </div>
                      <div>
                          <label className="block text-xs text-gray-400 mb-1">Tempo (Segundos)</label>
                          <input 
                              type="number" 
                              value={riddle.timeLimit || 120} 
                              onChange={(e) => onChange('timeLimit', parseInt(e.target.value))} 
                              className="w-full bg-slate-900 p-2 rounded text-white" 
                          />
                      </div>
                      <div className="col-span-2">
                          <p className="text-xs text-gray-500 mt-2">
                              Categorias Fixas: {ADEDONHA_CATEGORIES.join(', ')}
                          </p>
                      </div>
                  </div>
              )}

              {riddle.type === 'MULTIPLE_CHOICE' && renderMultipleChoiceEditor()}

              {(riddle.type === 'TEXT' || riddle.type === 'TIMED') && (
                  <div>
                       <label className="block text-xs text-gray-400 mb-1">Correct Keywords</label>
                       <input type="text" value={riddle.answerKeywords?.join(', ') || ''} onChange={(e) => onChange('answerKeywords', e.target.value.split(',').map(s => s.trim()))} className="w-full bg-slate-900 p-2 rounded text-white border border-slate-600" />
                  </div>
              )}

              {riddle.type === 'CONNECTIONS' && (
                  <div className="space-y-2">
                       {riddle.connectionGroups?.map((group, i) => (
                           <div key={i} className="bg-slate-800 p-2 rounded border border-slate-600">
                               <input type="text" placeholder="Group Title" value={group.title} onChange={(e) => {
                                   const newGroups = [...(riddle.connectionGroups || [])];
                                   newGroups[i] = { ...newGroups[i], title: e.target.value };
                                   onChange('connectionGroups', newGroups);
                               }} className="w-full bg-transparent border-b border-slate-500 mb-2 font-bold" />
                               <div className="grid grid-cols-4 gap-2">
                                   {group.items.map((item, itemIdx) => (
                                       <input key={itemIdx} type="text" value={item} onChange={(e) => {
                                           const newGroups = [...(riddle.connectionGroups || [])];
                                           const newItems = [...newGroups[i].items];
                                           newItems[itemIdx] = e.target.value;
                                           newGroups[i] = { ...newGroups[i], items: newItems };
                                           onChange('connectionGroups', newGroups);
                                       }} className="bg-slate-900 p-1 rounded text-xs" />
                                   ))}
                               </div>
                           </div>
                       ))}
                       <div>
                           <label className="block text-xs text-gray-400 mb-1">Lives</label>
                           <input type="number" value={riddle.connectionsLives || 4} onChange={(e) => onChange('connectionsLives', parseInt(e.target.value))} className="w-20 bg-slate-900 p-2 rounded text-white"/>
                       </div>
                  </div>
              )}

              {riddle.type === 'TERMO' && (
                  <div>
                       <label className="block text-xs text-gray-400 mb-1">Target Word (5 Letters)</label>
                       <input type="text" maxLength={5} value={riddle.wordleTarget || ''} onChange={(e) => onChange('wordleTarget', e.target.value.toUpperCase())} className="w-full bg-slate-900 p-2 rounded text-white border border-slate-600 uppercase font-mono tracking-widest" />
                  </div>
              )}
              
              {riddle.type === 'SCRAMBLED' && (
                  <div>
                       <label className="block text-xs text-gray-400 mb-1">Word to Unscramble</label>
                       <input type="text" value={riddle.scrambledWord || ''} onChange={(e) => onChange('scrambledWord', e.target.value.toUpperCase())} className="w-full bg-slate-900 p-2 rounded text-white border border-slate-600" />
                  </div>
              )}

              {riddle.type === 'MEMORY' && (
                  <div>
                      <div className="mb-4">
                           <label className="block text-xs text-green-400 font-bold mb-1">Time Limit (Seconds)</label>
                           <input 
                               type="number" 
                               value={riddle.timeLimit || 120} 
                               onChange={(e) => onChange('timeLimit', parseInt(e.target.value))} 
                               className="w-full bg-slate-900 p-2 rounded text-white border border-slate-600" 
                               placeholder="120"
                           />
                      </div>

                      <label className="block text-xs text-gray-400 mb-1">Upload Images (Pairs generated automatically)</label>
                      <input type="file" multiple accept="image/*" onChange={handleMemoryImageUpload} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-violet-50 file:text-violet-700"/>
                      <div className="flex gap-2 mt-2 flex-wrap">
                          {riddle.memoryImages?.map((img, i) => (
                              <img key={i} src={img} className="w-10 h-10 object-cover rounded border" />
                          ))}
                      </div>
                      <button onClick={() => onChange('memoryImages', [])} className="text-xs text-red-400 mt-2">Clear Images</button>
                  </div>
              )}

              {riddle.type === 'SCAVENGER' && (
                  <div>
                      <label className="block text-xs text-gray-400 mb-1">Item to Find</label>
                      <input type="text" value={riddle.scavengerItem || ''} onChange={(e) => onChange('scavengerItem', e.target.value)} className="w-full bg-slate-900 p-2 rounded text-white" />
                  </div>
              )}

              {riddle.type === 'FLAPPY' && (
                  <div className="grid grid-cols-2 gap-2">
                       <div>
                           <label className="block text-xs text-gray-400">Score to Win</label>
                           <input type="number" value={riddle.flappyThreshold || 10} onChange={(e) => onChange('flappyThreshold', parseInt(e.target.value))} className="w-full bg-slate-900 p-2 rounded text-white"/>
                       </div>
                       <div>
                           <label className="block text-xs text-gray-400">Lives</label>
                           <input type="number" value={riddle.flappyLives || 2} onChange={(e) => onChange('flappyLives', parseInt(e.target.value))} className="w-full bg-slate-900 p-2 rounded text-white"/>
                       </div>
                  </div>
              )}

              {riddle.type === 'PONG' && (
                  <div className="grid grid-cols-3 gap-2">
                       <div>
                           <label className="block text-xs text-gray-400">Score to Win</label>
                           <input type="number" value={riddle.pongScoreThreshold || 5} onChange={(e) => onChange('pongScoreThreshold', parseInt(e.target.value))} className="w-full bg-slate-900 p-2 rounded text-white"/>
                       </div>
                       <div>
                           <label className="block text-xs text-gray-400">Speed</label>
                           <select value={riddle.pongSpeed || 'MEDIUM'} onChange={(e) => onChange('pongSpeed', e.target.value)} className="w-full bg-slate-900 p-2 rounded text-white">
                               <option value="SLOW">Slow</option>
                               <option value="MEDIUM">Medium</option>
                               <option value="FAST">Fast</option>
                           </select>
                       </div>
                       <div>
                           <label className="block text-xs text-gray-400">Lives</label>
                           <input type="number" value={riddle.pongLives || 3} onChange={(e) => onChange('pongLives', parseInt(e.target.value))} className="w-full bg-slate-900 p-2 rounded text-white"/>
                       </div>
                  </div>
              )}

              {riddle.type === 'PLATFORMER' && (
                  <div>
                       <label className="block text-xs text-gray-400">Lives</label>
                       <input type="number" value={riddle.platformerLives || 3} onChange={(e) => onChange('platformerLives', parseInt(e.target.value))} className="w-full bg-slate-900 p-2 rounded text-white"/>
                  </div>
              )}
        </div>
    )
}

export const AdminDashboard: React.FC<Props> = ({ onLogout }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  const [riddles, setRiddles] = useState<Riddle[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [boardLayout, setBoardLayout] = useState<Tile[]>([]);
  const [library, setLibrary] = useState<RiddleLibraryItem[]>([]);
  
  const [activeTab, setActiveTab] = useState<'RIDDLES' | 'BOARD_TEST' | 'APPROVALS' | 'DB' | 'ADEDONHA'>('RIDDLES');
  const [saveStatus, setSaveStatus] = useState('');
  
  const [processedSubmissions, setProcessedSubmissions] = useState<Record<string, 'APPROVED' | 'REJECTED'>>({});
  const [adedonhaSubs, setAdedonhaSubs] = useState<AdedonhaSubmission[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
        const unsubRiddles = gameService.subscribeToRiddles(async (publicData) => {
             const merged = await Promise.all(publicData.map(async (r) => {
                const secret = await gameService.getAnswerForAdmin(`day_${r.day}`);
                let finalRiddle = { ...r, ...secret };
                if (finalRiddle.type === 'MULTIPLE_CHOICE' && finalRiddle.subQuestions && secret.subQuestionAnswers) {
                     finalRiddle.subQuestions = finalRiddle.subQuestions.map((sq: any, i: number) => ({
                         ...sq,
                         correctAnswerIndex: secret.subQuestionAnswers[i] ?? 0
                     }));
                }
                return finalRiddle;
            }));
            setRiddles(merged);
        });
        const unsubPlayers = gameService.subscribeToPlayers(setPlayers);
        const unsubBoard = gameService.subscribeToBoard(setBoardLayout);
        const unsubAdedonha = gameService.subscribeToAdedonhaSubmissions(setAdedonhaSubs);

        return () => { unsubRiddles(); unsubPlayers(); unsubBoard(); unsubAdedonha(); }
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      const isValid = await gameService.verifyCredentials('admin', password);
      if (isValid) setIsAuthenticated(true);
      else alert('Invalid Admin Credentials.');
  }

  const handleSaveSchedule = async () => {
    setSaveStatus('Saving...');
    try {
        await gameService.saveRiddles(riddles);
        setSaveStatus('Saved!');
        setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
        setSaveStatus('Error!');
    }
  };

  const handleSaveBoard = async () => {
      setSaveStatus('Saving Board...');
      try {
          await gameService.saveBoardLayout(boardLayout);
          setSaveStatus('Board Saved!');
          setTimeout(() => setSaveStatus(''), 2000);
      } catch (error) {
          setSaveStatus('Error!');
      }
  };

  const handleAddDay = () => {
      const lastDay = riddles.length > 0 ? riddles[riddles.length - 1].day : 0;
      const newRiddle: Riddle = {
          day: lastDay + 1, date: '', type: 'TEXT', question: 'New Question', points: 1, answerKeywords: [],
      };
      setRiddles(prev => [...prev, newRiddle]);
  };
  
  const handleScheduleChange = (index: number, field: keyof Riddle, value: any) => {
      setRiddles(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], [field]: value };
          return updated;
      });
  };

  const updateTile = (index: number, type: TileType) => {
      const updated = [...boardLayout];
      updated[index] = { ...updated[index], type };
      setBoardLayout(updated);
  };

  const awardPlayer = async (username: string, points: number) => {
      const p = players.find(p => p.username === username);
      if (p) await gameService.updatePlayerPosition(username, p.position + points, boardLayout);
  }
  
  const handleApprovalAction = async (username: string, day: number, action: 'APPROVED' | 'REJECTED') => {
      const key = `${username}-${day}`;
      if (processedSubmissions[key]) return;
      if (action === 'APPROVED') await awardPlayer(username, 1);
      setProcessedSubmissions(prev => ({...prev, [key]: action}));
  };

  const handleDeletePlayer = async (username: string) => { if (confirm("Delete?")) await gameService.deletePlayer(username); }

  const handleResetGame = async (hardReset: boolean) => {
      if (hardReset) {
          const confirm1 = confirm("⚠️ ATENÇÃO: Isso vai APAGAR TODOS os jogadores (exceto Admin/Teste), histórico e logs.");
          if (!confirm1) return;
          const confirm2 = confirm("Tem certeza absoluta? Os jogadores precisarão criar conta novamente.");
          if (!confirm2) return;
      } else {
          const confirm1 = confirm("⚠️ Isso vai ZERAR as pontuações e o histórico de todos os jogadores, mas MANTERÁ as contas.");
          if (!confirm1) return;
      }
      
      await gameService.resetGameContentOnly(hardReset);
      alert(hardReset ? "Jogo resetado! Contas apagadas." : "Nova rodada iniciada! Pontuações zeradas.");
  };

  // ADEDONHA VALIDATION HANDLERS
  const handleAdedonhaValidateItem = async (username: string, day: number, category: string, status: 'APPROVED' | 'REJECTED') => {
      await gameService.validateAdedonhaItem(username, day, category, status);
  };
  const handleAdedonhaFinish = async (username: string, day: number) => {
      await gameService.calculateAdedonhaScore(username, day);
      alert("Pontuação calculada e enviada!");
  };

  if (!isAuthenticated) {
      return (
          <div className="min-h-screen bg-slate-900 flex items-center justify-center">
              <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-xl shadow-2xl text-white">
                  <h1 className="text-2xl mb-4 text-center">Admin Access</h1>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full p-2 rounded bg-slate-900 border border-slate-600 mb-4"/>
                  <button className="w-full bg-purple-600 py-2 rounded">Enter</button>
              </form>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-slate-800 text-white p-4 md:p-6">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-slate-700 pb-4 gap-4">
        <h1 className="text-3xl font-display font-bold text-yellow-400">🛠️ Admin Dashboard</h1>
        <div className="flex gap-2 flex-wrap justify-center">
            <button onClick={() => setActiveTab('RIDDLES')} className={`px-4 py-2 rounded-lg ${activeTab === 'RIDDLES' ? 'bg-blue-600' : 'bg-slate-700'}`}>Riddles</button>
            <button onClick={() => setActiveTab('ADEDONHA')} className={`px-4 py-2 rounded-lg ${activeTab === 'ADEDONHA' ? 'bg-indigo-600' : 'bg-slate-700'}`}>Adedonha</button>
            <button onClick={() => setActiveTab('BOARD_TEST')} className={`px-4 py-2 rounded-lg ${activeTab === 'BOARD_TEST' ? 'bg-orange-600' : 'bg-slate-700'}`}>Board</button>
            <button onClick={() => setActiveTab('APPROVALS')} className={`px-4 py-2 rounded-lg ${activeTab === 'APPROVALS' ? 'bg-pink-600' : 'bg-slate-700'}`}>Approvals</button>
            <button onClick={() => setActiveTab('DB')} className={`px-4 py-2 rounded-lg ${activeTab === 'DB' ? 'bg-red-600' : 'bg-slate-700'}`}>DB</button>
            <button onClick={onLogout} className="text-slate-400 ml-4">Logout</button>
        </div>
      </header>

      {activeTab === 'RIDDLES' && (
        <div className="max-w-5xl mx-auto pb-20">
            <div className="flex justify-between items-center mb-4 bg-slate-700 p-3 rounded sticky top-0 z-10 shadow-lg">
                 <span className="text-sm text-gray-300">Daily Challenges (ID is fixed, Date controls release)</span>
                 <div className="flex gap-2 items-center">
                     {saveStatus && <span className="text-green-400 font-bold animate-pulse">{saveStatus}</span>}
                     <button onClick={handleSaveSchedule} className="bg-green-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-green-600">💾 Save All</button>
                 </div>
            </div>

            <div className="grid gap-8">
                {riddles.map((riddle, idx) => (
                    <div key={riddle.day} className="bg-slate-700 p-6 rounded-xl border border-slate-600 relative">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-600">
                            <span className="font-bold text-yellow-400 text-lg">Challenge #{riddle.day}</span>
                        </div>
                        <RiddleEditor riddle={riddle} onChange={(field, value) => handleScheduleChange(idx, field, value)} uniqueId={`day-${riddle.day}`} />
                    </div>
                ))}
                <button onClick={handleAddDay} className="w-full py-3 border-2 border-dashed border-slate-600 text-slate-400 rounded-xl hover:border-slate-400 hover:text-white transition-colors">+ Add Next Challenge</button>
            </div>
        </div>
      )}

      {activeTab === 'ADEDONHA' && (
          <div className="max-w-6xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">📝 Adedonha Validations</h2>
              <div className="grid gap-6">
                  {adedonhaSubs.filter(s => s.status === 'PENDING').length === 0 && <p className="text-gray-400">Nenhuma submissão pendente.</p>}
                  
                  {adedonhaSubs.filter(s => s.status === 'PENDING').map(sub => (
                      <div key={`${sub.username}-${sub.day}`} className="bg-slate-700 p-6 rounded-xl border border-slate-600">
                          <div className="flex justify-between mb-4 border-b border-slate-600 pb-2">
                              <div>
                                  <h3 className="text-xl font-bold text-yellow-400">{sub.username}</h3>
                                  <span className="text-sm text-gray-400">Day {sub.day}</span>
                              </div>
                              <button onClick={() => handleAdedonhaFinish(sub.username, sub.day)} className="bg-green-600 px-4 py-2 rounded font-bold hover:bg-green-500">
                                  Concluir & Calcular Pontos
                              </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {Object.entries(sub.answers).map(([category, answer]) => {
                                  const status = sub.validation[category] || 'PENDING';
                                  return (
                                      <div key={category} className={`p-3 rounded border ${status === 'APPROVED' ? 'bg-green-900/40 border-green-600' : status === 'REJECTED' ? 'bg-red-900/40 border-red-600' : 'bg-slate-800 border-slate-500'}`}>
                                          <p className="text-xs text-gray-400 uppercase font-bold mb-1">{category}</p>
                                          <p className="text-lg font-bold text-white mb-3">{answer || '-'}</p>
                                          <div className="flex gap-2">
                                              <button onClick={() => handleAdedonhaValidateItem(sub.username, sub.day, category, 'APPROVED')} className={`flex-1 py-1 rounded text-xs font-bold ${status === 'APPROVED' ? 'bg-green-600 text-white' : 'bg-slate-600 text-gray-300'}`}>
                                                  ✓
                                              </button>
                                              <button onClick={() => handleAdedonhaValidateItem(sub.username, sub.day, category, 'REJECTED')} className={`flex-1 py-1 rounded text-xs font-bold ${status === 'REJECTED' ? 'bg-red-600 text-white' : 'bg-slate-600 text-gray-300'}`}>
                                                  ✗
                                              </button>
                                          </div>
                                      </div>
                                  )
                              })}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'BOARD_TEST' && (
          <div className="max-w-6xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Board Editor</h2>
                  <button onClick={handleSaveBoard} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold">Save Board</button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                  {boardLayout.map((tile, i) => (
                      <div key={tile.id} className="bg-slate-700 p-2 rounded border border-slate-600">
                          <div className="text-xs text-gray-400 mb-1">Tile {tile.id}</div>
                          <select value={tile.type} onChange={(e) => updateTile(i, e.target.value as TileType)} className="w-full bg-slate-900 text-xs p-1 rounded">
                              {Object.keys(TileType).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'APPROVALS' && (
          <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-4">📸 Image Approvals</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {players.flatMap(p => p.imageSubmissions.map(s => ({...s, username: p.username}))).map((sub, idx) => {
                      const status = processedSubmissions[`${sub.username}-${sub.day}`];
                      return (
                          <div key={idx} className={`bg-slate-700 p-4 rounded-xl border border-slate-600 transition-all duration-500 ${status ? 'opacity-40 grayscale' : ''}`}>
                              <img src={sub.imageUrl} alt="Submission" className="w-full h-48 object-contain bg-black rounded mb-2"/>
                              <div className="flex justify-between items-center mb-2">
                                  <div><div className="font-bold">{sub.username}</div><div className="text-xs text-gray-400">Day {sub.day}</div></div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                  {!status ? (
                                      <>
                                        <button onClick={() => handleApprovalAction(sub.username, sub.day, 'APPROVED')} className="bg-green-600 text-white px-3 py-2 rounded text-sm font-bold hover:bg-green-500">✅ Aprovar (+1)</button>
                                        <button onClick={() => handleApprovalAction(sub.username, sub.day, 'REJECTED')} className="bg-red-600 text-white px-3 py-2 rounded text-sm font-bold hover:bg-red-500">❌ Reprovar</button>
                                      </>
                                  ) : (
                                      <div className={`col-span-2 text-center font-bold py-2 rounded ${status === 'APPROVED' ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'}`}>{status === 'APPROVED' ? 'APROVADO' : 'REPROVADO'}</div>
                                  )}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {activeTab === 'DB' && (
          <div className="max-w-6xl mx-auto">
               <h2 className="text-2xl font-bold mb-6">Database</h2>

               {/* DANGER ZONE - RESET */}
               <div className="bg-red-900/30 border border-red-500 p-6 rounded-xl mb-8">
                   <h3 className="text-xl font-bold text-red-400 mb-4">Danger Zone</h3>
                   
                   <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 bg-slate-800 p-4 rounded border border-slate-600">
                             <h4 className="font-bold text-yellow-400 mb-2">Opção 1: Nova Rodada (Soft Reset)</h4>
                             <p className="text-gray-400 text-sm mb-4">
                                 Mantém as contas dos jogadores, mas zera pontuações, posições, histórico e tentativas.
                                 Ideal para reiniciar o jogo com o mesmo grupo.
                             </p>
                             <button 
                                onClick={() => handleResetGame(false)} 
                                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded"
                            >
                                ZERAR PONTOS E HISTÓRICO
                            </button>
                        </div>

                        <div className="flex-1 bg-slate-800 p-4 rounded border border-slate-600">
                             <h4 className="font-bold text-red-400 mb-2">Opção 2: Reset Total (Hard Reset)</h4>
                             <p className="text-gray-400 text-sm mb-4">
                                 Apaga TODOS os jogadores (exceto Admin), histórico e dados.
                                 Todos precisarão criar conta novamente.
                             </p>
                             <button 
                                onClick={() => handleResetGame(true)} 
                                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded"
                            >
                                APAGAR TUDO E TODOS
                            </button>
                        </div>
                   </div>
               </div>

               <div className="bg-slate-700 rounded-xl overflow-hidden mb-8">
                   <div className="overflow-x-auto">
                       <table className="w-full text-sm text-left text-white">
                           <thead className="bg-slate-800"><tr><th className="p-3">User</th><th className="p-3">Pos</th><th className="p-3">Attempts</th><th className="p-3">Last Active</th><th className="p-3 text-right">Action</th></tr></thead>
                           <tbody>
                               {players.map(p => (
                                   <tr key={p.username} className="border-t border-slate-600">
                                       <td className="p-3 font-bold">{p.username}</td>
                                       <td className="p-3">{p.position}</td>
                                       <td className="p-3">{p.attempts ? Object.keys(p.attempts).length : 0}</td>
                                       <td className="p-3">{new Date(p.lastActive).toLocaleDateString()}</td>
                                       <td className="p-3 text-right"><button onClick={() => handleDeletePlayer(p.username)} className="bg-red-600 px-2 py-1 rounded text-xs">Del</button></td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>
          </div>
      )}
    </div>
  );
};