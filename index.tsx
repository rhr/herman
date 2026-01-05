
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('===== INDEX.TSX IS LOADING =====');
console.log('React version:', React.version);

const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (!rootElement) {
  console.error('ROOT ELEMENT NOT FOUND!');
  throw new Error("Could not find root element to mount to");
}

console.log('Creating React root...');
const root = ReactDOM.createRoot(rootElement);

console.log('Rendering App component...');
root.render(
  <App />
);

console.log('===== APP RENDERED =====');
