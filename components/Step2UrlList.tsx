import React from 'react';
import { UrlInfo, SchemaStatus, SchemaType } from '../types.ts';
import Button from './common/Button.tsx';
import Card from './common/Card.tsx';
import { ZapIcon } from './icons/ZapIcon.tsx';
import { CheckCircleIcon } from './icons/CheckCircleIcon.tsx';
import { XCircleIcon } from './icons/XCircleIcon.tsx';
import { QuestionMarkCircleIcon } from './icons/QuestionMarkCircleIcon.tsx';
import { WandSparklesIcon } from './icons/WandSparklesIcon.tsx';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon.tsx';

interface Step2UrlListProps {
  urls: UrlInfo[];
  selectedUrls: Set<string>;
  setSelectedUrls: React.Dispatch<React.SetStateAction<Set<string>>>;
  onGenerate: () => void;
  onSchemaTypeChange: (url: string, type: SchemaType) => void;
}

// FIX: Wrap icons in a span with a title attribute to fix TypeScript errors, as the 'title' prop is not a valid SVG attribute in React's SVG typings.
const StatusIcon = ({ status }: { status: SchemaStatus }) => {
  switch (status) {
    case SchemaStatus.Found:
      return <span title="Schema Found"><CheckCircleIcon className="w-5 h-5 text-green-400" /></span>;
    case SchemaStatus.NotFound:
      return <span title="Schema Not Found"><XCircleIcon className="w-5 h-5 text-yellow-400" /></span>;
    case SchemaStatus.AnalysisFailed:
        return <span title="Analysis Failed"><AlertTriangleIcon className="w-5 h-5 text-red-400" /></span>;
    default:
      return <span title="Status Unknown"><QuestionMarkCircleIcon className="w-5 h-5 text-slate-500" /></span>;
  }
};

const getStatusTextClass = (status: SchemaStatus) => {
    switch (status) {
        case SchemaStatus.Found: return 'text-green-400';
        case SchemaStatus.NotFound: return 'text-yellow-400';
        case SchemaStatus.AnalysisFailed: return 'text-red-400';
        default: return 'text-slate-500';
    }
}

const UrlListItem: React.FC<{
  urlInfo: UrlInfo;
  isSelected: boolean;
  onToggle: (url: string) => void;
  onSchemaTypeChange: (url: string, type: SchemaType) => void;
}> = ({ urlInfo, isSelected, onToggle, onSchemaTypeChange }) => {
  const canBeSelected = urlInfo.schemaStatus === SchemaStatus.NotFound;
  const handleDropdownClick = (e: React.MouseEvent) => e.stopPropagation();

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
          {canBeSelected && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
            />
          )}
          {!canBeSelected && <div className="w-4 h-4 flex-shrink-0" />}

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-200 truncate" title={urlInfo.title}>{urlInfo.title}</p>
            <p className="text-xs text-slate-400 truncate" title={urlInfo.url}>{urlInfo.url}</p>
            {urlInfo.schemaStatus === SchemaStatus.AnalysisFailed && (
                 <p className="text-xs text-red-400 mt-1 truncate">Reason: {urlInfo.analysisError}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0 ml-auto pl-4">
          <StatusIcon status={urlInfo.schemaStatus} />
          <span className={`text-xs font-semibold ${getStatusTextClass(urlInfo.schemaStatus)}`}>
            {urlInfo.schemaStatus}
          </span>
        </div>
      </div>
      {isSelected && canBeSelected && (
        <div className="mt-3 ml-8 pl-1 flex items-center space-x-4 flex-wrap">
            <div className="flex items-center">
                <label htmlFor={`schema-type-${urlInfo.url}`} className="text-xs text-slate-400 mr-2">Schema Type:</label>
                <select
                    id={`schema-type-${urlInfo.url}`}
                    value={urlInfo.selectedSchemaType}
                    onChange={(e) => onSchemaTypeChange(urlInfo.url, e.target.value as SchemaType)}
                    onClick={handleDropdownClick}
                    className="bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-md focus:ring-indigo-500 focus:border-indigo-500 block w-auto py-1 pl-2 pr-8"
                >
                    {Object.values(SchemaType).map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>
            <div className="flex items-center px-2 py-1 text-xs font-medium rounded-full bg-indigo-900/70 text-indigo-300">
                <WandSparklesIcon className="w-3 h-3 mr-1.5" />
                AI Suggested
            </div>
        </div>
      )}
    </li>
  );
};

const Step2UrlList: React.FC<Step2UrlListProps> = ({ urls, selectedUrls, setSelectedUrls, onGenerate, onSchemaTypeChange }) => {
  const toggleUrl = (url: string) => {
    setSelectedUrls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(url)) {
        newSet.delete(url);
      } else {
        newSet.add(url);
      }
      return newSet;
    });
  };

  const selectAllMissing = () => {
    const allMissing = urls
      .filter(u => u.schemaStatus === SchemaStatus.NotFound)
      .map(u => u.url);
    setSelectedUrls(new Set(allMissing));
  };
  
  const deselectAll = () => {
    setSelectedUrls(new Set());
  };

  const urlsWithMissingSchema = urls.filter(u => u.schemaStatus === SchemaStatus.NotFound).length;
  const urlsWithAnalysisFailed = urls.filter(u => u.schemaStatus === SchemaStatus.AnalysisFailed).length;
  const totalUrls = urls.length;

  return (
    <Card>
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white">3. Select URLs for Schema Generation</h2>
        <p className="mt-2 text-slate-400">
          Analyzed {totalUrls} URLs. We found {urlsWithMissingSchema} pages missing schema.
          {urlsWithAnalysisFailed > 0 && ` ${urlsWithAnalysisFailed} pages could not be analyzed.`}
        </p>
      </div>
      <div className="border-t border-slate-700 p-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
          <div className="flex space-x-2 flex-wrap gap-2">
            <Button onClick={selectAllMissing} variant="secondary" disabled={urlsWithMissingSchema === 0}>
              Select All Missing ({urlsWithMissingSchema})
            </Button>
            <Button onClick={deselectAll} variant="secondary" disabled={selectedUrls.size === 0}>
              Deselect All
            </Button>
          </div>
          <p className="text-sm text-slate-300 font-medium">{selectedUrls.size} URL(s) selected</p>
        </div>
        <ul className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
          {urls.map(urlInfo => (
            <UrlListItem
              key={urlInfo.url}
              urlInfo={urlInfo}
              isSelected={selectedUrls.has(urlInfo.url)}
              onToggle={toggleUrl}
              onSchemaTypeChange={onSchemaTypeChange}
            />
          ))}
        </ul>
      </div>
      <div className="border-t border-slate-700 p-6 flex justify-end bg-slate-800/50 rounded-b-lg">
        <Button onClick={onGenerate} disabled={selectedUrls.size === 0}>
          Generate Schema with AI
          <ZapIcon className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </Card>
  );
};

export default Step2UrlList;