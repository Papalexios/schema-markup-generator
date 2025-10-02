import { UrlInfo, AiConfig, SchemaType, BusinessInfo, AiProvider } from '../types.ts';
import { validateGeminiApiKey, suggestSchemaTypesWithGemini, generateSchemaWithGemini } from './geminiService.ts';
import { validateOpenAiCompatibleKey, suggestSchemaTypesWithOpenAI, generateSchemaWithOpenAI } from './openAiCompatibleService.ts';

// This service acts as a facade, dispatching to the correct provider-specific service.
export const validateApiKey = async (config: AiConfig): Promise<boolean> => {
    switch (config.provider) {
        case AiProvider.Gemini:
            return validateGeminiApiKey(config.apiKey);
        case AiProvider.OpenAI:
        case AiProvider.Claude:
        case AiProvider.Groq:
        case AiProvider.OpenRouter:
            return validateOpenAiCompatibleKey(config);
        default:
            throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
};

export const suggestSchemaTypes = async (
    urls: { url: string; title: string }[],
    config: AiConfig
): Promise<{ [url: string]: SchemaType }> => {
    switch (config.provider) {
        case AiProvider.Gemini:
            return suggestSchemaTypesWithGemini(urls, config);
        case AiProvider.OpenAI:
        case AiProvider.Claude:
        case AiProvider.Groq:
        case AiProvider.OpenRouter:
            return suggestSchemaTypesWithOpenAI(urls, config);
        default:
            throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
};

export const generateSchema = async (
    urlInfo: UrlInfo,
    config: AiConfig,
    businessInfo?: BusinessInfo
): Promise<object> => {
    switch (config.provider) {
        case AiProvider.Gemini:
            return generateSchemaWithGemini(urlInfo, config, businessInfo);
        case AiProvider.OpenAI:
        case AiProvider.Claude:
        case AiProvider.Groq:
        case AiProvider.OpenRouter:
            return generateSchemaWithOpenAI(urlInfo, config, businessInfo);
        default:
            throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
};