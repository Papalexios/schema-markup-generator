import { UrlInfo, AiConfig, BusinessInfo, SchemaType, AiProvider } from '../types.ts';

const PROVIDER_CONFIG = {
    [AiProvider.OpenAI]: {
        baseURL: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o-mini',
        authHeader: (key: string) => `Bearer ${key}`,
        apiKeyHeader: 'Authorization'
    },
    [AiProvider.Claude]: {
        baseURL: 'https://api.anthropic.com/v1',
        defaultModel: 'claude-3-haiku-20240307',
        authHeader: (key: string) => key,
        apiKeyHeader: 'x-api-key',
        extraHeaders: { 'anthropic-version': '2023-06-01' }
    },
    [AiProvider.Groq]: {
        baseURL: 'https://api.groq.com/openai/v1',
        defaultModel: 'llama3-8b-8192',
        authHeader: (key: string) => `Bearer ${key}`,
        apiKeyHeader: 'Authorization'
    },
    [AiProvider.OpenRouter]: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultModel: 'nous-hermes-2-mixtral-8x7b-dpo',
        authHeader: (key: string) => `Bearer ${key}`,
        apiKeyHeader: 'Authorization'
    }
}

const callApi = async (endpoint: string, config: AiConfig, body: object) => {
    const providerConfig = PROVIDER_CONFIG[config.provider];
    if (!providerConfig) {
        throw new Error(`Invalid provider specified: ${config.provider}`);
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        [providerConfig.apiKeyHeader]: providerConfig.authHeader(config.apiKey),
        ...(providerConfig.extraHeaders || {})
    };

    const response = await fetch(`${providerConfig.baseURL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("API Error:", errorBody);
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
    }

    return response.json();
};

export const validateOpenAiCompatibleKey = async (config: AiConfig): Promise<boolean> => {
    try {
        if (config.provider === AiProvider.Claude) {
             await callApi('/messages', config, {
                model: PROVIDER_CONFIG[config.provider].defaultModel,
                messages: [{ role: 'user', content: 'hi' }],
                max_tokens: 1
            });
        } else {
            const providerConfig = PROVIDER_CONFIG[config.provider];
            const response = await fetch(`${providerConfig.baseURL}/models`, {
                headers: { [providerConfig.apiKeyHeader]: providerConfig.authHeader(config.apiKey) }
            });
            return response.ok;
        }
        return true;
    } catch (error) {
        console.error("API Key validation failed:", error);
        return false;
    }
};

export const suggestSchemaTypesWithOpenAI = async (
    urls: { url: string; title: string }[],
    config: AiConfig
): Promise<{ [url: string]: SchemaType }> => {
    const validSchemaTypes = Object.values(SchemaType).join(', ');
    const model = config.model || PROVIDER_CONFIG[config.provider]?.defaultModel;

    const systemPrompt = `You are an SEO expert. Your task is to suggest the single most appropriate schema.org type for a list of webpages. You must only choose from the following allowed types: [${validSchemaTypes}]. Your response must be a valid JSON object that maps each URL to its suggested schema type.`;
    
    const userPrompt = `
        Analyze the following list of webpage URLs and titles and provide the best schema.org type for each.

        Webpage List:
        ${urls.map(u => `- URL: ${u.url}\n  Title: "${u.title}"`).join('\n')}

        Respond with nothing but the JSON object.
        Example: {"https://example.com/product/widget": "Product", "https://example.com/blog/news": "Article"}
    `;

    try {
        const response = await callApi('/chat/completions', config, {
            model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            response_format: { type: "json_object" },
            temperature: 0.2,
        });
        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content);
        const validatedSuggestions: { [url: string]: SchemaType } = {};
        for (const url in parsed) {
            const type = parsed[url] as SchemaType;
            if (Object.values(SchemaType).includes(type)) {
                validatedSuggestions[url] = type;
            } else {
                 console.warn(`AI suggested an invalid schema type "${type}" for ${url}. Ignoring.`);
            }
        }
        return validatedSuggestions;
    } catch (error) {
        console.error("Error suggesting schema types with OpenAI-compatible API:", error);
        throw new Error('AI failed to suggest schema types.');
    }
};

export const generateSchemaWithOpenAI = async (
    urlInfo: UrlInfo,
    config: AiConfig,
    businessInfo?: BusinessInfo
): Promise<object> => {
     let optimizationPrompt = '';
    if (urlInfo.selectedSchemaType === SchemaType.LocalBusiness && businessInfo?.address) {
        optimizationPrompt = `\n**Local Business Info:** Use this exact info: Name: ${businessInfo.name}, Address: ${businessInfo.address}, Phone: ${businessInfo.phone}.`;
    } else if (businessInfo?.name) {
        optimizationPrompt = `\n**Organization Info:** Use this name for the publisher: ${businessInfo.name}.`;
    }

    const pageContentSnippet = urlInfo.content ? urlInfo.content.substring(0, 4000) : '';

    const systemPrompt = "Act as an expert SEO Engineer and Knowledge Graph specialist. Your task is to generate a deeply interconnected and E-E-A-T rich JSON-LD schema graph for a webpage, based on its content. Your output must be a valid JSON object representing the schema. Do not include any markdown formatting like ```json.";

    const userPrompt = `
        **Webpage Details:**
        - URL: ${urlInfo.url}
        - Title: "${urlInfo.title || 'Untitled Page'}"
        - Primary Schema Type Requested: "${urlInfo.selectedSchemaType}"
        - Key Page Content: --- ${pageContentSnippet || '(No content scraped)'} ---
        ${optimizationPrompt}

        **Directives:**
        1.  **Content-First:** Base the schema on the provided content. Do not invent information.
        2.  **Knowledge Graph:** Construct a \`@graph\`. The \`@id\` for the primary entity MUST be the canonical page URL. Other entities use fragment identifiers (e.g., "${urlInfo.url}#author").
        3.  **E-E-A-T Signals:** Find author/publisher social media links in the content and add them to a \`sameAs\` array.
        4.  **Strict Compliance:** Images MUST be \`ImageObject\` schemas. If dimensions are unknown, set \`width\` and \`height\` to null. Dates must be ISO 8601. Include \`WebPage\` and \`BreadcrumbList\`.

        Respond with the JSON object and nothing else.
    `;

    const model = config.model || PROVIDER_CONFIG[config.provider]?.defaultModel;

    try {
        const response = await callApi('/chat/completions', config, {
            model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            response_format: { type: "json_object" },
            temperature: 0.3,
        });

        const content = response.choices[0].message.content;
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error generating schema with ${config.provider} for ${urlInfo.url}:`, error);
        throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown Error'}`);
    }
};

