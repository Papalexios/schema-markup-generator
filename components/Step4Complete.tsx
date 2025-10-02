import React from 'react';
import { UrlInfo } from '../types.ts';
import Button from './common/Button.tsx';
import Card from './common/Card.tsx';
import { CheckCircleIcon } from './icons/CheckCircleIcon.tsx';
import { XCircleIcon } from './icons/XCircleIcon.tsx';
import { RefreshCwIcon } from './icons/RefreshCwIcon.tsx';

interface Step4CompleteProps {
  results: UrlInfo[];
  onRestart: () => void;
}

const Step4Complete: React.FC<Step4CompleteProps> = ({ results, onRestart }) => {
  const successfulInjections = results.filter(r => r.injectionStatus === 'success');
  const failedInjections = results.filter(r => r.injectionStatus === 'failed');

  return (
    <Card>
      <div className="p-6 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-900">
            <CheckCircleIcon className="h-7 w-7 text-green-400" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-white">Injection Complete</h2>
        <p className="mt-2 text-slate-400">
          Successfully injected schema for <span className="font-bold text-green-400">{successfulInjections.length}</span> URL(s).
          {failedInjections.length > 0 && ` Failed to inject for ${failedInjections.length} URL(s).`}
        </p>
      </div>
      
      {(successfulInjections.length > 0 || failedInjections.length > 0) && (
        <div className="border-t border-slate-700 p-6 max-h-[50vh] overflow-y-auto">
          <h3 className="text-lg font-medium text-slate-200 mb-4">Injection Details:</h3>
          <ul className="space-y-3">
            {results.map(urlInfo => (
              <li key={urlInfo.url} className="p-3 bg-slate-800 rounded-md flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-300 truncate" title={urlInfo.url}>{urlInfo.url}</p>
                  {urlInfo.injectionStatus === 'failed' && (
                    <p className="text-xs text-red-400 mt-1">{urlInfo.injectionError || 'An unknown error occurred.'}</p>
                  )}
                </div>
                {urlInfo.injectionStatus === 'success' && <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0 ml-4" />}
                {urlInfo.injectionStatus === 'failed' && <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 ml-4" />}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-slate-700 p-6 flex justify-center bg-slate-800/50 rounded-b-lg">
        <Button onClick={onRestart} variant="secondary">
          <RefreshCwIcon className="mr-2 w-5 h-5" />
          Start Over
        </Button>
      </div>
    </Card>
  );
};

export default Step4Complete;
