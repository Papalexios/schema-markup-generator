import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={`bg-gradient-to-b from-slate-800/80 to-slate-900/60 backdrop-blur-sm rounded-lg shadow-2xl border border-slate-700 ${className}`}>
      {children}
    </div>
  );
};

export default Card;