import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

// Helper to compress image to avoid Firestore limits (1MB)
const compressBase64 = (base64Str: string, maxWidth: number = 512, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(base64Str); // Fallback if canvas fails
                return;
            }
            
            let width = img.width;
            let height = img.height;
            
            // Resize logic
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw white background in case of transparency
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compress as JPEG
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (e) => {
            console.warn("Image compression failed, returning original", e);
            resolve(base64Str);
        };
    });
};

export const generateAvatarFromPhoto = async (base64Image: string): Promise<string> => {
  try {
    const ai = getClient();
    
    // Clean the base64 string if it has headers
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    // If the input image is massive, we should probably compress it BEFORE sending to Gemini too, 
    // but for now let's focus on the output.
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: "Turn the person in this photo into a cute, colorful, stylized 2D game RPG character avatar. The style should be cartoonish, vibrant, flat design, with a simple white or solid color background. Focus on the face and distinct features. Just return the image."
          }
        ]
      }
    });

    // Iterate to find image part
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const rawBase64 = `data:image/png;base64,${part.inlineData.data}`;
          // COMPRESS BEFORE RETURNING
          const compressed = await compressBase64(rawBase64);
          return compressed;
        }
      }
    }
    
    throw new Error("No image generated");
  } catch (error) {
    console.error("Avatar generation failed:", error);
    throw error;
  }
};