import { GoogleGenAI } from "@google/genai";

// Ensure API Key is available
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY is missing from environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/png;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Removes watermark from an image using Gemini's editing capabilities.
 */
export const removeImageWatermark = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Specialized image model
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          {
            text: 'Remove all watermarks, text overlays, logos, and timestamps from this image. Reconstruct the background naturally where the watermarks were removed. Return only the cleaned image.',
          },
        ],
      },
    });

    // Check for image in response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return part.inlineData.data;
      }
    }
    
    throw new Error("No image data returned from the model.");
  } catch (error) {
    console.error("Error removing watermark:", error);
    throw error;
  }
};

/**
 * Generates a video from a clean image frame using Veo.
 * Since direct "video watermark removal" (inpainting) isn't directly exposed in the same way,
 * we use a reconstruction technique: Clean the first frame -> Generate video from it.
 */
export const reconstructVideoFromImage = async (base64Image: string, mimeType: string): Promise<string> => {
  // 1. Check if the user has selected a paid key for Veo
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
          throw new Error("Please select a paid API key to use Video features.");
      }
  }

  // Create a new instance to ensure we pick up the selected key if applicable
  const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    let operation = await veoAi.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      image: {
        imageBytes: base64Image,
        mimeType: mimeType,
      },
      prompt: "Animate this scene naturally, high quality, cinematic movement.",
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9' // Defaulting to landscape for compatibility
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await veoAi.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed to return a URI.");

    // Fetch the actual video bytes
    const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await videoResponse.blob();
    
    // Convert blob to object URL for preview
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Error generating video:", error);
    throw error;
  }
};