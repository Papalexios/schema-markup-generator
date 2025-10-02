import React, { useState, useEffect, useRef } from 'react';
import { UrlInfo, GenerationStatus, ValidationStatus } from '../types.ts';
import Spinner from './common/Spinner.tsx';
import Button from './common/Button.tsx';
import { CheckCircleIcon } from './icons/CheckCircleIcon.tsx';
import { XCircleIcon } from './icons/XCircleIcon.tsx';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon.tsx';
import { ClipboardIcon } from './icons/ClipboardIcon.tsx';
import { ExternalLinkIcon } from './icons/ExternalLinkIcon.tsx';

interface SchemaEditorProps {
  urlInfo: UrlInfo;
  onSchemaChange: (url: string, newSchema: object | null) => void;
}

const StatusBadge: React.FC<{ status: ValidationStatus }> = ({ status }) => {
    switch(status) {
        case ValidationStatus.Valid:
            return <div className="flex items-center px-2 py-1 text-xs rounded-full bg-green-900 text-green-300"><CheckCircleIcon className="w-4 h-4 mr-1" />Validation: Passed</div>;
        case ValidationStatus.Invalid:
            return <div className="flex items-center px-2 py-1 text-xs rounded-full bg-red-900 text-red-300"><XCircleIcon className="w-4 h-4 mr-1" />Validation: Failed</div>;
        case ValidationStatus.Validating:
             return <div className="flex items-center px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300"><Spinner />Validating...</div>;
        default:
            return null;
    }
};

const SchemaEditor: React.FC<SchemaEditorProps> = ({ urlInfo, onSchemaChange }) => {
  const [jsonString, setJsonString] = useState('');
  const [copyButtonText, setCopyButtonText] = useState('Copy Schema');
  const [isJsonSyntaxValid, setIsJsonSyntaxValid] = useState(true);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (urlInfo.schema) {
      const formattedJson = JSON.stringify(urlInfo.schema, null, 2);
      setJsonString(formattedJson);
      setIsJsonSyntaxValid(true);
    } else {
      setJsonString('');
    }
  }, [urlInfo.schema]);
  
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(jsonString).then(() => {
        setCopyButtonText('Copied!');
        setTimeout(() => setCopyButtonText('Copy Schema'), 2000);
    }).catch(err => {
        console.error('Failed to copy schema', err);
        setCopyButtonText('Failed to copy');
         setTimeout(() => setCopyButtonText('Copy Schema'), 2000);
    });
  };

  const handleValidateWithGoogle = () => {
      window.open('https://search.google.com/test/rich-results', '_blank');
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newJsonString = e.target.value;
    setJsonString(newJsonString);

    try {
      if (newJsonString.trim() === '') {
          setIsJsonSyntaxValid(true); // Empty is valid syntax, but validation will fail
          onSchemaChange(urlInfo.url, null);
          return;
      }
      const parsed = JSON.parse(newJsonString);
      setIsJsonSyntaxValid(true);
      onSchemaChange(urlInfo.url, parsed);
    } catch (error) {
      setIsJsonSyntaxValid(false);
      // Don't call onSchemaChange here, as it's not a valid object.
      // We can rely on a visual indicator for syntax errors.
    }
  };

  const renderContent = () => {
    switch (urlInfo.generationStatus) {
      case GenerationStatus.Generating:
        return (
          <div className="flex items-center justify-center p-4 h-48">
            <Spinner />
            <p className="ml-4 text-slate-400">Generating schema...</p>
          </div>
        );
      case GenerationStatus.Failed:
        return (
          <div className="flex items-center justify-center p-4 h-48 bg-red-900/20 text-red-300 rounded-b-lg">
            <XCircleIcon className="w-6 h-6 mr-3" />
            <div>
                <p className="font-bold">Generation Failed</p>
                <p className="text-sm">{urlInfo.generationError}</p>
            </div>
          </div>
        );
      case GenerationStatus.Success:
        return (
          <div className="relative">
             {(urlInfo.validationStatus === ValidationStatus.Invalid && urlInfo.validationErrors && urlInfo.validationErrors.length > 0) && (
                <div className="p-3 bg-red-900/20 text-red-300 text-xs border-b border-red-800">
                    <p className="font-bold mb-1">Validation Errors:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        {urlInfo.validationErrors.map((error, i) => <li key={i}>{error.message}</li>)}
                    </ul>
                </div>
             )}
             {(urlInfo.validationWarnings && urlInfo.validationWarnings.length > 0) && (
                <div className="p-3 bg-yellow-900/20 text-yellow-300 text-xs border-b border-yellow-800">
                    <p className="font-bold mb-1">Validation Warnings:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        {urlInfo.validationWarnings.map((warning, i) => <li key={i}>{warning.message}</li>)}
                    </ul>
                </div>
             )}
            <textarea
              ref={textAreaRef}
              value={jsonString}
              onChange={handleChange}
              className={`w-full h-64 p-4 font-mono text-xs bg-slate-900/70 border-none rounded-b-lg focus:ring-2 resize-y ${!isJsonSyntaxValid ? 'focus:ring-red-500 text-red-400' : 'focus:ring-indigo-500 text-slate-300'}`}
              spellCheck="false"
            />
             {!isJsonSyntaxValid && <div className="absolute bottom-2 right-2 text-xs text-red-400 bg-red-900/50 px-2 py-1 rounded">Invalid JSON</div>}
          </div>
        );
      default:
        return null;
    }
  };
  
  const getBorderColor = () => {
      if (!isJsonSyntaxValid) return 'border-red-600';
      if (urlInfo.generationStatus !== GenerationStatus.Success) return 'border-slate-700';
      switch (urlInfo.validationStatus) {
          case ValidationStatus.Valid: return 'border-green-600';
          case ValidationStatus.Invalid: return 'border-red-600';
          default: return 'border-slate-700';
      }
  }

  return (
    <div className={`bg-slate-800 rounded-lg border ${getBorderColor()}`}>
      <div className="flex justify-between items-center flex-wrap gap-2 p-3 border-b border-slate-700">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-indigo-300 truncate mr-4" title={urlInfo.url}>{urlInfo.url}</p>
        </div>
        <div className="flex items-center space-x-2">
            <StatusBadge status={urlInfo.validationStatus} />
            <button onClick={handleCopyToClipboard} className="px-2 py-1 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md transition flex items-center">
                <ClipboardIcon className="w-3 h-3 mr-1.5" />
                {copyButtonText}
            </button>
            <button onClick={handleValidateWithGoogle} title="Open Google's Rich Results Test in a new tab" className="px-2 py-1 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md transition flex items-center">
                <ExternalLinkIcon className="w-3 h-3 mr-1.5" />
                Validate with Google
            </button>
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

export default SchemaEditor;