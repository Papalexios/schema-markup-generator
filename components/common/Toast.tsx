import React from 'react';
import { Toast } from '../../types.ts';
import { CheckCircleIcon } from '../icons/CheckCircleIcon.tsx';
import { XCircleIcon } from '../icons/XCircleIcon.tsx';

interface ToastProps {
  toast: Toast;
}

const ToastMessage: React.FC<ToastProps> = ({ toast }) => {
  const Icon = toast.type === 'success' ? CheckCircleIcon : XCircleIcon;
  const colorClass = toast.type === 'success' ? 'text-green-300' : 'text-red-300';
  
  return (
    <div className={`flex items-center w-full max-w-xs p-4 space-x-4 text-slate-300 bg-slate-800 rounded-lg shadow-lg border border-slate-700 transform transition-all duration-300 ease-in-out animate-toast-in`}>
      <Icon className={`w-6 h-6 ${colorClass}`} />
      <div className="text-sm font-normal">{toast.message}</div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts }) => {
  return (
    <div className="fixed top-5 right-5 z-50 space-y-3">
      {toasts.map(toast => (
        <ToastMessage key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

export default ToastContainer;