import { GoogleGenerativeAI } from '@google/generative-ai';

// Initial fallback models in case API fetch fails completely
let modelsList = [
  { name: 'models/gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro Preview', description: 'Latest reasoning model' },
  { name: 'models/gemini-3.1-flash-lite-preview', displayName: 'Gemini 3.1 Flash Lite', description: 'Fast and efficient 3.1 model' },
  { name: 'models/gemini-3-pro-preview', displayName: 'Gemini 3 Pro Preview', description: 'Next generation Pro model' },
  { name: 'models/gemini-3-flash-preview', displayName: 'Gemini 3 Flash Preview', description: 'Next generation Flash model' },
  { name: 'models/gemini-2.0-flash-thinking-preview', displayName: 'Gemini 2.0 Flash Thinking', description: '2.0 model with reasoning capabilities' },
  { name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', description: 'Fast and efficient 2.0 model' },
  { name: 'models/gemini-1.5-pro-latest', displayName: 'Gemini 1.5 Pro Latest', description: 'Advanced 1.5 model' },
  { name: 'models/gemini-1.5-flash-latest', displayName: 'Gemini 1.5 Flash Latest', description: 'Fast and efficient 1.5 model' }
];

let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // Cache for 1 hour

/**
 * Fetches models from Google's Generative Language API
 * @param {string} apiKey - Optional API key (will use process.env if not provided)
 * @returns {Promise<Array>} List of models
 */
export async function fetchGeminiModels(apiKey) {
  const key = apiKey || process.env.GOOGLE_API_KEY || process.env.API_KEY;
  const now = Date.now();

  // Use cache if still valid (and we have more than the fallback models)
  if (modelsList.length > 5 && (now - lastFetchTime < CACHE_DURATION)) {
    return modelsList;
  }

  if (!key) {
    return modelsList;
  }

  try {
    const genAI = new GoogleGenerativeAI(key);
    // Use the official library to list models as suggested
    const result = await genAI.listModels();
    
    // The result might be an object with models array or the array itself depending on version
    const rawModels = result.models || (Array.isArray(result) ? result : []);
    
    if (rawModels.length > 0) {
      // Filter for Gemini models that support generateContent
      const geminiModels = rawModels
        .filter(m => m.name.includes('gemini') && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => ({
          name: m.name,
          displayName: m.displayName || m.name.replace('models/', ''),
          description: m.description || ''
        }));

      if (geminiModels.length > 0) {
        // Clear and update the list in-place
        modelsList.length = 0;
        modelsList.push(...geminiModels);
        lastFetchTime = now;
      }
    }
  } catch (error) {
    // Fallback to manual fetch if the library version doesn't support listModels or fails
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await response.json();

      if (data.models && Array.isArray(data.models)) {
        const geminiModels = data.models
          .filter(m => m.name.includes('gemini') && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => ({
            name: m.name,
            displayName: m.displayName || m.name.replace('models/', ''),
            description: m.description || ''
          }));

        if (geminiModels.length > 0) {
          modelsList.length = 0;
          modelsList.push(...geminiModels);
          lastFetchTime = now;
        }
      }
    } catch (innerError) {
      // console.warn('Failed to fetch Gemini models from Google API:', innerError.message);
    }
  }

  return modelsList;
}

export function getModelOrder(availableModels) {
  const models = availableModels || modelsList;
  return models.map(m => m.name.replace('models/', ''));
}

export { modelsList as DEFAULT_MODELS };
