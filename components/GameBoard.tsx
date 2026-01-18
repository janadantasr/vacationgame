import React from 'react';
import { Player, TileType, Tile } from '../types';

interface Props {
  players: Player[];
  currentUser: string;
  layout: Tile[];
}

export const GameBoard: React.FC<Props> = ({ players, currentUser, layout }) => {
  // Filter out 'teste' user unless it's the current user playing
  const visiblePlayers = players.filter(p => p.username !== 'teste' || p.username === currentUser);

  return (
    <div className="relative w-full max-w-4xl mx-auto p-4 overflow-hidden">
      {/* Path Background SVG - Abstract snake path */}
      <div className="grid grid-cols-5 gap-2 md:gap-4">
        {layout.map((tile, index) => {
            // Styling based on type
            let bgClass = 'bg-white';
            let borderClass = 'border-gray-200';
            let icon = `${tile.id}`;
            let label = '';

            if (tile.type === TileType.FINISH) {
                bgClass = 'bg-yellow-400';
                borderClass = 'border-yellow-500';
                icon = '🏆';
                label = 'CHEGADA';
            } else if (tile.type === TileType.FORWARD_1) {
                bgClass = 'bg-green-100';
                borderClass = 'border-green-300';
                icon = '🚀';
                label = 'Avance 1 Espaço';
            } else if (tile.type === TileType.BACK_1) {
                bgClass = 'bg-red-100';
                borderClass = 'border-red-300';
                icon = '🔻';
                label = 'Volte 1 Espaço';
            } else if (tile.type === TileType.EXTRA_CHALLENGE) {
                bgClass = 'bg-purple-100';
                borderClass = 'border-purple-300';
                icon = '❓';
                label = 'Desafio Extra';
            } else if (tile.type === TileType.CHOOSE_FORWARD) {
                bgClass = 'bg-blue-100';
                borderClass = 'border-blue-300';
                icon = '🤝';
                label = 'Escolha (+1)';
            } else if (tile.type === TileType.CHOOSE_BACK) {
                bgClass = 'bg-orange-100';
                borderClass = 'border-orange-300';
                icon = '😈';
                label = 'Escolha (-1)';
            }

            // Find players on this tile using visiblePlayers
            const playersOnTile = visiblePlayers.filter(p => p.position === index + 1); // Tiles are 1-based
            // Handle players at start (position 0)
            const isStart = index === 0;
            const playersAtStart = isStart ? visiblePlayers.filter(p => p.position === 0) : [];
            
            return (
                <div 
                    key={tile.id}
                    className={`aspect-square rounded-xl border-2 ${bgClass} ${borderClass} flex flex-col items-center justify-center relative shadow-sm p-1 text-center`}
                >
                    <span className="text-xs font-bold text-gray-400 absolute top-1 left-2">#{tile.id}</span>
                    <div className="text-2xl mb-1">{icon}</div>
                    {label && <span className="text-[8px] md:text-[10px] uppercase font-bold text-gray-600 leading-tight">{label}</span>}

                    {/* Render Players */}
                    <div className="absolute bottom-1 right-1 flex -space-x-2">
                        {[...playersOnTile, ...playersAtStart].map((p) => (
                            <div key={p.username} className="relative group z-10">
                                <img 
                                    src={p.avatarUrl || `https://ui-avatars.com/api/?name=${p.username}&background=random`} 
                                    alt={p.username}
                                    className={`w-8 h-8 rounded-full border-2 ${p.username === currentUser ? 'border-yellow-400 ring-2 ring-yellow-200' : 'border-white'} bg-white object-cover`}
                                />
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap">
                                    {p.username}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};