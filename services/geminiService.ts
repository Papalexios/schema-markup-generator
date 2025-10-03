import { GoogleGenAI, Type } from "@google/genai";
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

            2.  **Create a Knowledge Graph Fragment:** Construct a \`@graph\` of interconnected entities. The \`@id\` for the primary entity (e.g., Article, Product) MUST be the canonical URL of the page itself. All other entities in the graph must use fragment identifiers (e.g., "${urlInfo.url}#author").

            3.  **Primary Entity:** The main entity should be of the type "${urlInfo.selectedSchemaType}". Give it a clear \`@id\` matching the page URL. This entity should be the most detailed, with properties populated from the page content.

            4.  **Embed E-E-A-T Signals from Content:**
                *   **Author (\`Person\`):** If an author is mentioned, create a detailed \`Person\` schema. Actively search the content for social media links (LinkedIn, X, Facebook, etc.) for the author and include them in a \`sameAs\` array.
                *   **Publisher (\`Organization\`):** Create a publisher \`Organization\` schema. Use the business name if provided, otherwise infer from content. Search for social media links for the organization and include them in a \`sameAs\` array.

            5.  **WebPage and Context:**
                *   Always include a \`WebPage\` schema. Link it to the primary entity via \`mainEntityOfPage\`.
                *   Include a \`BreadcrumbList\` schema if the page structure can be inferred.

            6.  **Strict Google Compliance:**
                *   All dates (e.g., \`datePublished\`, \`dateModified\`) must be in ISO 8601 format. Infer them from the text if available.
                *   Images (\`image\`, \`logo\`) MUST be \`ImageObject\` schemas with \`url\`, \`width\`, and \`height\`. If image dimensions are not available in the content, you MUST set \`width\` and \`height\` to null. Do not omit them.
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

export const categorizeSitemapsWithGemini = async (
    sitemapUrls: string[],
    config: AiConfig
): Promise<{ primary: string[], secondary: string[] }> => {
    try {
        const ai = getClient(config.apiKey);
        const prompt = `
            You are an SEO expert. Below is a list of sitemap URLs from a WordPress site. Categorize them into 'Primary Content' (posts, pages, products) and 'Secondary Content' (categories, tags, authors, archives). Your response must be a valid JSON object with two keys: "primary" and "secondary", containing the respective URLs.

            Sitemap URL List:
            ${sitemapUrls.join('\n')}
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error categorizing sitemaps with Gemini:", error);
        // Fallback to keyword-based categorization on failure
        return {
            primary: sitemapUrls.filter(url => /post|page|product/i.test(url)),
            secondary: sitemapUrls.filter(url => !/post|page|product/i.test(url)),
        };
    }
};

export const auditAndUpgradeSchemaWithGemini = async (
    urlInfo: UrlInfo,
    config: AiConfig,
    businessInfo?: BusinessInfo
): Promise<object> => {
    try {
        const ai = getClient(config.apiKey);
        const pageContentSnippet = urlInfo.content ? urlInfo.content.substring(0, 4000) : '';
        const existingSchemaSnippet = urlInfo.existingSchema ? JSON.stringify(urlInfo.existingSchema, null, 2).substring(0, 2000) : '';

        const prompt = `
            You are a schema markup auditor and SEO expert. Your task is to analyze existing schema and page content, then generate a new, vastly improved schema.

            **Analysis Data:**
            - **URL:** ${urlInfo.url}
            - **Page Title:** "${urlInfo.title}"
            - **Existing Schema (Partial):** 
            \`\`\`json
            ${existingSchemaSnippet}
            \`\`\`
            - **Key Page Content:**
            ---
            ${pageContentSnippet}
            ---

            **Your Directives:**
            1.  **Audit:** Compare the existing schema with the page content. Identify discrepancies, missing recommended properties, and opportunities for enhancement (e.g., adding an author found in the text but missing from schema).
            2.  **Generate Upgraded Schema:** Discard the old schema. Create a new, complete, and E-E-A-T rich JSON-LD schema \`@graph\` based on the page content.
            3.  **Follow Best Practices:**
                *   The \`@id\` for the primary entity MUST be the canonical URL of the page. Other entities use fragment identifiers (e.g., "${urlInfo.url}#author").
                *   Actively search content for author/publisher social media links and add them to a \`sameAs\` array.
                *   Images MUST be \`ImageObject\` schemas. If dimensions are unknown, set \`width\` and \`height\` to null.
                *   Include \`WebPage\` and \`BreadcrumbList\` schemas.

            Your output must be a single, valid JSON object for the new, upgraded schema.
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error(`Error auditing schema with Gemini for ${urlInfo.url}:`, error);
        throw new Error('AI schema audit failed.');
    }
};

export const detectSchemaOpportunitiesWithGemini = async (
    content: string,
    config: AiConfig
): Promise<SchemaType[]> => {
    if (!content) return [];
    try {
        const ai = getClient(config.apiKey);
        const prompt = `
            Analyze the following page content. Does it contain patterns suitable for FAQPage (a list of questions and answers) or HowTo (step-by-step instructions) schema?
            
            **Content Snippet:**
            ---
            ${content.substring(0, 3000)}
            ---

            Respond with a valid JSON object.
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        opportunities: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                    },
                },
            },
        });
        const parsed = JSON.parse(response.text);
        const validOpportunities = [SchemaType.FAQPage, SchemaType.HowTo];
        // Filter to ensure AI doesn't return unsupported types
        return (parsed.opportunities || []).filter((op: SchemaType) => validOpportunities.includes(op));
    } catch (error) {
        console.error("Error detecting schema opportunities with Gemini:", error);
        return [];
    }
};
