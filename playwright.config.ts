import { defineConfig, devices, type Project } from '@playwright/test';

const iphone = devices['iPhone 14'];

/**
 * The screenshot project is only materialised when it is asked for, so the
 * default `playwright test` run (and `npm run test:browser`) never produces
 * PNGs or videos. Both `--project=screenshots` and `tests/screenshots.spec.ts`
 * contain the word, as does SCREENSHOTS=1 in the environment.
 */
const screenshotsRequested =
  process.env.SCREENSHOTS === '1' || process.argv.some((arg) => arg.includes('screenshots'));

const chrome = {
  browserName: 'chromium',
  channel: 'chrome',
  // Headless Chrome only exposes WebGL through SwiftShader with this flag on
  // recent releases; without it the scene would fall back on every run.
  launchOptions: { args: ['--enable-unsafe-swiftshader'] },
} as const;

const desktopViewport = { width: 1440, height: 900 };
const mobileViewport = { width: 390, height: 844 };
const narrowViewport = { width: 320, height: 700 };

const desktop: Project = {
  name: 'desktop',
  testMatch: [/opening\.spec\.ts$/, /loader\.spec\.ts$/, /sections\.spec\.ts$/, /subpath\.spec\.ts$/],
  use: { ...chrome, viewport: desktopViewport },
};

const mobile: Project = {
  name: 'mobile',
  testMatch: [/opening\.spec\.ts$/, /sections\.spec\.ts$/],
  use: {
    ...chrome,
    viewport: mobileViewport,
    userAgent: iphone.userAgent,
    deviceScaleFactor: iphone.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  },
};

const narrow: Project = {
  name: 'narrow',
  testMatch: [/opening\.spec\.ts$/],
  use: { ...chrome, viewport: narrowViewport },
};

const screenshots: Project = {
  name: 'screenshots',
  testMatch: [/screenshots\.spec\.ts$/],
  timeout: 120_000,
  use: { ...chrome, viewport: desktopViewport, trace: 'off' },
};

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Two WebGL contexts at once is the most the software renderer copes with.
  workers: 2,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run preview',
      url: 'http://localhost:4173/',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run preview:subpath',
      url: 'http://localhost:4174/agent-coordinator-experiment/',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [desktop, mobile, narrow, ...(screenshotsRequested ? [screenshots] : [])],
});
