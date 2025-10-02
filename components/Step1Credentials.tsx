import React, { useState } from 'react';
import { WpCredentials, AiConfig, AiProvider, BusinessInfo } from '../types';
import Button from './common/Button.tsx';
import Input from './common/Input.tsx';
import Card from './common/Card.tsx';
import { ArrowRightIcon } from './icons/ArrowRightIcon.tsx';
import { BuildingStorefrontIcon } from './icons/BuildingStorefrontIcon.tsx';
import { CodeIcon } from './icons/CodeIcon.tsx';
import { GeminiIcon } from './icons/GeminiIcon.tsx';
import { OpenAiIcon } from './icons/OpenAiIcon.tsx';
import { ClaudeIcon } from './icons/ClaudeIcon.tsx';
import { GroqIcon } from './icons/GroqIcon.tsx';
import { OpenRouterIcon } from './icons/OpenRouterIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { QuestionMarkCircleIcon } from './icons/QuestionMarkCircleIcon.tsx';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon.tsx';

interface Step1CredentialsProps {
  onConnect: (wpCreds: WpCredentials, aiConfig: AiConfig, businessInfo: BusinessInfo) => void;
  isLoading: boolean;
  error: string | null;
}

const PROVIDER_INFO = {
    [AiProvider.Gemini]: { icon: GeminiIcon, requiresModel: false, name: 'Google Gemini' },
    [AiProvider.OpenAI]: { icon: OpenAiIcon, requiresModel: true, name: 'OpenAI' },
    [AiProvider.Claude]: { icon: ClaudeIcon, requiresModel: true, name: 'Anthropic Claude' },
    [AiProvider.Groq]: { icon: GroqIcon, requiresModel: true, name: 'Groq (Fast Llama/Mixtral)' },
    [AiProvider.OpenRouter]: { icon: OpenRouterIcon, requiresModel: true, name: 'OpenRouter (Grok, GPT, etc.)' },
};

const MODEL_PLACEHOLDERS: Partial<Record<AiProvider, string>> = {
    [AiProvider.OpenAI]: 'Model Name (e.g., gpt-4o-mini)',
    [AiProvider.Claude]: 'Model Name (e.g., claude-3-haiku-20240307)',
    [AiProvider.Groq]: 'Model Name (e.g., llama3-70b-8192)',
    [AiProvider.OpenRouter]: 'Model Name (e.g., x-ai/grok-4-fast:free)',
};

const PhpSnippet = `
add_action('wp_head', function() {
    if (is_singular()) {
        $schema = get_post_meta(get_the_ID(), 'ai_generated_schema', true);
        if (!empty($schema)) {
            // The JSON is already a string, so we don't need to re-encode it.
            // Just ensure it's clean and output it in a script tag.
            echo '<script type="application/ld+json">' . $schema . '</script>';
        }
    }
});

// Register the meta key to make it available in the REST API
add_action('init', function() {
    register_post_meta('', 'ai_generated_schema', [
        'show_in_rest' => true,
        'single' => true,
        'type' => 'string',
        'auth_callback' => function() {
            return current_user_can('edit_posts');
        }
    ]);
});
`;

const HtaccessSnippet = `
<IfModule mod_headers.c>
    <FilesMatch "\\.(xml|xsl)$">
        Header set Access-Control-Allow-Origin "*"
    </FilesMatch>
</IfModule>
`;


