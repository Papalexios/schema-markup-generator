import React from 'react';
import { ZapIcon } from './icons/ZapIcon.tsx';

const Header: React.FC = () => {
  return (
    <header className="relative flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
        <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-500/30 rounded-full blur-3xl"></div>
        <div className="flex items-center space-x-3 z-10">
            <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg blur opacity-75"></div>
                <div className="relative bg-slate-800 p-2 rounded-lg">
                    <ZapIcon className="w-6 h-6 text-white" />
                </div>
            </div>
            <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                AI Schema Markup Generator
            </h1>
            <p className="text-sm text-slate-400">
                For WordPress
            </p>
            <p className="mt-1 block text-xs text-slate-500">
                From the creators of <a href="https://affiliatemarketingforsuccess.com" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition-colors underline-offset-2 hover:underline">AffiliateMarketingForSuccess.com</a>
            </p>
            </div>
        </div>
    </header>
  );
};

export default Header;