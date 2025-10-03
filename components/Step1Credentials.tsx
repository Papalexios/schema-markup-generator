import React, { useState } from 'react';
import { WpCredentials, AiConfig, AiProvider, BusinessInfo } from '../types';
import Button from './common/Button.tsx';
import Input from './common/Input.tsx';
import Card from './common/Card.tsx';
import { ArrowRightIcon } from './icons/ArrowRightIcon.tsx';
import { RobotIcon } from './icons/RobotIcon.tsx';
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
import { ShieldCheckIcon } from './icons/ShieldCheckIcon.tsx';
import { DocumentSearchIcon } from './icons/DocumentSearchIcon.tsx';
import { RefreshCwIcon } from './icons/RefreshCwIcon.tsx';
import { ArrowUpRightIcon } from './icons/ArrowUpRightIcon.tsx';


interface Step1CredentialsProps {
  onConnect: (wpCreds: WpCredentials, aiConfig: AiConfig, businessInfo: BusinessInfo, isAutoPilot: boolean) => void;
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

const PhpSnippet = `
add_action('wp_head', function() {
    if (is_singular()) {
        $schema = get_post_meta(get_the_ID(), 'ai_generated_schema', true);
        if (!empty($schema)) {
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

// FIX: Refactored to use a separate interface and React.FC for better type inference with children, resolving the error where the 'children' prop was not being correctly identified.
interface FeatureCardProps {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
}
const FeatureCard: React.FC<FeatureCardProps> = ({ icon: Icon, title, children }) => (
    <div className="relative p-6 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-indigo-500/50 transition-colors duration-300">
        <div className="absolute -top-3 -left-3 bg-slate-800 p-2 rounded-full border border-slate-700">
            <Icon className="w-6 h-6 text-indigo-400" />
        </div>
        <h3 className="mt-4 font-bold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">{children}</p>
    </div>
);

const Step1Credentials: React.FC<Step1CredentialsProps> = ({ onConnect, isLoading, error }) => {
  const [wpCreds, setWpCreds] = useState<WpCredentials>({ siteUrl: '', sitemapUrl: '', username: '', appPassword: '' });
  const [aiConfig, setAiConfig] = useState<AiConfig>({ provider: AiProvider.Gemini, apiKey: '', model: '' });
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({ name: '', address: '', phone: '' });
  const [showBusinessInfo, setShowBusinessInfo] = useState(false);
  const [showPrerequisites, setShowPrerequisites] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isAutoPilot, setIsAutoPilot] = useState(false);

  const handleWpChange = (e: React.ChangeEvent<HTMLInputElement>) => setWpCreds({ ...wpCreds, [e.target.name]: e.target.value });
  const handleAiChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAiConfig(prev => ({ ...prev, [name]: value, ...(name === 'provider' && { model: '' }) }));
  };
  const handleBusinessChange = (e: React.ChangeEvent<HTMLInputElement>) => setBusinessInfo({ ...businessInfo, [e.target.name]: e.target.value });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
        new URL(wpCreds.siteUrl);
        onConnect(wpCreds, aiConfig, businessInfo, isAutoPilot);
    } catch (_) {
        onConnect({ ...wpCreds, siteUrl: `https://${wpCreds.siteUrl.replace(/^https?:\/\//, '')}`}, aiConfig, businessInfo, isAutoPilot);
    }
  };

  const providerInfo = PROVIDER_INFO[aiConfig.provider];
  
  return (
    <div className="space-y-16">
        {/* Hero Section */}
        <div className="text-center animate-fade-in-up" style={{ animationDelay: '0ms' }}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-200 to-slate-400">
                Automate Your SEO with AI
            </h1>
            <p className="mt-4 max-w-3xl mx-auto text-lg text-slate-400">
                Go beyond simple schema. Crawl your entire site, audit existing markup, generate an E-E-A-T rich knowledge graph, and inject it directly into WordPress—all on auto-pilot.
            </p>
        </div>
        
        {/* Form Card */}
        <Card className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <form onSubmit={handleSubmit}>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white">Get Started</h2>
              <p className="mt-2 text-slate-400">
                Connect your site and AI provider, or enable Auto-Pilot for a one-click experience.
              </p>
            </div>
            
            <div className="border-t border-slate-700 p-6 space-y-6">
              {/* Auto-Pilot Toggle */}
              <div className="relative flex items-center justify-center p-4 bg-slate-900/50 rounded-lg border border-indigo-500/50">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-16 bg-indigo-500/30 rounded-full blur-3xl"></div>
                <label htmlFor="auto-pilot-toggle" className="flex items-center cursor-pointer z-10">
                    <RobotIcon className="w-6 h-6 mr-3 text-indigo-400" />
                    <span className="text-lg font-bold text-slate-200 mr-4">Auto-Pilot Mode</span>
                    <div className="relative">
                        <input type="checkbox" id="auto-pilot-toggle" className="sr-only" checked={isAutoPilot} onChange={() => setIsAutoPilot(!isAutoPilot)} />
                        <div className="block bg-slate-700 w-14 h-8 rounded-full"></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isAutoPilot ? 'translate-x-6 bg-indigo-400' : ''}`}></div>
                    </div>
                </label>
                {isAutoPilot && (
                    <p className="absolute -bottom-2 text-center text-xs text-indigo-400 bg-slate-800 px-2">End-to-end automation enabled.</p>
                )}
              </div>
              
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
                        placeholder={'Model Name (e.g., gpt-4o-mini)'} 
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
                {isLoading ? 'Connecting...' : (isAutoPilot ? 'Start Full Automation' : 'Crawl & Analyze')}
                {!isLoading && (isAutoPilot ? <RobotIcon className="ml-2 w-5 h-5" /> : <ArrowRightIcon className="ml-2 w-5 h-5" />)}
              </Button>
            </div>
          </form>
        </Card>

        {/* Features Section */}
        <div className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <h2 className="text-3xl font-bold text-center text-white">The Next Generation of SEO Automation</h2>
            <p className="mt-2 text-center text-slate-400">This isn't just another schema generator. It's an intelligent SEO agent.</p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <FeatureCard icon={RobotIcon} title="Auto-Pilot Workflow">
                    One click to crawl, analyze, generate, validate, and inject schema across your entire site. Set it and forget it.
                </FeatureCard>
                <FeatureCard icon={DocumentSearchIcon} title="AI-Powered Audits">
                    Goes beyond "found/not found". It audits existing schema against page content and upgrades it for accuracy and richness.
                </FeatureCard>
                <FeatureCard icon={ShieldCheckIcon} title="E-E-A-T Rich Schema">
                    Generates an interconnected knowledge graph with author/publisher details and social proofs to build trust signals.
                </FeatureCard>
                <FeatureCard icon={RefreshCwIcon} title="Delta Analysis">
                    Remembers previously analyzed URLs for blazing-fast subsequent runs, only processing new or changed content.
                </FeatureCard>
            </div>
        </div>

        {/* Promotional CTA Section */}
        <div className="animate-fade-in-up" style={{ animationDelay: '600ms' }}>
            <div className="relative p-8 overflow-hidden text-center bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-2xl opacity-50"></div>
                <div className="relative">
                    <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-200 to-slate-400">Dominate Your Niche</h3>
                    <p className="mt-2 text-slate-300 max-w-xl mx-auto">Unlock your complete AI-powered SEO arsenal with our suite of professional tools.</p>
                    <a 
                        href="https://seo-hub.affiliatemarketingforsuccess.com/" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="mt-6 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    >
                        Explore the SEO Hub
                        <ArrowUpRightIcon className="ml-2 w-4 h-4" />
                    </a>
                </div>
            </div>
        </div>

    </div>
  );
};

export default Step1Credentials;