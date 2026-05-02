import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vite's internal dynamic-import preload helper must always live in
          // vendor-react (the first chunk loaded). If Rollup puts it in a lazy
          // vendor chunk (e.g. vendor-pdf) the entry file gets a static import
          // of that lazy chunk, defeating the whole point of code-splitting.
          if (id.includes('vite/preload-helper')) {
            return 'vendor-react';
          }
          // React core — loaded first, cached aggressively
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // Supabase auth + DB client
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          // Firebase — large, only needed for push notifications
          if (id.includes('node_modules/firebase/') ||
              id.includes('node_modules/@firebase/')) {
            return 'vendor-firebase';
          }
          // PDF generation — jspdf + autotable + html2canvas
          // tslib must be routed to vendor-misc ABOVE this block so that shared
          // TypeScript helpers never land inside vendor-pdf, which would create
          // a static cross-chunk import from the app entry into the 591 KB PDF bundle.
          if (id.includes('node_modules/tslib')) {
            return 'vendor-misc';
          }
          if (id.includes('node_modules/jspdf') ||
              id.includes('node_modules/jspdf-autotable') ||
              id.includes('node_modules/html2canvas')) {
            return 'vendor-pdf';
          }
          // Word/DOCX generation
          if (id.includes('node_modules/docxtemplater') ||
              id.includes('node_modules/pizzip') ||
              id.includes('node_modules/jszip')) {
            return 'vendor-docx';
          }
          // Icons
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // Date utilities
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-dates';
          }
          // DOMPurify (used by rich text editor)
          if (id.includes('node_modules/dompurify') ||
              id.includes('node_modules/isomorphic-dompurify')) {
            return 'vendor-purify';
          }
          // Everything else from node_modules → general vendor chunk
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
});
