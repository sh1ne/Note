'use client';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ 
  title = 'Something went wrong', 
  message, 
  onRetry 
}: ErrorMessageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-primary p-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <p className="text-text-secondary mb-6">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-bg-secondary text-text-primary rounded hover:bg-bg-secondary/80 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

