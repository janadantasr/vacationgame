import React, { useState } from 'react';
import { generateAvatarFromPhoto } from '../services/geminiService';

interface Props {
  onComplete: (avatarUrl: string) => void;
}

export const AvatarCreator: React.FC<Props> = ({ onComplete }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!preview) return;
    setLoading(true);
    setError('');
    try {
      const generated = await generateAvatarFromPhoto(preview);
      onComplete(generated);
    } catch (err) {
      setError('Failed to generate avatar. Try a different photo or check API key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-display font-bold text-purple-800 mb-4 text-center">Create Your Character</h2>
      <p className="text-gray-600 mb-6 text-center text-sm">Upload a selfie. Our AI will transform you into a game character!</p>
      
      <div className="mb-6 flex flex-col items-center">
        <div className="w-48 h-48 bg-gray-100 rounded-full border-4 border-dashed border-purple-200 flex items-center justify-center overflow-hidden mb-4 relative">
           {preview ? (
             <img src={preview} alt="Preview" className="w-full h-full object-cover" />
           ) : (
             <span className="text-gray-400 text-4xl">📷</span>
           )}
           {loading && (
             <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
             </div>
           )}
        </div>
        
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-purple-50 file:text-purple-700
            hover:file:bg-purple-100
          "
        />
      </div>

      {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={!preview || loading}
        className={`w-full py-3 rounded-xl font-bold text-white transition-all
          ${!preview || loading ? 'bg-gray-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg'}
        `}
      >
        {loading ? 'Magic in Progress...' : 'Generate Avatar'}
      </button>
    </div>
  );
};