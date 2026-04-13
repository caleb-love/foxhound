import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Example Vitest configuration for Foxhound web app
 * 
 * Copy this to vitest.config.ts and customize as needed.
 * 
 * NOTE: @vitejs/plugin-react is NOT needed for tests.
 * Vitest handles JSX transformation automatically.
 */
export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,
    
    // Setup file for test environment configuration
    setupFiles: ['./vitest.setup.ts'],
    
    // Optional: Configure test environment (default is 'node')
    // environment: 'jsdom', // Uncomment for DOM testing
  },
  
  resolve: {
    // Path aliases to match tsconfig.json
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
