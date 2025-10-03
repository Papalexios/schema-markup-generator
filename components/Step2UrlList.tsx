import React, { useEffect } from 'react';
import { UrlInfo, SchemaStatus, SchemaType } from '../types.ts';
import Button from './common/Button.tsx';
import Card from './common/Card.tsx';
import { ZapIcon } from './icons/ZapIcon.tsx';
import { CheckCircleIcon } from './icons/CheckCircleIcon.tsx';
import { XCircleIcon } from './icons/XCircleIcon.tsx';
import { DocumentSearchIcon } from './icons/DocumentSearchIcon.tsx';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon.tsx';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { WandSparklesIcon } from './icons/WandSparklesIcon.tsx';
import { RefreshCwIcon } from './icons/RefreshCwIcon.tsx';

interface Step2UrlListProps {
  urls: UrlInfo[];
  selectedUrls: Set<string>;
  setSelectedUrls: React.Dispatch<React.SetStateAction<Set<string>>>;
  onGenerate: () => void;
  onSchemaTypeChange: (url: string, type: SchemaType) => void;
}

const StatusInfo: React.FC<{ status: SchemaStatus }> = ({ status }) => {
  const iconMap = {
    [SchemaStatus.Found]: { icon: CheckCircleIcon, color: 'text-green-400' },
    [SchemaStatus.Cached]: { icon: RefreshCwIcon, color: 'text-sky-400' },
    [SchemaStatus.NotFound]: { icon: XCircleIcon, color: 'text-yellow-400' },
    [SchemaStatus.AuditRecommended]: { icon: DocumentSearchIcon, color: 'text-teal-400' },
    [SchemaStatus.AnalysisFailed]: { icon: AlertTriangleIcon, color: 'text-red-400' },
    [SchemaStatus.Unknown]: { icon: XCircleIcon, color: 'text-slate-500' },
  };
  const { icon: Icon, color } = iconMap[status] || iconMap[SchemaStatus.Unknown];
  return (
    <span title={status} className="flex items-center space-x-2">
      <Icon className={`w-5 h-5 ${color}`} />
      <span className={`text-xs font-semibold ${color}`}>{status}</span>
    </span>
  );
};

