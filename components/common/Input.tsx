
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input: React.FC<InputProps> = ({ className, ...props }) => {
  return (
    <input
      className={`block w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-200 ${className}`}
      {...props}
    />
  );
};

export default Input;
