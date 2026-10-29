import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/dm-mono/latin-400.css';
import '@fontsource/dm-mono/latin-500.css';
import '@fontsource/dm-serif-display/latin-400.css';
import { render } from 'solid-js/web';
import App from './App';

const root = document.getElementById('app');

if (root) {
  render(() => <App />, root);
} else {
  console.error("No root element found");
}