const UrlListItem: React.FC<{
  urlInfo: UrlInfo;
  isSelected: boolean;
  onToggle: (url: string) => void;
  onSchemaTypeChange: (url: string, type: SchemaType) => void;
}> = ({ urlInfo, isSelected, onToggle, onSchemaTypeChange }) => {
  const canBeSelected = urlInfo.schemaStatus === SchemaStatus.NotFound || urlInfo.schemaStatus === SchemaStatus.AuditRecommended;
  
  useEffect(() => {
    // If an opportunity is detected, auto-select it in the dropdown
    if (urlInfo.opportunities && urlInfo.opportunities.length > 0 && urlInfo.selectedSchemaType !== urlInfo.opportunities[0]) {
      onSchemaTypeChange(urlInfo.url, urlInfo.opportunities[0]);
    }
  }, [urlInfo.opportunities]);

  return (
    <li
      className={`p-4 rounded-md transition-all duration-200 ${
        canBeSelected ? 'hover:bg-slate-700/50 cursor-pointer' : 'opacity-60'
      } ${isSelected ? 'bg-indigo-900/50 ring-2 ring-indigo-500' : 'bg-slate-800'}`}
      onClick={() => canBeSelected && onToggle(urlInfo.url)}
      title={urlInfo.analysisError ? `Error: ${urlInfo.analysisError}` : ''}
    >
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          {canBeSelected && <input type="checkbox" checked={isSelected} onChange={() => {}} className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-indigo-600 focus:ring-indigo-500 flex-shrink-0" />}
          {!canBeSelected && <div className="w-4 h-4 flex-shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-200 truncate" title={urlInfo.title}>{urlInfo.title}</p>
            <p className="text-xs text-slate-400 truncate" title={urlInfo.url}>{urlInfo.url}</p>
            {urlInfo.schemaStatus === SchemaStatus.AnalysisFailed && <p className="text-xs text-red-400 mt-1 truncate">Reason: {urlInfo.analysisError}</p>}
          </div>
        </div>
        <div className="flex items-center flex-shrink-0 ml-auto pl-4">
          <StatusInfo status={urlInfo.schemaStatus} />
        </div>
      </div>
      {isSelected && canBeSelected && (
        <div className="mt-3 ml-8 pl-1 flex items-center space-x-4 flex-wrap gap-2">
            <div className="flex items-center">
                <label className="text-xs text-slate-400 mr-2">Action:</label>
                <select value={urlInfo.selectedSchemaType} onChange={(e) => onSchemaTypeChange(urlInfo.url, e.target.value as SchemaType)} onClick={(e) => e.stopPropagation()} className="bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-md focus:ring-indigo-500 focus:border-indigo-500 block w-auto py-1 pl-2 pr-8">
                    {Object.values(SchemaType).map(type => <option key={type} value={type}>{type}</option>)}
                </select>
            </div>
            {urlInfo.schemaStatus === SchemaStatus.NotFound && (
                <div className="flex items-center px-2 py-1 text-xs font-medium rounded-full bg-indigo-900/70 text-indigo-300">
                    <WandSparklesIcon className="w-3 h-3 mr-1.5" /> AI Suggested
                </div>
            )}
            {urlInfo.opportunities?.map(op => (
                 <div key={op} className="flex items-center px-2 py-1 text-xs font-medium rounded-full bg-teal-900/70 text-teal-300">
                    <SparklesIcon className="w-3 h-3 mr-1.5" /> {op} Opportunity
                </div>
            ))}
        </div>
      )}
    </li>
  );
};

const Step2UrlList: React.FC<Step2UrlListProps> = ({ urls, selectedUrls, setSelectedUrls, onGenerate, onSchemaTypeChange }) => {
  const toggleUrl = (url: string) => {
    setSelectedUrls(prev => {
      const newSet = new Set(prev);
      newSet.has(url) ? newSet.delete(url) : newSet.add(url);
      return newSet;
    });
  };

  const urlsToProcess = urls.filter(u => u.schemaStatus === SchemaStatus.NotFound || u.schemaStatus === SchemaStatus.AuditRecommended);
  
  const selectAll = () => setSelectedUrls(new Set(urlsToProcess.map(u => u.url)));
  const deselectAll = () => setSelectedUrls(new Set());

  const totalUrls = urls.length;
  const urlsWithFailure = urls.filter(u => u.schemaStatus === SchemaStatus.AnalysisFailed).length;

  return (
    <Card>
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white">3. Select URLs for Schema Generation</h2>
        <p className="mt-2 text-slate-400">
          Analyzed {totalUrls} URLs. Found {urlsToProcess.length} pages that can be processed.
          {urlsWithFailure > 0 && ` ${urlsWithFailure} pages could not be analyzed.`}
        </p>
      </div>
      <div className="border-t border-slate-700 p-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
          <div className="flex space-x-2 flex-wrap gap-2">
            <Button onClick={selectAll} variant="secondary" disabled={urlsToProcess.length === 0}>
              Select All Processable ({urlsToProcess.length})
            </Button>
            <Button onClick={deselectAll} variant="secondary" disabled={selectedUrls.size === 0}>
              Deselect All
            </Button>
          </div>
          <p className="text-sm text-slate-300 font-medium">{selectedUrls.size} URL(s) selected</p>
        </div>
        <ul className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
          {urls.map(urlInfo => (
            <UrlListItem key={urlInfo.url} urlInfo={urlInfo} isSelected={selectedUrls.has(urlInfo.url)} onToggle={toggleUrl} onSchemaTypeChange={onSchemaTypeChange} />
          ))}
        </ul>
      </div>
      <div className="border-t border-slate-700 p-6 flex justify-end bg-slate-800/50 rounded-b-lg">
        <Button onClick={onGenerate} disabled={selectedUrls.size === 0}>
          Generate/Audit Schema
          <ZapIcon className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </Card>
  );
};

export default Step2UrlList;
