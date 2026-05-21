export const OPENAI_PROVIDER = 'OPENAI';
export const OPENAI_COMPATIBLE_PROVIDER = 'OPENAI_COMPATIBLE';
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const OPENAI_MODEL_PRESETS = [
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
] as const;
export const DEFAULT_OPENAI_MODEL = OPENAI_MODEL_PRESETS[1];

export function isOpenAiProvider(provider: string): boolean {
  return provider === OPENAI_PROVIDER;
}

export function getProviderBaseUrl(provider: string, baseUrl: string): string {
  if (isOpenAiProvider(provider)) {
    return DEFAULT_OPENAI_BASE_URL;
  }
  return baseUrl;
}
