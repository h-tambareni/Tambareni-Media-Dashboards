import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { YouTubeProvider } from './context/YouTubeContext'
import App from './App.jsx'
import LandingPage from './LandingPage.jsx'

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { console.error('App error:', err, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui', background: '#111', color: '#f5f2ed', minHeight: '100vh' }}>
          <h2 style={{ color: '#d63031', marginBottom: 12 }}>Something went wrong</h2>
          <pre style={{ fontSize: 13, overflow: 'auto' }}>{this.state.error?.message || String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  const [route, setRoute] = useState(() => {
    const path = window.location.pathname;
    if (path === '/analytics' || path === '/analytics/') return 'analytics';
    return 'landing';
  });

  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname;
      setRoute(path === '/analytics' || path === '/analytics/' ? 'analytics' : 'landing');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = route === 'analytics' ? 'Cameleo Studio Analytics' : 'Cameleo Studio';
  }, [route]);

  if (route === 'analytics') {
    return (
      <YouTubeProvider>
        <App />
      </YouTubeProvider>
    );
  }

  return <LandingPage />;
}

// StrictMode disabled: Recharts + ResponsiveContainer can throw removeChild errors in dev when
// components mount twice. Production builds were unaffected.
ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <Router />
  </ErrorBoundary>,
)
