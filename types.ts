export enum SchemaStatus {
  Unknown = 'Unknown',
  Found = 'Schema Found',
  NotFound = 'Schema Not Found',
  AnalysisFailed = 'Analysis Failed',
}

export enum SchemaType {
  Article = 'Article',
  Product = 'Product',
  Recipe = 'Recipe',
  LocalBusiness = 'LocalBusiness',
  Organization = 'Organization',
  WebPage = 'WebPage',
  FAQPage = 'FAQPage',
  VideoObject = 'VideoObject',
}

export enum GenerationStatus {
  NotStarted = 'NotStarted',
  Generating = 'Generating',
  Success = 'Success',
  Failed = 'Failed',
}

export enum ValidationStatus {
  NotValidated = 'NotValidated',
  Validating = 'Validating',
  Valid = 'Valid',
  Invalid = 'Invalid',
}

export enum AiProvider {
    Gemini = 'Google Gemini',
    OpenAI = 'OpenAI',
    Groq = 'Groq',
    Claude = 'Anthropic Claude',
    OpenRouter = 'OpenRouter',
}

export interface SitemapGroup {
  sitemapUrl: string;
  urls: string[];
}

export interface UrlInfo {
  url: string;
  title: string;
  schemaStatus: SchemaStatus;
  selectedSchemaType: SchemaType;
  content?: string;
  schema?: object | null;
  generationStatus: GenerationStatus;
  validationStatus: ValidationStatus;
  validationErrors?: string[];
  validationWarnings?: string[];
  generationError?: string;
  analysisError?: string;
  injectionStatus?: 'pending' | 'success' | 'failed';
  injectionError?: string;
}

export interface WpCredentials {
  siteUrl: string;
  sitemapUrl?: string;
  username: string;
  appPassword: string;
}

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model?: string;
}

export interface BusinessInfo {
    name?: string;
    address?: string;
    phone?: string;
}

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}