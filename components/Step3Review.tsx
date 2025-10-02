import React from 'react';
// FIX: Import `GenerationStatus` to resolve TypeScript error.
import { UrlInfo, ValidationStatus, GenerationStatus } from '../types.ts';
import Button from './common/Button.tsx';
import Card from './common/Card.tsx';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon.tsx';
import { UploadCloudIcon } from './icons/UploadCloudIcon.tsx';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon.tsx';
import SchemaEditor from './SchemaEditor.tsx';

interface Step3ReviewProps {
  urls: UrlInfo[];
  progress: { current: number; total: number };
  onInject: () => void;
  onBack: () => void;
  onUpdateSchema: (url: string, schema: object | null) => void;
}

const Step3Review: React.FC<Step3ReviewProps> = ({ urls, progress, onInject, onBack, onUpdateSchema }) => {
  const isComplete = progress.current === progress.total;
  const validCount = urls.filter(u => u.validationStatus === ValidationStatus.Valid).length;
  const invalidCount = urls.filter(u => u.validationStatus !== ValidationStatus.Valid && u.generationStatus === GenerationStatus.Success).length;
  const canInject = isComplete && validCount > 0;
  
  const getButtonTitle = () => {
      if (!isComplete) return 'Waiting for all schemas to be generated and validated...';
      if (validCount === 0) return 'No valid schemas to inject.';
      if (invalidCount > 0) return `Will inject ${validCount} valid schema(s). Invalid ones will be skipped.`;
      return 'Inject into WordPress';
  };

  return (
    <Card>
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white">4. Review & Validate Schema</h2>
        <p className="mt-2 text-slate-400">
          The app performs an initial validation for common errors. For definitive results, use the <span className="font-semibold text-slate-300">"Validate with Google"</span> button on each schema.
        </p>
        
        {progress.total > 0 && (
          <div className="mt-4">
            <div className="flex justify-between mb-1">
              <span className="text-base font-medium text-indigo-300">Generation & Initial Validation</span>
              <span className="text-sm font-medium text-indigo-300">{progress.current} of {progress.total}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5">
              <div 
                className="bg-indigo-500 h-2.5 rounded-full transition-all duration-500" 
                style={{width: `${(progress.current / progress.total) * 100}%`}}
              ></div>
            </div>
            {isComplete && (
                <div className="mt-3 flex items-center justify-end space-x-4 text-sm">
                    <span className="font-medium text-green-400">{validCount} Passed</span>
                    <span className="font-medium text-red-400">{invalidCount} Failed</span>
                </div>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-slate-700 p-6 space-y-4 max-h-[60vh] overflow-y-auto">
        {urls.map(urlInfo => (
          <SchemaEditor key={urlInfo.url} urlInfo={urlInfo} onSchemaChange={onUpdateSchema} />
        ))}
      </div>
      <div className="border-t border-slate-700 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <Button onClick={onBack} variant="secondary">
          <ArrowLeftIcon className="mr-2 w-5 h-5" />
          Back to Selection
        </Button>
        <div className="relative">
            <Button onClick={onInject} disabled={!canInject} title={getButtonTitle()}>
              {isComplete ? `Inject ${validCount} Valid Schema(s)` : 'Waiting for Generation...'}
              <UploadCloudIcon className="ml-2 w-5 h-5" />
            </Button>
            {isComplete && invalidCount > 0 && validCount > 0 && (
                <div className="absolute -top-2 -right-2">
                    {/* FIX: Wrap icon in a span with a title attribute to fix TypeScript error, as the 'title' prop is not a valid SVG attribute in React's SVG typings. */}
                    <span title={`${invalidCount} schema(s) are invalid and will be skipped.`}>
                      <AlertTriangleIcon className="w-5 h-5 text-yellow-400"/>
                    </span>
                </div>
            )}
        </div>
      </div>
    </Card>
  );
};

export default Step3Review;