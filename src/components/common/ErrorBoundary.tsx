'use client';
import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('ErrorBoundary caught:', error, info);
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-center p-6">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mb-3" />
          <p className="font-medium text-gray-700">
            {this.props.fallbackMessage || 'Something went wrong rendering this section.'}
          </p>
          <p className="text-sm text-gray-500 mt-1">{this.state.error?.message}</p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-4 px-4 py-2 bg-[#1565C0] text-white rounded-md text-sm hover:bg-[#0D2847]"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
