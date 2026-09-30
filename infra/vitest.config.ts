import { defineConfig } from 'vitest/config';

// Synth bundles four Lambdas with esbuild, so allow extra time
export default defineConfig({ test: { testTimeout: 120_000 } });
