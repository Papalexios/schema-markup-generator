import { WpCredentials, SchemaStatus, SitemapGroup, UrlInfo } from '../types';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// --- Caching Service ---
interface CachedUrlData {
  schemaStatus: SchemaStatus;
  existingSchema?: object | null;
  title: string;
  lastChecked: number;
}

const getCache = (siteUrl: string): Record<string, CachedUrlData> => {
  try {
    const cached = localStorage.getItem(`schema-cache-${siteUrl}`);
    return cached ? JSON.parse(cached) : {};
  } catch (e) {
    return {};
  }
};

const setUrlDataInCache = (siteUrl: string, url: string, data: Omit<CachedUrlData, 'lastChecked'>) => {
  try {
    const cache = getCache(siteUrl);
    cache[url] = { ...data, lastChecked: Date.now() };
    localStorage.setItem(`schema-cache-${siteUrl}`, JSON.stringify(cache));
  } catch (e) {
    console.error("Failed to write to localStorage:", e);
  }
};
// --- End Caching Service ---


const fetchWithCorsFallback = async (url: string, options?: RequestInit): Promise<Response> => {
  try {
    const directResponse = await fetch(url, options);
    return directResponse;
  } catch (error) {
    if (error instanceof TypeError) {
      console.warn(`Direct fetch for ${url} failed, likely due to CORS. Retrying with proxy.`);
      try {
        const proxyResponse = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`, options);
        return proxyResponse;
      } catch (proxyError) {
        console.error(`Proxy fetch also failed for ${url}:`, proxyError);
        throw new Error(`Failed to fetch via both direct connection and proxy.`);
      }
    }
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

    if (sitemapLocs.length > 0) {
        progressCallback(`Found sitemap index with ${sitemapLocs.length} nested sitemaps... Parsing...`);
        let allGroups: SitemapGroup[] = [];
        for (const sitemapUrl of sitemapLocs) {
            const nestedGroups = await parseSitemap(sitemapUrl, () => {});
            allGroups = allGroups.concat(nestedGroups);
        }
        return allGroups;
    }

    if (urlLocs.length > 0) {
      return [{ sitemapUrl: url, urls: urlLocs }];
    }
    
    return [];
  } catch (error) {
      console.error(`Error processing sitemap at ${url}:`, error);
      throw new Error(`Could not fetch or parse sitemap. ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
  }
};

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
       throw new Error(`Could not fetch or parse sitemap at ${sitemapUrl}. Please ensure the URL is correct and public. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const analyzeUrl = async (url: string, siteUrl: string): Promise<UrlInfo> => {
  // 1. Check Cache (Delta Analysis)
  const cache = getCache(siteUrl);
  if (cache[url]) {
    const cachedData = cache[url];
    // If it was found last time, return a special "Cached" status to skip re-analysis.
    if (cachedData.schemaStatus === SchemaStatus.Found || cachedData.schemaStatus === SchemaStatus.AuditRecommended) {
       return {
        url,
        title: cachedData.title,
        schemaStatus: SchemaStatus.Cached,
        content: '',
        existingSchema: cachedData.existingSchema,
      } as UrlInfo; // Cast as we are intentionally omitting some fields
    }
  }

  // 2. Fetch and Analyze
  try {
    const response = await fetchWithCorsFallback(url);
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    const title = doc.querySelector('title')?.textContent || 'No Title Found';
    const schemaScript = doc.querySelector('script[type="application/ld+json"]');
    
    doc.querySelectorAll('script, style').forEach(el => el.remove());
    const content = doc.body?.innerText.replace(/\s\s+/g, ' ').trim() || '';
    
    let schemaStatus: SchemaStatus;
    let existingSchema: object | null = null;

    if (schemaScript?.textContent) {
        try {
            existingSchema = JSON.parse(schemaScript.textContent);
            // Instead of just 'Found', we now recommend an audit.
            schemaStatus = SchemaStatus.AuditRecommended;
        } catch (e) {
            // Schema script exists but is invalid JSON.
            schemaStatus = SchemaStatus.NotFound; // Treat as not found to generate a new one.
        }
    } else {
        schemaStatus = SchemaStatus.NotFound;
    }
    
    const result = { url, title, schemaStatus, content, existingSchema };
    setUrlDataInCache(siteUrl, url, { schemaStatus, title, existingSchema });

    return result as UrlInfo;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.warn(`Error analyzing ${url}:`, errorMessage);
    return {
      url,
      title: 'Failed to analyze URL',
      schemaStatus: SchemaStatus.AnalysisFailed,
      analysisError: errorMessage,
    } as UrlInfo;
  }
};

const getPostIdFromUrl = async (creds: WpCredentials, url: string): Promise<number | null> => {
    try {
        const urlObject = new URL(url);
        const pathParts = urlObject.pathname.split('/').filter(Boolean);
        const slug = pathParts[pathParts.length - 1];
        if (!slug) return null;
        const authHeader = { 'Authorization': `Basic ${btoa(`${creds.username}:${creds.appPassword}`)}` };
        let response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/posts?slug=${slug}`, { headers: authHeader });
        if (response.ok) {
            const posts = await response.json();
            if (posts.length > 0) return posts[0].id;
        }
        response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/pages?slug=${slug}`, { headers: authHeader });
        if (response.ok) {
            const pages = await response.json();
            if (pages.length > 0) return pages[0].id;
        }
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
                        ai_generated_schema: JSON.stringify(schema),
                    },
                }),
            });
            if (response.ok) {
                return { success: true };
            } else if (response.status !== 404) {
                 const errorData = await response.json();
                 return { success: false, error: errorData.message || `Failed to inject schema. Status: ${response.status}` };
            }
        } catch (error) {
            console.warn(`Attempt to inject into ${postType} failed, trying next type...`);
        }
    }
    return { success: false, error: `Could not find post/page with ID ${postId} in common post types.` };
};
