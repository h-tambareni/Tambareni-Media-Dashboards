import React from 'react'
import ReactDOM from 'react-dom/client'
import { YouTubeProvider } from './context/YouTubeContext'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <YouTubeProvider>
      <App />
    </YouTubeProvider>
  </React.StrictMode>,
)
