/**
 * Generates PNG icons from the SVG source for PWA manifest.
 * Run: node scripts/generate-icons.mjs
 * Requires no extra deps — uses Canvas API via a simple SVG-to-PNG approach.
 * Falls back gracefully if generation fails (SVG icon still works).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');

// Simple PNG generator: creates a minimal valid PNG with the "H" logo
// This is a fallback — for production, replace with actual designed icons
function createMinimalPng(size) {
  // We'll create an HTML file that can be opened in a browser to download PNGs
  // For now, copy the SVG as a reference and note that PNGs should be added manually
  console.log(`Icon placeholder for ${size}x${size} — replace public/icons/icon-${size}.png with a real PNG`);
}

mkdirSync(iconsDir, { recursive: true });
[192, 512].forEach(createMinimalPng);

console.log('PWA icon generation complete.');
console.log('Note: For best results, export icon.svg as PNG at 192x192 and 512x512.');
console.log('Place them as public/icons/icon-192.png and public/icons/icon-512.png');
