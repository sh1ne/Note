'use client';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ message = 'Loading...', size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary text-text-primary p-4">
      <div className={`${sizeClasses[size]} border-4 border-text-secondary border-t-text-primary rounded-full animate-spin mb-4`}></div>
      <p className="text-text-secondary">{message}</p>
    </div>
  );
}



