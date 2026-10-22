import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: '.',
  publicDir: 'public',
  manifest: {
    name: 'Web Table Exporter',
    short_name: 'Table Exporter',
    description: 'Export HTML tables from webpages as CSV, TSV, Markdown, or JSON. Local processing, on demand.',
    version: '0.1.0',
    minimum_chrome_version: '96',
    permissions: ['activeTab', 'scripting'],
    action: {
      default_title: 'Web Table Exporter',
      default_popup: 'popup.html',
      default_icon: {
        '16': 'icon16.png',
        '48': 'icon48.png',
        '128': 'icon128.png',
      },
    },
    icons: {
      '16': 'icon16.png',
      '48': 'icon48.png',
      '128': 'icon128.png',
    },
  },
});
