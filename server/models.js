export const DEFAULT_MODELS = [
  { name: 'models/gemini-3.1-pro', displayName: 'Gemini 3.1 Pro', description: 'Most advanced 3.1 model' },
  { name: 'models/gemini-3.1-flash', displayName: 'Gemini 3.1 Flash', description: 'Fast and efficient 3.1 model' },
  { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: 'Advanced 2.5 model' },
  { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'Fast and efficient 2.5 model' },
  { name: 'models/gemini-2.0-pro-exp-02-05', displayName: 'Gemini 2.0 Pro Experimental', description: 'Experimental Pro model' },
  { name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', description: 'Fast and efficient 2.0 model' },
  { name: 'models/gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', description: 'Advanced 1.5 model' },
  { name: 'models/gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', description: 'Fast and efficient 1.5 model' },
  { name: 'models/gemini-1.5-flash-8b', displayName: 'Gemini 1.5 Flash 8B', description: 'Smallest and fastest model' }
];

export function getModelOrder(availableModels) {
  const models = availableModels || DEFAULT_MODELS;
  return models.map(m => m.name.replace('models/', ''));
}
