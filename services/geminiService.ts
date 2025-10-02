import { GoogleGenAI } from "@google/genai";
import { UrlInfo, AiConfig, BusinessInfo, SchemaType } from '../types.ts';

// This file requires the `@google/genai` package.

const getClient = (apiKey: string) => {
    return new GoogleGenAI({ apiKey });
};

const cleanJsonString = (rawString: string): string => {
    const match = rawString.match(/```json\n([\s\S]*?)\n```/);
    if (match && match[1]) {
        return match[1].trim();
    }
    return rawString.trim();
};

export const validateGeminiApiKey = async (apiKey: string): Promise<boolean> => {
    if (!apiKey) return false;
    try {
        const ai = getClient(apiKey);
        // A lightweight call to validate the key and model access.
        await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: 'hi',
          config: {
            maxOutputTokens: 1,
            thinkingConfig: { thinkingBudget: 0 }
          }
        });
        return true;
    } catch (error) {
        console.error("Gemini API Key validation failed:", error);
        return false;
    }
};

export const suggestSchemaTypesWithGemini = async (
    urls: { url: string; title: string }[],
    config: AiConfig
): Promise<{ [url: string]: SchemaType }> => {
    try {
        const ai = getClient(config.apiKey);
        const validSchemaTypes = Object.values(SchemaType).join(', ');

        const prompt = `
        Analyze the following list of webpage URLs and titles. For each one, suggest the single most appropriate schema.org type.

        **Allowed Schema Types:**
        [${validSchemaTypes}]

        **Webpage List:**
        ${urls.map(u => `- URL: ${u.url}\n  Title: "${u.title}"`).join('\n')}

        Your response must be a valid JSON object mapping each full URL to its suggested schema type string.
        Example: {"https://example.com/product/widget": "Product", "https://example.com/blog/news": "Article"}
    `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            },
        });

        const parsed = JSON.parse(response.text);
        
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
        console.error("Error suggesting schema types with Gemini:", error);
        throw new Error('AI failed to suggest schema types.');
    }
};

export const generateSchemaWithGemini = async (urlInfo: UrlInfo, config: AiConfig, businessInfo?: BusinessInfo): Promise<object> => {
     try {
        const ai = getClient(config.apiKey);
        
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

        const prompt = `
            Act as an expert SEO Engineer and Knowledge Graph specialist. Your task is to generate a deeply interconnected and E-E-A-T rich JSON-LD schema graph for a webpage, based on its content.

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

            Your output must be a valid JSON object representing the schema.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        const jsonString = response.text;
        return JSON.parse(cleanJsonString(jsonString));

    } catch (error) {
        console.error(`Error generating schema with Gemini for ${urlInfo.url}:`, error);
        if (error instanceof Error) {
            throw new Error(`AI generation failed: ${error.message}`);
        }
        throw new Error('An unknown error occurred during AI schema generation.');
    }
};