export const categorizeSitemapsWithOpenAI = async (
    sitemapUrls: string[],
    config: AiConfig
): Promise<{ primary: string[], secondary: string[] }> => {
    const model = config.model || PROVIDER_CONFIG[config.provider]?.defaultModel;
    const systemPrompt = `You are an SEO expert. Categorize sitemap URLs into 'primary' (posts, pages, products) and 'secondary' (tags, categories, etc.). Respond with a valid JSON object: {"primary": [...], "secondary": [...]}.`;
    const userPrompt = `Sitemap URLs:\n${sitemapUrls.join('\n')}`;

    try {
        const response = await callApi('/chat/completions', config, {
            model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            response_format: { type: "json_object" }
        });
        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error("Error categorizing sitemaps:", error);
        return {
            primary: sitemapUrls.filter(url => /post|page|product/i.test(url)),
            // FIX: Corrected typo from `sitemapsUrls` to `sitemapUrls`.
            secondary: sitemapUrls.filter(url => !/post|page|product/i.test(url)),
        };
    }
};

export const auditAndUpgradeSchemaWithOpenAI = async (
    urlInfo: UrlInfo,
    config: AiConfig,
    businessInfo?: BusinessInfo
): Promise<object> => {
    const model = config.model || PROVIDER_CONFIG[config.provider]?.defaultModel;
    const systemPrompt = "You are a schema markup auditor and SEO expert. Analyze the provided existing schema and page content, then generate a new, vastly improved schema graph. Your output must be a single, valid JSON object.";
    const userPrompt = `
        **Analysis Data:**
        - URL: ${urlInfo.url}
        - Existing Schema: ${JSON.stringify(urlInfo.existingSchema, null, 2).substring(0, 2000)}
        - Key Page Content: ${urlInfo.content?.substring(0, 4000)}

        **Task:**
        Audit the existing schema against the content. Then, create a new, complete, E-E-A-T rich schema \`@graph\`, following all modern best practices (canonical \`@id\`, fragment identifiers, \`sameAs\` properties, \`ImageObject\`, etc.).
    `;

    try {
        const response = await callApi('/chat/completions', config, {
            model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            response_format: { type: "json_object" }
        });
        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error(`Error auditing schema with ${config.provider}:`, error);
        throw new Error('AI schema audit failed.');
    }
};

export const detectSchemaOpportunitiesWithOpenAI = async (
    content: string,
    config: AiConfig
): Promise<SchemaType[]> => {
    if (!content) return [];
    const model = config.model || PROVIDER_CONFIG[config.provider]?.defaultModel;
    const systemPrompt = `Analyze page content. Identify if it's suitable for FAQPage or HowTo schema. Respond with a valid JSON object: {"opportunities": ["FAQPage", "HowTo"]}. If none, return an empty array.`;
    const userPrompt = `Content Snippet:\n---\n${content.substring(0, 3000)}`;

    try {
        const response = await callApi('/chat/completions', config, {
            model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            response_format: { type: "json_object" }
        });
        const parsed = JSON.parse(response.choices[0].message.content);
        const validOpportunities = [SchemaType.FAQPage, SchemaType.HowTo];
        return (parsed.opportunities || []).filter((op: SchemaType) => validOpportunities.includes(op));
    } catch (error) {
        console.error("Error detecting schema opportunities:", error);
        return [];
    }
};