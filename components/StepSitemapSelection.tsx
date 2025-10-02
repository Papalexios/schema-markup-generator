import React, { useState, useEffect, useMemo } from 'react';
import { SitemapGroup } from '../types.ts';
import Button from './common/Button.tsx';
import Card from './common/Card.tsx';
import { ArrowRightIcon } from './icons/ArrowRightIcon.tsx';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon.tsx';

interface StepSitemapSelectionProps {
  groups: SitemapGroup[];
  onAnalyze: (selectedUrls: string[]) => void;
  onBack: () => void;
}

const SitemapGroupItem: React.FC<{
  group: SitemapGroup;
  isSelected: boolean;
  onToggle: (sitemapUrl: string) => void;
}> = ({ group, isSelected, onToggle }) => {
  const filename = group.sitemapUrl.substring(group.sitemapUrl.lastIndexOf('/') + 1);

  return (
    <li
      className={`p-4 rounded-md transition-all duration-200 cursor-pointer flex items-center justify-between hover:bg-slate-700/50 ${isSelected ? 'bg-indigo-900/50 ring-2 ring-indigo-500' : 'bg-slate-800'}`}
      onClick={() => onToggle(group.sitemapUrl)}
    >
      <div className="flex items-center space-x-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
        />
        <div>
            <p className="font-medium text-slate-200">{filename}</p>
            <p className="text-xs text-slate-400" title={group.sitemapUrl}>{group.sitemapUrl}</p>
        </div>
      </div>
      <span className="text-sm font-semibold text-slate-300">{group.urls.length.toLocaleString()} URLs</span>
    </li>
  );
};

const StepSitemapSelection: React.FC<StepSitemapSelectionProps> = ({ groups, onAnalyze, onBack }) => {
  const [selectedSitemaps, setSelectedSitemaps] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Pre-select sitemaps that are likely to contain valuable content (posts, pages)
    const defaultSelection = new Set<string>();
    groups.forEach(group => {
      const url = group.sitemapUrl.toLowerCase();
      if (url.includes('post') || url.includes('page')) {
        defaultSelection.add(group.sitemapUrl);
      }
    });
    setSelectedSitemaps(defaultSelection);
  }, [groups]);

  const toggleSitemap = (sitemapUrl: string) => {
    setSelectedSitemaps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sitemapUrl)) {
        newSet.delete(sitemapUrl);
      } else {
        newSet.add(sitemapUrl);
      }
      return newSet;
    });
  };

  const selectAll = () => setSelectedSitemaps(new Set(groups.map(g => g.sitemapUrl)));
  const deselectAll = () => setSelectedSitemaps(new Set());

  const totalSelectedUrlCount = useMemo(() => {
    return groups
      .filter(g => selectedSitemaps.has(g.sitemapUrl))
      .reduce((sum, group) => sum + group.urls.length, 0);
  }, [groups, selectedSitemaps]);

  const handleSubmit = () => {
    const urlsToAnalyze = groups
      .filter(g => selectedSitemaps.has(g.sitemapUrl))
      .flatMap(g => g.urls);
    const uniqueUrls = [...new Set(urlsToAnalyze)]; // De-duplicate just in case
    onAnalyze(uniqueUrls);
  };

  const totalUrlCount = useMemo(() => groups.reduce((sum, g) => sum + g.urls.length, 0), [groups]);

  return (
    <Card>
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white">2. Select Content to Analyze</h2>
        <p className="mt-2 text-slate-400">
          We found {totalUrlCount.toLocaleString()} URLs across {groups.length} sitemaps. Select which groups you'd like to analyze for schema opportunities.
        </p>
      </div>
      <div className="border-t border-slate-700 p-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
          <div className="flex space-x-2 flex-wrap gap-2">
            <Button onClick={selectAll} variant="secondary">Select All ({groups.length})</Button>
            <Button onClick={deselectAll} variant="secondary" disabled={selectedSitemaps.size === 0}>Deselect All</Button>
          </div>
          <p className="text-sm text-slate-300 font-medium">{totalSelectedUrlCount.toLocaleString()} URL(s) selected</p>
        </div>
        <ul className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
          {groups.map(group => (
            <SitemapGroupItem
              key={group.sitemapUrl}
              group={group}
              isSelected={selectedSitemaps.has(group.sitemapUrl)}
              onToggle={toggleSitemap}
            />
          ))}
        </ul>
      </div>
      <div className="border-t border-slate-700 p-6 flex justify-between items-center bg-slate-800/50 rounded-b-lg">
        <Button onClick={onBack} variant="secondary">
          <ArrowLeftIcon className="mr-2 w-5 h-5" />
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={totalSelectedUrlCount === 0}>
          Analyze {totalSelectedUrlCount.toLocaleString()} URLs
          <ArrowRightIcon className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </Card>
  );
};

export default StepSitemapSelection;
