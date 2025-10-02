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
import { validateApiKey, suggestSchemaTypes, generateSchema } from './services/aiService';
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

  const handleCrawl = async (creds: WpCredentials, config: AiConfig, bInfo: BusinessInfo) => {
    setIsLoading(true);
    setLoadingMessage('Validating credentials...');
    setError(null);
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

      const groups = await fetchAndParseSitemap(creds, (msg) => setLoadingMessage(msg));
      
      if (groups.length === 0) {
        throw new Error('No sitemaps or URLs found. Please check your sitemap URL and ensure it is accessible.');
      }

      setSitemapGroups(groups);
      setStep('sitemap-selection');

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };
  
  const handleStartAnalysis = async (urlsToAnalyze: string[]) => {
    if (urlsToAnalyze.length === 0) {
        addToast('No URLs selected for analysis.', 'error');
        return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
       // --- High-Speed Parallel Analysis ---
      setLoadingMessage(`Analyzing ${urlsToAnalyze.length} URLs for existing schema...`);
      const CONCURRENCY_LIMIT = 10;
      const analysisResults: (Awaited<ReturnType<typeof analyzeUrl>>)[] = [];
      let processedCount = 0;

      for (let i = 0; i < urlsToAnalyze.length; i += CONCURRENCY_LIMIT) {
          const batch = urlsToAnalyze.slice(i, i + CONCURRENCY_LIMIT);
          const promises = batch.map(url => analyzeUrl(url));
          const batchResults = await Promise.allSettled(promises);
          
          batchResults.forEach(result => {
              if (result.status === 'fulfilled') {
                  analysisResults.push(result.value);
              } else if (result.status === 'rejected') {
                  // This case should ideally not happen as analyzeUrl catches its own errors.
                  // But as a fallback, we can log it.
                  console.error("A critical, unhandled error occurred in analyzeUrl:", result.reason);
              }
          });
          
          processedCount += batch.length;
          setLoadingMessage(`Analyzed ${Math.min(processedCount, urlsToAnalyze.length)} of ${urlsToAnalyze.length} URLs...`);
      }

      const urlsWithStatus = analysisResults;
      const notFoundCount = urlsWithStatus.filter(u => u.schemaStatus === SchemaStatus.NotFound).length;
      const failedCount = urlsWithStatus.filter(u => u.schemaStatus === SchemaStatus.AnalysisFailed).length;
      addToast(`Analysis complete. Found ${notFoundCount} URLs missing schema. ${failedCount} URLs failed to analyze.`, 'success');
      
      setLoadingMessage('AI is suggesting schema types...');
      const urlsToSuggest = urlsWithStatus
        .filter(u => u.schemaStatus === SchemaStatus.NotFound && u.title !== 'Failed to analyze URL')
        .map(u => ({ url: u.url, title: u.title }));

      let suggestions: { [url: string]: SchemaType } = {};
      if (urlsToSuggest.length > 0 && aiConfig) {
        suggestions = await suggestSchemaTypes(urlsToSuggest, aiConfig);
        addToast(`AI suggested schema types for ${Object.keys(suggestions).length} URLs.`, 'success');
      }

      const finalUrlList = urlsWithStatus.map(u => ({
        ...u,
        selectedSchemaType: suggestions[u.url] || SchemaType.Article,
        generationStatus: GenerationStatus.NotStarted,
        validationStatus: ValidationStatus.NotValidated,
      }));

      setUrlList(finalUrlList);
      setStep('url-list');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(errorMessage);
      addToast(errorMessage, 'error');
      setStep('credentials'); // Go back to start on major analysis failure
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  };

  const handleGenerateSchema = async () => {
    if (!aiConfig) return;
    const urlsToGenerate = urlList.filter(u => selectedUrls.has(u.url));
    setGenerationProgress({ current: 0, total: urlsToGenerate.length });
    setStep('review');

    setUrlList(prev => prev.map(u => 
      selectedUrls.has(u.url) ? { ...u, generationStatus: GenerationStatus.Generating, validationStatus: ValidationStatus.NotValidated } : u
    ));

    for (const urlInfo of urlsToGenerate) {
      try {
        const schema = await generateSchema(urlInfo, aiConfig, businessInfo || undefined);
        const validationResult = validateSchemaClientSide(schema, urlInfo.selectedSchemaType);
        
        setUrlList(prev => prev.map(u => u.url === urlInfo.url ? { 
          ...u, 
          schema,
          generationStatus: GenerationStatus.Success,
          validationStatus: validationResult.isValid ? ValidationStatus.Valid : ValidationStatus.Invalid,
          validationErrors: validationResult.errors,
          validationWarnings: validationResult.warnings,
        } : u));

      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Schema generation failed.';
        setUrlList(prev => prev.map(u => u.url === urlInfo.url ? { ...u, generationStatus: GenerationStatus.Failed, generationError: errorMessage } : u));
        addToast(`Failed to generate schema for ${urlInfo.url}`, 'error');
      } finally {
        setGenerationProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
    }
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

  const handleInject = async () => {
    if (!wpCreds) return;
    const schemasToInject = urlList.filter(u => selectedUrls.has(u.url) && u.validationStatus === ValidationStatus.Valid && u.schema);
    
    setIsLoading(true);
    setLoadingMessage(`Starting injection for ${schemasToInject.length} schemas...`);
    addToast(`Starting injection for ${schemasToInject.length} schemas...`, 'success');
    
    const BATCH_SIZE = 5;
    const allResults: UrlInfo[] = [];
    let processedCount = 0;

    for (let i = 0; i < schemasToInject.length; i += BATCH_SIZE) {
        const batch = schemasToInject.slice(i, i + BATCH_SIZE);
        const currentBatchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(schemasToInject.length / BATCH_SIZE);

        setLoadingMessage(`Injecting batch ${currentBatchNumber} of ${totalBatches}... (${processedCount} of ${schemasToInject.length})`);

        const promises = batch.map(urlInfo => 
            injectSchema(wpCreds, urlInfo.url, urlInfo.schema!)
                .then(result => ({ ...urlInfo, injectionStatus: result.success ? 'success' as const : 'failed' as const, injectionError: result.error }))
                .catch(e => ({ ...urlInfo, injectionStatus: 'failed' as const, injectionError: e instanceof Error ? e.message : 'Unknown error' }))
        );

        const batchResults = await Promise.all(promises);
        allResults.push(...batchResults);
        processedCount += batch.length;
    }

    setInjectionResults(allResults);
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
      setUrlList([]);
      setSelectedUrls(new Set());
      setGenerationProgress({ current: 0, total: 0 });
      setInjectionResults([]);
  }

  const renderStep = () => {
    switch (step) {
      case 'credentials':
        return <Step1Credentials onConnect={handleCrawl} isLoading={isLoading} error={error} />;
      case 'sitemap-selection':
        return <StepSitemapSelection groups={sitemapGroups} onAnalyze={handleStartAnalysis} onBack={handleRestart} />;
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
        </div>
    </div>
  );
};

export default App;