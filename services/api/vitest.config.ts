import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      TABLE_NAME: 'test-table',
      MODEL_ID: 'test-model',
      POWERTOOLS_SERVICE_NAME: 'test',
      POWERTOOLS_METRICS_NAMESPACE: 'PayInParts',
      POWERTOOLS_METRICS_DISABLED: 'true',
      POWERTOOLS_TRACE_ENABLED: 'false',
      POWERTOOLS_LOG_LEVEL: 'SILENT',
    },
  },
});
