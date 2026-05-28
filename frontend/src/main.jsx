// Safely patch Response.prototype.json to handle non-JSON responses gracefully on server errors (500, 502, 504, etc.)
const originalJson = Response.prototype.json;
Response.prototype.json = async function () {
  try {
    return await originalJson.call(this);
  } catch (err) {
    if (!this.ok) {
      return { error: `Server error (status ${this.status}). The server may be temporarily down.` };
    }
    throw err;
  }
};

import { API_URL, SOCKET_URL } from './api_config';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
