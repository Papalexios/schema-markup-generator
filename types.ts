export enum SchemaStatus {
  Unknown = 'Unknown',
  Found = 'Schema Found',
  NotFound = 'Schema Not Found',
  AnalysisFailed = 'Analysis Failed',
  AuditRecommended = 'Audit Recommended',
  Cached = 'Cached (Schema Found)',
}

export enum SchemaType {
  Article = 'Article',
  Product = 'Product',
  Recipe = 'Recipe',
  LocalBusiness = 'LocalBusiness',
  Organization = 'Organization',
  WebPage = 'WebPage',
  FAQPage = 'FAQPage',
  HowTo = 'HowTo',
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

export interface ValidationDetail {
    code: 'MISSING_REQUIRED' | 'MISSING_RECOMMENDED' | 'INVALID_STRUCTURE' | 'INVALID_FORMAT' | 'MISSING_PRIMARY_ENTITY' | 'GENERIC_ERROR';
    message: string;
    property?: string;
}


export interface UrlInfo {
  url: string;
  title: string;
  schemaStatus: SchemaStatus;
  selectedSchemaType: SchemaType;
  content?: string;
  schema?: object | null;
  existingSchema?: object | null;
  opportunities?: SchemaType[];
  generationStatus: GenerationStatus;
  validationStatus: ValidationStatus;
  validationErrors?: ValidationDetail[];
  validationWarnings?: ValidationDetail[];
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