const Step1Credentials: React.FC<Step1CredentialsProps> = ({ onConnect, isLoading, error }) => {
  const [wpCreds, setWpCreds] = useState<WpCredentials>({ siteUrl: '', sitemapUrl: '', username: '', appPassword: '' });
  const [aiConfig, setAiConfig] = useState<AiConfig>({ provider: AiProvider.Gemini, apiKey: '', model: '' });
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({ name: '', address: '', phone: '' });
  const [showBusinessInfo, setShowBusinessInfo] = useState(false);
  const [showPrerequisites, setShowPrerequisites] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleWpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWpCreds({ ...wpCreds, [e.target.name]: e.target.value });
  };
  
  const handleAiChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'provider') {
      // When provider changes, reset the model to prevent submitting an invalid one
      setAiConfig({ ...aiConfig, provider: value as AiProvider, model: '' });
    } else {
      setAiConfig({ ...aiConfig, [name]: value });
    }
  };
  
  const handleBusinessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBusinessInfo({ ...businessInfo, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation for URL format
    try {
        const url = new URL(wpCreds.siteUrl);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
            throw new Error();
        }
        onConnect(wpCreds, aiConfig, businessInfo);
    } catch (_) {
        onConnect({ ...wpCreds, siteUrl: `https://${wpCreds.siteUrl.replace(/^https?:\/\//, '')}`}, aiConfig, businessInfo);
    }
  };

  const providerInfo = PROVIDER_INFO[aiConfig.provider];
  
  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white">1. Connect Your Site & AI Provider</h2>
          <p className="mt-2 text-slate-400">
            Enter your WordPress credentials and AI provider API key to get started.
          </p>
        </div>
        
        <div className="border-t border-slate-700 p-6 space-y-6">
          {/* WordPress Credentials */}
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-slate-200">WordPress Site</legend>
            <Input name="siteUrl" type="url" placeholder="https://example.com" value={wpCreds.siteUrl} onChange={handleWpChange} required />
            <div>
              <Input name="sitemapUrl" type="url" placeholder="Sitemap URL (Optional)" value={wpCreds.sitemapUrl} onChange={handleWpChange} />
              <p className="mt-1 text-xs text-slate-500">If blank, we'll try /sitemap.xml by default.</p>
            </div>
            <Input name="username" type="text" placeholder="WordPress Username" value={wpCreds.username} onChange={handleWpChange} required />
            <Input name="appPassword" type="password" placeholder="WordPress Application Password" value={wpCreds.appPassword} onChange={handleWpChange} required />
          </fieldset>
          
          {/* Connection Help */}
           <div className="!mt-2">
                <button type="button" onClick={() => setShowHelp(!showHelp)} className="flex items-center text-slate-400 hover:text-slate-200 transition text-sm">
                    <QuestionMarkCircleIcon className="w-5 h-5 mr-2 text-sky-400" />
                    <span className="font-medium">Connection Issues? Troubleshooting Sitemap Fetching</span>
                    <ChevronDownIcon className={`w-5 h-5 ml-1 transition-transform ${showHelp ? 'rotate-180' : ''}`} />
                </button>
                {showHelp && (
                    <div className="mt-4 space-y-3 border-l-2 border-sky-500 pl-6 text-sm text-slate-400">
                        <p>This app runs in your browser, which has security rules (CORS) that can prevent it from fetching your sitemap from a different domain.</p>
                        <p>
                            <strong className="text-slate-200">Premium Fix:</strong> For a reliable, professional connection, add the following code to your WordPress site's <code className="text-xs bg-slate-700 p-1 rounded">.htaccess</code> file. This safely tells browsers that it's okay to read your sitemap files.
                        </p>
                        <pre className="w-full bg-slate-900 p-3 rounded-md text-xs text-slate-300 overflow-x-auto">
                            <code>{HtaccessSnippet.trim()}</code>
                        </pre>
                        <p>As a fallback, this app uses a public proxy to fetch your sitemap, but this can sometimes be unreliable. The <code className="text-xs bg-slate-700 p-1 rounded">.htaccess</code> method is strongly preferred.</p>
                    </div>
                )}
            </div>

          {/* Injection Prerequisites */}
           <div className="!mt-4">
            <button type="button" onClick={() => setShowPrerequisites(!showPrerequisites)} className="flex items-center text-slate-300 hover:text-white transition">
                <CodeIcon className="w-5 h-5 mr-2 text-yellow-400" />
                <span className="font-medium">Important: Injection Prerequisites</span>
                <ChevronDownIcon className={`w-5 h-5 ml-1 transition-transform ${showPrerequisites ? 'rotate-180' : ''}`} />
            </button>
            {showPrerequisites && (
                <div className="mt-4 space-y-3 border-l-2 border-yellow-500 pl-6 text-sm text-slate-400">
                    <p>For schema injection to work, you <strong className="text-slate-200">must</strong> add the following PHP code to your active WordPress theme's <code className="text-xs bg-slate-700 p-1 rounded">functions.php</code> file.</p>
                    <p>This code safely registers a custom field and prints the schema in your site's header.</p>
                    <pre className="w-full bg-slate-900 p-3 rounded-md text-xs text-slate-300 overflow-x-auto">
                        <code>{PhpSnippet.trim()}</code>
                    </pre>
                </div>
            )}
          </div>

          {/* AI Provider */}
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-slate-200">AI Provider</legend>
             <select 
                name="provider" 
                value={aiConfig.provider} 
                onChange={handleAiChange}
                className="block w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-200"
             >
                {Object.values(AiProvider).map(p => <option key={p} value={p}>{PROVIDER_INFO[p].name}</option>)}
             </select>
            <Input name="apiKey" type="password" placeholder={`${providerInfo.name} API Key`} value={aiConfig.apiKey} onChange={handleAiChange} required />
            {providerInfo.requiresModel && (
                 <Input 
                    name="model" 
                    type="text" 
                    placeholder={MODEL_PLACEHOLDERS[aiConfig.provider] || 'Model Name'} 
                    value={aiConfig.model} 
                    onChange={handleAiChange} 
                    required 
                 />
            )}
          </fieldset>
          
          {aiConfig.provider !== AiProvider.Gemini && (
            <div className="!mt-4 p-4 bg-yellow-900/30 border border-yellow-700 rounded-md text-sm text-yellow-200 flex items-start space-x-3">
                <AlertTriangleIcon className="w-6 h-6 mt-0.5 flex-shrink-0 text-yellow-400" />
                <div>
                    <p className="font-semibold">Browser Compatibility Notice</p>
                    <p className="mt-1 text-yellow-300/90">
                        Providers like OpenAI, Claude, and Groq are designed for server-to-server use and are often blocked by browser security (CORS). For highest reliability in this tool, <strong className="font-semibold text-yellow-200">we strongly recommend using Google Gemini</strong>. Connection errors may occur with other providers unless you use a custom proxy that enables CORS.
                    </p>
                </div>
            </div>
          )}

          {/* Business Info */}
          <div>
            <button type="button" onClick={() => setShowBusinessInfo(!showBusinessInfo)} className="flex items-center text-slate-300 hover:text-white transition">
                <BuildingStorefrontIcon className="w-5 h-5 mr-2" />
                <span className="font-medium">Optional: Business Information</span>
                <ChevronDownIcon className={`w-5 h-5 ml-1 transition-transform ${showBusinessInfo ? 'rotate-180' : ''}`} />
            </button>
            {showBusinessInfo && (
                <fieldset className="mt-4 space-y-4 border-l-2 border-slate-700 pl-6">
                    <p className="text-sm text-slate-400">Providing a name helps with `Organization` schema. Address/phone are for `LocalBusiness` schema.</p>
                    <Input name="name" type="text" placeholder="Business Name" value={businessInfo.name} onChange={handleBusinessChange} />
                    <Input name="address" type="text" placeholder="Full Business Address" value={businessInfo.address} onChange={handleBusinessChange} />
                    <Input name="phone" type="tel" placeholder="Business Phone Number" value={businessInfo.phone} onChange={handleBusinessChange} />
                </fieldset>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="border-t border-slate-700 p-6 flex justify-end bg-slate-800/50 rounded-b-lg">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Connecting...' : 'Crawl & Analyze'}
            {!isLoading && <ArrowRightIcon className="ml-2 w-5 h-5" />}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default Step1Credentials;