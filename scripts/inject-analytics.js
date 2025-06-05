#!/usr/bin/env node

/**
 * Build script to inject analytics during deployment
 * Usage: node scripts/inject-analytics.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ANALYTICS_SCRIPT = `<script defer src="https://umami.d17e.dev/script.js" data-website-id="46a9db27-3ca5-40e1-b863-08d9086817b4"></script>`;

function injectAnalytics() {
  try {
    // Try to inject in dist folder first (for production builds), then fallback to public
    const possiblePaths = [
      join(process.cwd(), 'dist/index.html'),
      join(process.cwd(), 'public/index.html')
    ];
    
    let htmlPath;
    let html;
    
    // Find the first existing HTML file
    for (const path of possiblePaths) {
      try {
        html = readFileSync(path, 'utf8');
        htmlPath = path;
        break;
      } catch (error) {
        // File doesn't exist, try next path
        continue;
      }
    }
    
    if (!htmlPath) {
      throw new Error('Could not find index.html in dist/ or public/ directories');
    }
    
    // Check if analytics is already injected to avoid duplicates
    if (html.includes('umami.d17e.dev')) {
      console.log('Analytics already present, skipping injection');
      return;
    }
    
    // Inject before closing </head> tag
    html = html.replace('</head>', `  ${ANALYTICS_SCRIPT}\n</head>`);
    
    // Write back to file
    writeFileSync(htmlPath, html, 'utf8');
    console.log(`✅ Analytics script injected successfully into ${htmlPath}`);
    
  } catch (error) {
    console.error('❌ Error injecting analytics:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  injectAnalytics();
}

export { injectAnalytics };