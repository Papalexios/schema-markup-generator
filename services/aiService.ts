import { UrlInfo, AiConfig, SchemaType, BusinessInfo, AiProvider, SitemapGroup } from '../types.ts';
import { 
    validateGeminiApiKey, 
    suggestSchemaTypesWithGemini, 
    generateSchemaWithGemini,
    categorizeSitemapsWithGemini,
    auditAndUpgradeSchemaWithGemini,
    detectSchemaOpportunitiesWithGemini,
} from './geminiService.ts';
import { 
    validateOpenAiCompatibleKey, 
    suggestSchemaTypesWithOpenAI, 
    generateSchemaWithOpenAI,
    categorizeSitemapsWithOpenAI,
    auditAndUpgradeSchemaWithOpenAI,
    detectSchemaOpportunitiesWithOpenAI,
} from './openAiCompatibleService.ts';

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

export const categorizeSitemaps = async (
    groups: SitemapGroup[],
    config: AiConfig
): Promise<{ primary: SitemapGroup[], secondary: SitemapGroup[] }> => {
    let categorizedUrls: { primary: string[], secondary: string[] };
    switch (config.provider) {
        case AiProvider.Gemini:
            categorizedUrls = await categorizeSitemapsWithGemini(groups.map(g => g.sitemapUrl), config);
            break;
        case AiProvider.OpenAI:
        case AiProvider.Claude:
        case AiProvider.Groq:
        case AiProvider.OpenRouter:
            categorizedUrls = await categorizeSitemapsWithOpenAI(groups.map(g => g.sitemapUrl), config);
            break;
        default:
            throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
    
    const primary = groups.filter(g => categorizedUrls.primary.includes(g.sitemapUrl));
    const secondary = groups.filter(g => categorizedUrls.secondary.includes(g.sitemapUrl));
    return { primary, secondary };
};

export const auditAndUpgradeSchema = async (
    urlInfo: UrlInfo,
    config: AiConfig,
    businessInfo?: BusinessInfo
): Promise<object> => {
    switch (config.provider) {
        case AiProvider.Gemini:
            return auditAndUpgradeSchemaWithGemini(urlInfo, config, businessInfo);
        case AiProvider.OpenAI:
        case AiProvider.Claude:
        case AiProvider.Groq:
        case AiProvider.OpenRouter:
            return auditAndUpgradeSchemaWithOpenAI(urlInfo, config, businessInfo);
        default:
            throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
};

export const detectSchemaOpportunities = async (
    content: string,
    config: AiConfig
): Promise<SchemaType[]> => {
    switch (config.provider) {
        case AiProvider.Gemini:
            return detectSchemaOpportunitiesWithGemini(content, config);
        case AiProvider.OpenAI:
        case AiProvider.Claude:
        case AiProvider.Groq:
        case AiProvider.OpenRouter:
            return detectSchemaOpportunitiesWithOpenAI(content, config);
        default:
            throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
};
