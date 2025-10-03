import React, { useState, useCallback } from 'react';
import {
  UrlInfo,
  WpCredentials,
  AiConfig,
  BusinessInfo,
  SchemaStatus,
  SchemaType,
  GenerationStatus,
  ValidationStatus,
  Toast,
  SitemapGroup,
} from './types';
import { validateWpCredentials, fetchAndParseSitemap, analyzeUrl, injectSchema } from './services/wordpressService';
import { validateApiKey, suggestSchemaTypes, generateSchema, categorizeSitemaps, detectSchemaOpportunities, auditAndUpgradeSchema } from './services/aiService';
import { validateSchemaClientSide } from './services/validationService';

import Header from './components/Header';
import Step1Credentials from './components/Step1Credentials';
import StepSitemapSelection from './components/StepSitemapSelection';
import Step2UrlList from './components/Step2UrlList';
import Step3Review from './components/Step3Review';
import Step4Complete from './components/Step4Complete';
import ToastContainer from './components/common/Toast';
import Spinner from './components/common/Spinner';

type AppStep = 'credentials' | 'sitemap-selection' | 'url-list' | 'review' | 'complete';

const Footer: React.FC = () => (
    <footer className="text-center py-10 mt-20 border-t border-slate-800 animate-fade-in-up" style={{ animationDelay: '800ms' }}>
        <div className="flex flex-col items-center space-y-6">
            <a href="https://affiliatemarketingforsuccess.com" target="_blank" rel="noopener noreferrer" className="block">
                <img 
                    src="https://affiliatemarketingforsuccess.com/wp-content/uploads/2023/03/cropped-Affiliate-Marketing-for-Success-Logo-Edited.png?lm=6666FEE0"
                    alt="Affiliate Marketing for Success Logo"
                    className="h-12 w-auto mx-auto transition-transform duration-300 hover:scale-105"
                />
            </a>
            <div className="text-center">
                <p className="text-sm text-slate-400">
                    This App is Created by <span className="font-semibold text-slate-300">Alexios Papaioannou,</span>
                </p>
                <p className="text-sm text-slate-400">
                    Owner of <a href="https://affiliatemarketingforsuccess.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-300 hover:text-indigo-400 transition-colors underline-offset-2 hover:underline">affiliatemarketingforsuccess.com</a>
                </p>
            </div>
            <div className="flex justify-center items-center flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                <a href="https://affiliatemarketingforsuccess.com/affiliate-marketing" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition-colors">Affiliate Marketing</a>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <a href="https://affiliatemarketingforsuccess.com/ai" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition-colors">AI</a>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <a href="https://affiliatemarketingforsuccess.com/seo" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition-colors">SEO</a>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <a href="https://affiliatemarketingforsuccess.com/blogging" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition-colors">Blogging</a>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <a href="https://affiliatemarketingforsuccess.com/review" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition-colors">Reviews</a>
            </div>
        </div>
    </footer>
);

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('credentials');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [wpCreds, setWpCreds] = useState<WpCredentials | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  
  const [sitemapGroups, setSitemapGroups] = useState<SitemapGroup[]>([]);
  const [categorizedSitemaps, setCategorizedSitemaps] = useState<{primary: SitemapGroup[], secondary: SitemapGroup[]}>({ primary: [], secondary: [] });

  const [urlList, setUrlList] = useState<UrlInfo[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [injectionResults, setInjectionResults] = useState<UrlInfo[]>([]);
  
  const [isBulkValidationVisible, setIsBulkValidationVisible] = useState(false);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const handleConnect = async (creds: WpCredentials, config: AiConfig, bInfo: BusinessInfo, isAutoPilot: boolean) => {
    setIsLoading(true);
    setError(null);
    setLoadingMessage('Validating credentials...');

    try {
        const [wpValid, aiValid] = await Promise.all([
            validateWpCredentials(creds),
            validateApiKey(config),
        ]);

        if (!wpValid) throw new Error('Invalid WordPress credentials or URL. Ensure the REST API is enabled and Application Password is correct.');
        if (!aiValid) throw new Error('Invalid AI Provider API Key.');
        
        addToast('Credentials validated successfully!', 'success');
        setWpCreds(creds);
        setAiConfig(config);
        setBusinessInfo(bInfo);

        if (isAutoPilot) {
            await runAutoPilot(creds, config, bInfo);
        } else {
            await runManualCrawl(creds, config);
        }

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
        setError(errorMessage);
        addToast(errorMessage, 'error');
        setIsLoading(false);
        setLoadingMessage('');
    }
  };

  const runManualCrawl = async (creds: WpCredentials, config: AiConfig) => {
      const groups = await fetchAndParseSitemap(creds, (msg) => setLoadingMessage(msg));
      
      if (groups.length === 0) {
        throw new Error('No sitemaps or URLs found. Please check your sitemap URL and ensure it is accessible.');
      }
      
      setSitemapGroups(groups);
      
      setLoadingMessage('AI is categorizing sitemaps...');
      const categorized = await categorizeSitemaps(groups, config);
      setCategorizedSitemaps(categorized);
      addToast('Sitemaps categorized by AI.', 'success');

      setStep('sitemap-selection');
      setIsLoading(false);
      setLoadingMessage('');
  }

  const runAutoPilot = async (creds: WpCredentials, config: AiConfig, bInfo: BusinessInfo) => {
    // 1. Crawl all sitemaps
    const allGroups = await fetchAndParseSitemap(creds, (msg) => setLoadingMessage(msg));
    if (allGroups.length === 0) throw new Error('No sitemaps or URLs found.');
    const allUrls = [...new Set(allGroups.flatMap(g => g.urls))];
    addToast(`Found ${allUrls.length} total URLs.`, 'success');
    
    // 2. Analyze all URLs
    const analyzedUrls = await performAnalysis(allUrls, creds.siteUrl, config);
    const urlsToProcess = analyzedUrls.filter(u => u.schemaStatus === SchemaStatus.NotFound || u.schemaStatus === SchemaStatus.AuditRecommended);
    if (urlsToProcess.length === 0) {
        addToast('Automation complete. No URLs needed schema generation or auditing.', 'success');
        setInjectionResults([]);
        setStep('complete');
        setIsLoading(false);
        return;
    }

    addToast(`Found ${urlsToProcess.length} URLs for processing.`, 'success');

    // 3 & 4: Suggest types and update list (already part of performAnalysis)
    const urlsToGenerate = analyzedUrls.filter(u => urlsToProcess.some(p => p.url === u.url));

    // 5. Generate schema for all
    setLoadingMessage(`Generating schema for ${urlsToGenerate.length} URLs...`);
    const generatedUrlList = await performGeneration(urlsToGenerate, config, bInfo);

    // 6. Client-side validation (already part of performGeneration)
    const validSchemas = generatedUrlList.filter(u => u.validationStatus === ValidationStatus.Valid && u.schema);
    if (validSchemas.length === 0) {
        addToast('Automation complete. No valid schemas were generated for injection.', 'success');
        setInjectionResults(generatedUrlList); // Show failures
        setStep('complete');
        setIsLoading(false);
        return;
    }
    
    addToast(`Generated ${validSchemas.length} valid schemas. Starting injection...`, 'success');

    // 7. Inject all valid schemas
    const finalResults = await performInjection(validSchemas, creds);
    setInjectionResults(finalResults);
    setStep('complete');
    setIsLoading(false);
    setLoadingMessage('');
  }
  
  const performAnalysis = async (urlsToAnalyze: string[], siteUrl: string, config: AiConfig): Promise<UrlInfo[]> => {
      setLoadingMessage(`Analyzing ${urlsToAnalyze.length} URLs... (This may take a while)`);
      const CONCURRENCY_LIMIT = 10;
      let analysisResults: UrlInfo[] = [];
      let processedCount = 0;

      for (let i = 0; i < urlsToAnalyze.length; i += CONCURRENCY_LIMIT) {
          const batch = urlsToAnalyze.slice(i, i + CONCURRENCY_LIMIT);
          const promises = batch.map(url => analyzeUrl(url, siteUrl));
          const batchResults = await Promise.all(promises);
          analysisResults.push(...batchResults);
          processedCount += batch.length;
          setLoadingMessage(`Analyzed ${Math.min(processedCount, urlsToAnalyze.length)} of ${urlsToAnalyze.length} URLs...`);
      }

      const foundCount = analysisResults.filter(u => u.schemaStatus === SchemaStatus.Found || u.schemaStatus === SchemaStatus.Cached).length;
      const auditCount = analysisResults.filter(u => u.schemaStatus === SchemaStatus.AuditRecommended).length;
      const notFoundCount = analysisResults.filter(u => u.schemaStatus === SchemaStatus.NotFound).length;
      addToast(`Analysis: ${notFoundCount} missing, ${auditCount} to audit, ${foundCount} already have schema.`);

      setLoadingMessage('AI is suggesting schema types...');
      const urlsToSuggest = analysisResults.filter(u => u.schemaStatus === SchemaStatus.NotFound && u.title !== 'Failed to analyze URL').map(u => ({ url: u.url, title: u.title }));
      let suggestions: { [url: string]: SchemaType } = {};
      if (urlsToSuggest.length > 0) {
        suggestions = await suggestSchemaTypes(urlsToSuggest, config);
      }

      setLoadingMessage('AI is detecting schema opportunities...');
      const opportunities: { [url: string]: SchemaType[] } = {};
      const urlsForOpportunityCheck = analysisResults.filter(u => u.schemaStatus === SchemaStatus.NotFound && u.content);
      for (const urlInfo of urlsForOpportunityCheck) {
          opportunities[urlInfo.url] = await detectSchemaOpportunities(urlInfo.content!, config);
      }

      return analysisResults.map(u => ({
        ...u,
        selectedSchemaType: suggestions[u.url] || SchemaType.Article,
        opportunities: opportunities[u.url] || [],
        generationStatus: GenerationStatus.NotStarted,
        validationStatus: ValidationStatus.NotValidated,
      }));
  }

  const handleStartAnalysis = async (urlsToAnalyze: string[]) => {
    if (urlsToAnalyze.length === 0) {
        addToast('No URLs selected for analysis.', 'error');
        return;
    }
    if (!wpCreds || !aiConfig) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const finalUrlList = await performAnalysis(urlsToAnalyze, wpCreds.siteUrl, aiConfig);
      setUrlList(finalUrlList);
      setStep('url-list');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(errorMessage);
      addToast(errorMessage, 'error');
      setStep('credentials');
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  };

  const performGeneration = async (urlsToGenerate: UrlInfo[], config: AiConfig, bInfo: BusinessInfo | null): Promise<UrlInfo[]> => {
      let currentList = [...urlsToGenerate];
      setGenerationProgress({ current: 0, total: urlsToGenerate.length });

      for (const urlInfo of urlsToGenerate) {
          try {
              let schema;
              if (urlInfo.schemaStatus === SchemaStatus.AuditRecommended) {
                  schema = await auditAndUpgradeSchema(urlInfo, config, bInfo || undefined);
              } else {
                  schema = await generateSchema(urlInfo, config, bInfo || undefined);
              }

              const validationResult = validateSchemaClientSide(schema, urlInfo.selectedSchemaType);
              
              currentList = currentList.map(u => u.url === urlInfo.url ? { 
                ...u, 
                schema,
                generationStatus: GenerationStatus.Success,
                validationStatus: validationResult.isValid ? ValidationStatus.Valid : ValidationStatus.Invalid,
                validationErrors: validationResult.errors,
                validationWarnings: validationResult.warnings,
              } : u);

          } catch (e) {
              const errorMessage = e instanceof Error ? e.message : 'Schema generation failed.';
              currentList = currentList.map(u => u.url === urlInfo.url ? { ...u, generationStatus: GenerationStatus.Failed, generationError: errorMessage } : u);
              addToast(`Failed to generate/audit schema for ${urlInfo.url}`, 'error');
          } finally {
              setGenerationProgress(prev => ({ ...prev, current: prev.current + 1 }));
          }
      }
      return currentList;
  };

  const handleGenerateSchema = async () => {
    if (!aiConfig || !businessInfo) return;
    const urlsToGenerate = urlList.filter(u => selectedUrls.has(u.url));
    setGenerationProgress({ current: 0, total: urlsToGenerate.length });
    setStep('review');

    // Set generating status immediately for UI feedback
    setUrlList(prev => prev.map(u => 
      selectedUrls.has(u.url) ? { ...u, generationStatus: GenerationStatus.Generating } : u
    ));

    // Awaits the full generation process, then updates the final list
    const finalGeneratedList = await performGeneration(
      urlList.filter(u => selectedUrls.has(u.url)), 
      aiConfig, 
      businessInfo
    );
    
    setUrlList(prev => prev.map(u => finalGeneratedList.find(fu => fu.url === u.url) || u));
  };
  
  const handleUpdateSchema = useCallback((url: string, schema: object | null) => {
    setUrlList(prevList => {
      const newList = prevList.map(u => u.url === url ? {...u, schema } : u);
      const urlInfo = newList.find(u => u.url === url);
      
      if (urlInfo) {
        const validationResult = validateSchemaClientSide(schema, urlInfo.selectedSchemaType);
        return newList.map(u => u.url === url ? {
          ...u,
          validationStatus: validationResult.isValid ? ValidationStatus.Valid : ValidationStatus.Invalid,
          validationErrors: validationResult.errors,
          validationWarnings: validationResult.warnings,
        } : u);
      }
      return newList;
    });
  }, []);

  const performInjection = async (schemasToInject: UrlInfo[], creds: WpCredentials): Promise<UrlInfo[]> => {
      setLoadingMessage(`Starting injection for ${schemasToInject.length} schemas...`);
      const BATCH_SIZE = 5;
      const allResults: UrlInfo[] = [];
      let processedCount = 0;

      for (let i = 0; i < schemasToInject.length; i += BATCH_SIZE) {
          const batch = schemasToInject.slice(i, i + BATCH_SIZE);
          const currentBatchNumber = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(schemasToInject.length / BATCH_SIZE);
          setLoadingMessage(`Injecting batch ${currentBatchNumber}/${totalBatches}...`);

          const promises = batch.map(urlInfo => 
              injectSchema(creds, urlInfo.url, urlInfo.schema!)
                  .then(result => ({ ...urlInfo, injectionStatus: result.success ? 'success' as const : 'failed' as const, injectionError: result.error }))
                  .catch(e => ({ ...urlInfo, injectionStatus: 'failed' as const, injectionError: e instanceof Error ? e.message : 'Unknown error' }))
          );

          const batchResults = await Promise.all(promises);
          allResults.push(...batchResults);
          processedCount += batch.length;
      }
      return allResults;
  };

  const handleInject = async () => {
    if (!wpCreds) return;
    const schemasToInject = urlList.filter(u => selectedUrls.has(u.url) && u.validationStatus === ValidationStatus.Valid && u.schema);
    
    setIsLoading(true);
    addToast(`Starting injection for ${schemasToInject.length} schemas...`, 'success');
    
    const results = await performInjection(schemasToInject, wpCreds);
    setInjectionResults(results);
    setStep('complete');
    setIsLoading(false);
    setLoadingMessage('');
  };
  
  const handleRestart = () => {
      setStep('credentials');
      setIsLoading(false);
      setError(null);
      setWpCreds(null);
      setAiConfig(null);
      setBusinessInfo(null);
      setSitemapGroups([]);
      setCategorizedSitemaps({ primary: [], secondary: [] });
      setUrlList([]);
      setSelectedUrls(new Set());
      setGenerationProgress({ current: 0, total: 0 });
      setInjectionResults([]);
  }

  const renderStep = () => {
    switch (step) {
      case 'credentials':
        return <Step1Credentials onConnect={handleConnect} isLoading={isLoading} error={error} />;
      case 'sitemap-selection':
        return <StepSitemapSelection categorizedSitemaps={categorizedSitemaps} onAnalyze={handleStartAnalysis} onBack={handleRestart} />;
      case 'url-list':
        return <Step2UrlList urls={urlList} selectedUrls={selectedUrls} setSelectedUrls={setSelectedUrls} onGenerate={handleGenerateSchema} onSchemaTypeChange={(url, type) => setUrlList(prev => prev.map(u => u.url === url ? {...u, selectedSchemaType: type} : u))} />;
      case 'review':
        return <Step3Review 
                  urls={urlList.filter(u => selectedUrls.has(u.url))} 
                  progress={generationProgress} 
                  onInject={handleInject} 
                  onBack={() => setStep('url-list')} 
                  onUpdateSchema={handleUpdateSchema}
                  onBulkValidate={() => setIsBulkValidationVisible(true)}
                  isBulkValidationVisible={isBulkValidationVisible}
                />;
      case 'complete':
        return <Step4Complete results={injectionResults} onRestart={handleRestart} />;
    }
  };

  return (
    <div className="bg-slate-900 min-h-screen text-slate-200 font-sans p-4 sm:p-8">
        <ToastContainer toasts={toasts} />
        <div className="max-w-4xl mx-auto space-y-8">
            <Header />
            <main>
                {isLoading && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                        <Spinner />
                        <p className="mt-4 text-lg text-slate-300">{loadingMessage || 'Processing...'}</p>
                    </div>
                )}
                {renderStep()}
            </main>
            <Footer />
        </div>
    </div>
  );
};

export default App;