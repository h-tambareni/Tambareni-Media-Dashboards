import React from 'react'
import ReactDOM from 'react-dom/client'
import { YouTubeProvider } from './context/YouTubeContext'
import App from './App.jsx'

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <YouTubeProvider>
        <App />
      </YouTubeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
