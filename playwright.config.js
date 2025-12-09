import { defineConfig, devices } from '@playwright/test';

const webkitExec = globalThis.process.platform === 'linux' ? globalThis.process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH : undefined;

export default defineConfig({
    use: { headless: true },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        {
            name: 'webkit',
            use: {
                ...devices['Desktop Safari'],
                ...(webkitExec && { launchOptions: { executablePath: globalThis.process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } }),
            },
        },
    ],
});
