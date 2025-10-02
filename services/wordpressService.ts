import { WpCredentials, SchemaStatus, SitemapGroup, UrlInfo } from '../types';

// Using a CORS proxy to bypass browser restrictions on cross-origin requests.
// This is used as a FALLBACK if a direct fetch fails due to CORS policy.
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * A robust fetching utility that attempts a direct fetch first, and falls back to a CORS proxy
 * if a TypeError (indicative of a CORS error) is caught.
 * @param url The URL to fetch.
 * @param options Standard fetch options.
 * @returns A Promise resolving to the Fetch Response.
 */
const fetchWithCorsFallback = async (url: string, options?: RequestInit): Promise<Response> => {
  try {
    // 1. Try a direct fetch first. This is faster and more reliable if the server supports CORS.
    const directResponse = await fetch(url, options);
    return directResponse;
  } catch (error) {
    if (error instanceof TypeError) {
      // 2. TypeError is the most common indicator of a CORS block or network failure.
      // We'll now try the proxy as a fallback.
      console.warn(`Direct fetch for ${url} failed, likely due to CORS. Retrying with proxy.`);
      try {
        const proxyResponse = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`, options);
        return proxyResponse;
      } catch (proxyError) {
        // 3. If the proxy also fails, throw a more specific error.
        console.error(`Proxy fetch also failed for ${url}:`, proxyError);
        throw new Error(`Failed to fetch via both direct connection and proxy. The server may be down or blocking requests.`);
      }
    }
    // 4. If it wasn't a TypeError, it's a different kind of problem. Re-throw.
    console.error(`An unexpected error occurred during fetch for ${url}:`, error);
    throw error;
  }
};

export const validateWpCredentials = async (creds: WpCredentials): Promise<boolean> => {
  if (!creds.siteUrl || !creds.username || !creds.appPassword) return false;
  try {
    const response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/users/me`, {
      headers: {
        'Authorization': `Basic ${btoa(`${creds.username}:${creds.appPassword}`)}`,
      },
    });
    return response.ok;
  } catch (error) {
    console.error('WP Credential Validation Error:', error);
    return false;
  }
};

const parseSitemap = async (url: string, progressCallback: (message: string) => void): Promise<SitemapGroup[]> => {
  try {
    const response = await fetchWithCorsFallback(url);
    if (!response.ok) throw new Error(`Failed to fetch sitemap: Server responded with status ${response.status}`);
    
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    const errorNode = xmlDoc.querySelector('parsererror');
    if (errorNode) {
        throw new Error('Failed to parse sitemap XML. The file may be malformed.');
    }

    const sitemapLocs = Array.from(xmlDoc.querySelectorAll('sitemap > loc')).map(loc => loc.textContent || '').filter(Boolean);
    const urlLocs = Array.from(xmlDoc.querySelectorAll('url > loc')).map(loc => loc.textContent || '').filter(Boolean);

    // Case 1: This is a sitemap index file that points to other sitemaps.
    if (sitemapLocs.length > 0) {
        progressCallback(`Found sitemap index with ${sitemapLocs.length} nested sitemaps... Parsing...`);
        let allGroups: SitemapGroup[] = [];
        for (const sitemapUrl of sitemapLocs) {
            const nestedGroups = await parseSitemap(sitemapUrl, () => {});
            allGroups = allGroups.concat(nestedGroups);
        }
        return allGroups;
    }

    // Case 2: This is a regular sitemap file containing URLs.
    if (urlLocs.length > 0) {
      return [{ sitemapUrl: url, urls: urlLocs }];
    }
    
    // Case 3: Empty or unrecognized format.
    return [];
  } catch (error) {
      console.error(`Error processing sitemap at ${url}:`, error);
      throw new Error(`Could not fetch or parse sitemap. ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
  }
};


/**
 * Fetches and parses a sitemap, returning a structured list of sitemap groups.
 */
export const fetchAndParseSitemap = async (creds: WpCredentials, progressCallback: (message: string) => void): Promise<SitemapGroup[]> => {
  progressCallback('Fetching and parsing sitemap...');
  
  const sitemapUrl = creds.sitemapUrl 
    ? creds.sitemapUrl 
    : `${creds.siteUrl.replace(/\/$/, '')}/sitemap.xml`;
  
  try {
      const groups = await parseSitemap(sitemapUrl, progressCallback);
      const totalUrls = groups.reduce((sum, group) => sum + group.urls.length, 0);
      progressCallback(`Found ${totalUrls} URLs across ${groups.length} sitemaps.`);
      return groups;
  } catch (error) {
       throw new Error(`Could not fetch or parse sitemap at ${sitemapUrl}. Please ensure the URL is correct and public. See the "Connection Issues?" guide for troubleshooting. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Fetches a single URL and analyzes its content for a title, existing schema markup, and main text content.
 */
export const analyzeUrl = async (url: string): Promise<Pick<UrlInfo, 'url' | 'title' | 'schemaStatus' | 'content' | 'analysisError'>> => {
  try {
    const response = await fetchWithCorsFallback(url);
    if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
    }
    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    const title = doc.querySelector('title')?.textContent || 'No Title Found';
    const schemaScript = doc.querySelector('script[type="application/ld+json"]');
    
    // Extract main content for better AI context, stripping scripts and styles
    doc.querySelectorAll('script, style').forEach(el => el.remove());
    const content = doc.body?.innerText || '';
    
    return {
      url,
      title,
      schemaStatus: schemaScript ? SchemaStatus.Found : SchemaStatus.NotFound,
      content: content.replace(/\s\s+/g, ' ').trim(), // Clean up whitespace
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.warn(`Error analyzing ${url}:`, errorMessage);
    // Return a result that indicates failure so it can be handled gracefully downstream.
    return {
      url,
      title: 'Failed to analyze URL',
      schemaStatus: SchemaStatus.AnalysisFailed,
      analysisError: errorMessage,
    };
  }
};


const getPostIdFromUrl = async (creds: WpCredentials, url: string): Promise<number | null> => {
    try {
        const urlObject = new URL(url);
        const pathParts = urlObject.pathname.split('/').filter(Boolean);
        const slug = pathParts[pathParts.length - 1];

        if (!slug) return null;

        const authHeader = { 'Authorization': `Basic ${btoa(`${creds.username}:${creds.appPassword}`)}` };

        // Try to find it as a post first
        let response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/posts?slug=${slug}`, { headers: authHeader });
        if (response.ok) {
            const posts = await response.json();
            if (posts.length > 0) return posts[0].id;
        }

        // If not a post, try as a page
        response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/pages?slug=${slug}`, { headers: authHeader });
        if (response.ok) {
            const pages = await response.json();
            if (pages.length > 0) return pages[0].id;
        }
        
        // Could add other post types here if needed
        console.warn(`Could not find a post or page with slug: ${slug}`);
        return null;

    } catch (error) {
        console.error(`Error finding post ID for URL ${url}:`, error);
        return null;
    }
};

export const injectSchema = async (
  creds: WpCredentials,
  url: string,
  schema: object
): Promise<{ success: boolean; error?: string }> => {
    const postId = await getPostIdFromUrl(creds, url);
    if (!postId) {
        return { success: false, error: `Could not find a matching post/page in WordPress for URL: ${url}` };
    }

    // We need to find the post type to use the correct endpoint. A bit of a hack without more info.
    // Let's try posts first, then pages.
    const postTypesToTry = ['posts', 'pages']; 
    
    for (const postType of postTypesToTry) {
        try {
            const endpoint = `${creds.siteUrl}/wp-json/wp/v2/${postType}/${postId}`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${btoa(`${creds.username}:${creds.appPassword}`)}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    meta: {
                        // The custom field name where the schema will be stored.
                        // The user must add PHP to their theme to render this field.
                        ai_generated_schema: JSON.stringify(schema),
                    },
                }),
            });

            if (response.ok) {
                return { success: true };
            } else if (response.status !== 404) { // If it's not a 404, it's a real error
                 const errorData = await response.json();
                 return { success: false, error: errorData.message || `Failed to inject schema. Status: ${response.status}` };
            }
        } catch (error) {
            // This might fail if we guess the wrong post type, so we just continue
            console.warn(`Attempt to inject into ${postType} failed, trying next type...`);
        }
    }
    
    return { success: false, error: `Could not find post/page with ID ${postId} in common post types.` };
};