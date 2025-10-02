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
        defaultModel: 'llama3-8b-8192', // Default, but user provides
        authHeader: (key: string) => `Bearer ${key}`,
        apiKeyHeader: 'Authorization'
    },
    [AiProvider.OpenRouter]: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultModel: 'nous-hermes-2-mixtral-8x7b-dpo', // Default, but user provides
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
        // A lightweight call to the models endpoint is a good way to validate a key.
        // For claude, this endpoint doesn't exist, so we do a cheap message call.
        if (config.provider === AiProvider.Claude) {
             await callApi('/messages', config, {
                model: PROVIDER_CONFIG[config.provider].defaultModel,
                messages: [{ role: 'user', content: 'hi' }],
                max_tokens: 1
            });
        } else {
            // For OpenAI-like APIs, listing models is usually a free or very cheap operation.
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
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
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
     if (urlInfo.selectedSchemaType === SchemaType.LocalBusiness) {
        if (businessInfo?.address) {
            optimizationPrompt = `
            \n**Local Business Information Provided:**
            *   Business Name: ${businessInfo.name || 'N/A'}
            *   Address: ${businessInfo.address}
            *   Phone: ${businessInfo.phone || 'N/A'}
            You MUST use this exact information to construct the 'LocalBusiness' schema. Include 'address' as a 'PostalAddress' object.`;
        } else {
            optimizationPrompt = `
            \n**CRITICAL Local Business Directive:**
            The user requested a 'LocalBusiness' schema but did NOT provide a structured address.
            1.  First, meticulously scan the "Key Page Content" for a full physical address (street, city, state, postal code).
            2.  If a plausible, complete address is found, use it to generate the 'LocalBusiness' schema.
            3.  If no complete address can be confidently identified from the content, you MUST NOT invent one. Instead, you MUST generate an 'Organization' schema as a fallback. In the 'description' field of the 'Organization' schema, you must add the sentence: "A LocalBusiness schema could not be generated as a physical address was not found on the page."`;
        }
    } else if ((urlInfo.selectedSchemaType === SchemaType.Organization || urlInfo.selectedSchemaType === SchemaType.Article) && businessInfo?.name) {
         optimizationPrompt = `
        \n**Organization Information Provided:**
        *   Name: ${businessInfo.name}
        Use this name for the 'publisher' or 'provider' \`Organization\` schema. This is a digital entity; do not invent a physical address unless one is explicitly mentioned in the page content.`;
    }

    const pageContentSnippet = urlInfo.content ? urlInfo.content.substring(0, 4000) : '';

    const systemPrompt = "Act as an expert SEO Engineer and Knowledge Graph specialist. Your task is to generate a deeply interconnected and E-E-A-T rich JSON-LD schema graph for a webpage, based on its content. Your output must be a valid JSON object representing the schema. Do not include any markdown formatting like ```json.";

    const userPrompt = `
            **Webpage Details:**
            - **URL:** ${urlInfo.url}
            - **Page Title:** "${urlInfo.title || 'Untitled Page'}"
            - **Primary Schema Type Requested:** "${urlInfo.selectedSchemaType}"
            - **Key Page Content:**
            ---
            ${pageContentSnippet || '(No content scraped)'}
            ---
            ${optimizationPrompt}

            **Your Directives:**

            1.  **Content-First Analysis:** Your PRIMARY directive is to base the schema on the **Key Page Content** provided. Extract real entities, facts, and relationships from the text. DO NOT invent information not present in the content. If content is missing, rely only on the Title and URL.

            2.  **Create a Knowledge Graph Fragment:** Construct a \`@graph\` of interconnected entities. Use \`@id\` with fragment identifiers (e.g., "#article", "#author") to link entities together.

            3.  **Primary Entity:** The main entity should be of the type "${urlInfo.selectedSchemaType}". Give it a clear \`@id\` (e.g., "#${urlInfo.selectedSchemaType.toLowerCase()}"). This entity should be the most detailed, with properties populated from the page content.

            4.  **Embed E-E-A-T Signals from Content:**
                *   **Author (\`Person\`):** If the content mentions an author, create a detailed \`Person\` schema with \`@id\`, \`name\`, and other details found in the text. Link the main entity to this author.
                *   **Publisher (\`Organization\`):** Create a publisher \`Organization\` schema. Use the business name if provided, otherwise infer from content. Link the main entity to this publisher.

            5.  **WebPage and Context:**
                *   Always include a \`WebPage\` schema. Link it to the primary entity via \`mainEntityOfPage\`.
                *   Include a \`BreadcrumbList\` schema if the page structure can be inferred.

            6.  **Strict Google Compliance:**
                *   All dates (e.g., \`datePublished\`, \`dateModified\`) must be in ISO 8601 format. Infer them from the text if available.
                *   Images (\`image\`, \`logo\`) must be \`ImageObject\` schemas with \`url\`, \`width\`, and \`height\`.
                *   Ensure all required properties for the chosen schema types are present and populated with data from the content.

            Respond with the JSON object and nothing else.
        `;

    const model = config.model || PROVIDER_CONFIG[config.provider]?.defaultModel;

    try {
        const response = await callApi('/chat/completions', config, {
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
        });

        const content = response.choices[0].message.content;
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error generating schema with ${config.provider} for ${urlInfo.url}:`, error);
        if (error instanceof Error) {
            throw new Error(`AI generation failed: ${error.message}`);
        }
        throw new Error('An unknown error occurred during AI schema generation.');
    }
};