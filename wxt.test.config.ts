import { defineConfig } from 'wxt';
import config from './wxt.config';

export default defineConfig({
  ...config,
  outDir: '.output/test',
  manifest: {
    ...config.manifest,
    // Test-build-only local permission lets Playwright drive the popup as a page.
    // The production build retains only activeTab and scripting.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxZXlFMfGEn5M4a1BegulAaRkTTy4i3MW3u6D9haEm0aeUbjaZXXU3o3OzuYL0M2iZiWfaKhlSUQsCsO1udxJpg5LucveONv6kNe7ndPQAv9l6G3CqHBAIQNq3Xz0rcEAtahbLFYql4hlBnZ6OZdvHgQwA5wQcpGaqr7M6KMv99Y7oy8ZhWG4td5XlRCiNvqTvVAVg8y1WPO2S60/Kw2x4WBauNZLTOssxJMjw1Ov+Zj++Rx2SGIyangCGJDhkUvfMkD4zj1d0oj9gtDEQ0zUGTaVKaVgYtImhvoWN0W2tq+6RumhALA/fqFzRsyfLffwvSsgZoD54X6MoKDwXXu0KwIDAQAB',
    host_permissions: ['http://127.0.0.1:4173/*'],
  },
});
