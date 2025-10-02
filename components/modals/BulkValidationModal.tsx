import React, { useState } from 'react';
import { UrlInfo, ValidationStatus } from '../../types.ts';
import Modal from '../common/Modal.tsx';
import { ClipboardIcon } from '../icons/ClipboardIcon.tsx';
import { ExternalLinkIcon } from '../icons/ExternalLinkIcon.tsx';
import { CheckCircleIcon } from '../icons/CheckCircleIcon.tsx';
import { XCircleIcon } from '../icons/XCircleIcon.tsx';

interface BulkValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  urls: UrlInfo[];
}

const ValidationStatusPill: React.FC<{ status: ValidationStatus }> = ({ status }) => {
    if (status === ValidationStatus.Valid) {
        return <div className="flex items-center text-xs font-medium text-green-300 bg-green-900/50 px-2 py-1 rounded-full"><CheckCircleIcon className="w-4 h-4 mr-1.5" />Passed</div>
    }
    if (status === ValidationStatus.Invalid) {
        return <div className="flex items-center text-xs font-medium text-red-300 bg-red-900/50 px-2 py-1 rounded-full"><XCircleIcon className="w-4 h-4 mr-1.5" />Failed</div>
    }
    return null;
}


const BulkValidationModal: React.FC<BulkValidationModalProps> = ({ isOpen, onClose, urls }) => {
    const [copyStatus, setCopyStatus] = useState<Record<string, string>>({});

    const handleCopy = (url: string, schema: object | null | undefined) => {
        if (!schema) return;
        const jsonString = JSON.stringify(schema, null, 2);
        navigator.clipboard.writeText(jsonString).then(() => {
            setCopyStatus(prev => ({...prev, [url]: 'Copied!' }));
            setTimeout(() => {
                setCopyStatus(prev => ({...prev, [url]: 'Copy Schema' }));
            }, 2000);
        });
    };

    const handleValidate = () => {
        window.open('https://search.google.com/test/rich-results', '_blank');
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Bulk Validation Workflow">
            <div className="space-y-4">
                <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400 space-y-2">
                    <p>A direct bulk API integration with Google is not possible from a browser app due to security constraints.</p>
                    <p>This workflow provides a consolidated report and speeds up the manual validation process. For each URL, simply:</p>
                    <ol className="list-decimal list-inside pl-2 font-medium text-slate-300">
                        <li>Click "Copy Schema"</li>
                        <li>Click "Validate on Google" and paste the schema into the "Code" tab.</li>
                    </ol>
                </div>
                
                <ul className="space-y-2">
                    {urls.map(urlInfo => (
                        <li key={urlInfo.url} className="p-3 bg-slate-800 rounded-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-200 truncate" title={urlInfo.url}>{urlInfo.url}</p>
                                <p className="text-xs text-slate-500">Internal Check: <ValidationStatusPill status={urlInfo.validationStatus} /></p>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                                <button 
                                    onClick={() => handleCopy(urlInfo.url, urlInfo.schema)}
                                    disabled={!urlInfo.schema}
                                    className="px-2 py-1 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ClipboardIcon className="w-3 h-3 mr-1.5" />
                                    {copyStatus[urlInfo.url] || 'Copy Schema'}
                                </button>
                                <button 
                                    onClick={handleValidate}
                                    className="px-2 py-1 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md transition flex items-center"
                                >
                                    <ExternalLinkIcon className="w-3 h-3 mr-1.5" />
                                    Validate on Google
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>

            </div>
        </Modal>
    );
};

export default BulkValidationModal;
