import React from 'react';
import { Button } from '@/components/ui/button';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Application render error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-xl border bg-white p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-slate-900">The page could not be displayed</h1>
          <p className="mt-2 text-slate-600">A record contains invalid or incomplete data. The application prevented a blank screen.</p>
          <pre className="mt-4 max-h-52 overflow-auto rounded bg-slate-100 p-3 text-xs text-red-700 whitespace-pre-wrap">{this.state.error?.message || String(this.state.error)}</pre>
          <div className="mt-5 flex gap-3">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button variant="outline" onClick={() => { window.location.href = '/login'; }}>Back to login</Button>
          </div>
        </div>
      </div>
    );
  }
}
