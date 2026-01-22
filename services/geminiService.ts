import { GoogleGenAI, Type, Modality } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Models
const TEXT_MODEL = 'gemini-3-flash-preview';
const IMAGE_MODEL = 'gemini-2.5-flash-image'; // Nano Banana
const AUDIO_MODEL = 'gemini-2.5-flash-preview-tts';

// --- Text Generation (Haiku Logic) ---

export const generateTheme = async (): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      // Updated prompt for more variety and temperature for randomness
      contents: "Generate a unique, specific, and highly atmospheric nature setting. Vary the season, time of day, and weather conditions dramatically. Examples: 'Midnight Snow on Cedar Trees', 'Thunderstorm over a Canyon', 'Fog rolling into a Harbor', 'Mossy Ruins in Rain', 'Volcanic Black Sand Beach'. Return only the short theme string.",
      config: {
        temperature: 1.4, // High temperature for variety
      }
    });
    return response.text?.trim() || "Ancient Forest";
  } catch (e) {
    console.error("Theme Gen Error", e);
    return "Silent Snow";
  }
};

export interface HaikuOption {
  text: string;
  feature: string;
  x: number;
  y: number;
}

export const generateHaikuOptions = async (
  lineIndex: number, // 0, 1, or 2
  theme: string,
  previousLines: string[],
  imageBase64?: string | null, // Made optional for parallel speed mode
  focusContext?: string // The feature description we just clicked on
): Promise<HaikuOption[]> => {
  const syllables = lineIndex === 1 ? 7 : 5; // 5-7-5 structure
  
  let prompt = `
  Context: We are sitting quietly in nature, observing a scene defined by: ${theme}.
  Previous lines: ${previousLines.length > 0 ? previousLines.join(' / ') : 'None yet'}.
  ${focusContext ? `We are currently focusing our gaze specifically on: "${focusContext}".` : ''}
  
  Task: Identify 3 distinct, specific visual features that a person sitting here would see.
  
  For EACH of the 3 features:
  1. Identify its approximate center coordinates (x, y) as percentages (0-100), where x=0 is left, y=0 is top. Ensure these coordinates ACCURATELY match where the feature is located in the image.
  2. Describe the visual feature concretely and realistically.
  3. Write a deep, metaphorical, and poignant haiku line of EXACTLY ${syllables} syllables inspired by that feature. 
     - DO NOT just describe the object. 
     - Focus on emotion, impermanence, silence, or the passage of time.
     - Be creative and poetic.
  
  Return a JSON array of objects with keys: "text" (the poetic line), "feature" (the visual description), "x", "y".
  `;

  let reqContents: any;

  // Only attach image if we have it and aren't in "fast mode"
  if (imageBase64) {
     reqContents = {
       parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: imageBase64
            }
          },
          { text: `Analyze the image composition carefully from the perspective of an observer. ${prompt}` }
       ]
     };
  } else {
     reqContents = {
       parts: [
         { text: `Imagine the scene vividly as if sitting there. ${prompt}` }
       ]
     };
  }

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: reqContents,
      config: {
        temperature: 1.2, // Increased creativity for lines
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              feature: { type: Type.STRING },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER }
            },
            required: ["text", "feature", "x", "y"]
          }
        }
      }
    });

    const jsonText = response.text || "[]";
    const options = JSON.parse(jsonText) as HaikuOption[];
    
    if (!Array.isArray(options) || options.length === 0) {
      throw new Error("Invalid options format");
    }
    
    return options.slice(0, 3);
  } catch (error) {
    console.error("Haiku Option Gen Error", error);
    return [
      { text: "Nature stays silent", feature: "Gray stones", x: 30, y: 40 },
      { text: "Wind blows through the trees", feature: "Swaying branches", x: 70, y: 30 },
      { text: "Shadows start to fall", feature: "Darkening grass", x: 50, y: 70 }
    ];
  }
};

// --- Image Generation (Nano Banana) ---

// Removed previousImageBase64 to speed up generation (Text-to-Image is faster than Img-to-Img)
export const generateLandscape = async (theme: string, focusFeature?: string): Promise<string> => {
  try {
    // Optimized prompt for speed and clarity without needing reference image
    let prompt = `Photorealistic nature landscape, first-person POV sitting in nature. Theme: ${theme}. National Geographic style, sharp focus, natural lighting, vibrant colors. NO fantasy.`;

    if (focusFeature) {
      // ZOOM IN logic - purely text based now for speed
      prompt += ` MACRO CLOSE-UP of: "${focusFeature}". Highly detailed texture, depth of field.`;
    } else {
      prompt += ` Wide angle establishing shot.`;
    }

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts: [{ text: prompt }] },
    });

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Image Gen Error", error);
    throw error;
  }
};

// --- Audio Generation (TTS) ---

export const generateHaikuAudio = async (text: string): Promise<ArrayBuffer> => {
  try {
    const response = await ai.models.generateContent({
      model: AUDIO_MODEL,
      // Updated prompt: faster pace, slight Asian accent
      contents: [{ parts: [{ text: `Instructions: Speak with a slightly brisk, flowing pace. Adopt a very subtle, dignified Asian accent. Tone: Reflective and atmospheric. Text: "${text}"` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Charon' } // Deep male voice works well for this
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");

    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error("TTS Gen Error", error);
    throw error;
  }
};