
import React from 'react';

interface Props {
  onClose: () => void;
}

export const IntroModal: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl relative animate-fade-in">
        <h2 className="text-3xl font-display font-bold text-purple-800 mb-4 text-center">
          Vacation Game - USA Version 🇺🇸
        </h2>
        
        <div className="space-y-4 text-gray-700 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
          <p>
            Estou de férias! Dessa vez irei para os Estados Unidos. Como vocês gostaram da versão Japão, criei um novo desafio.
          </p>
          <p>
            Cada dia você deve entrar no app, logar com seu usuário e resolver o desafio do dia. 
            Caso você acerte o desafio, andará o número de casas correspondente ao desafio. 
            No fim dos 9 dias, o personagem que estiver mais à frente vence e ganha uma caixa de surpresas vindo direto dos EUA! Boa sorte!!! :D
          </p>
          
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h3 className="font-bold text-yellow-800 mb-2 uppercase text-sm tracking-wide">Regras Gerais:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Você só pode entrar com o mesmo usuário todos os dias. Múltiplos usuários desclassificam.</li>
              <li>Não pode passar a resposta pro coleguinha.</li>
              <li>Qualquer bug, mandem mensagem no WhatsApp.</li>
              <li>Se o erro for irreversível, sortearemos o prêmio.</li>
            </ul>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-6 bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 shadow-lg transition-transform active:scale-95"
        >
          Entendi! Let's Go!
        </button>
      </div>
    </div>
  );
};