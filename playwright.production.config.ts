import { defineConfig } from "@playwright/test";
const baseURL = process.env.PLAYWRIGHT_BASE_URL;
if (!baseURL || new URL(baseURL).protocol !== "https:") throw new Error("PLAYWRIGHT_BASE_URL deve ser a URL HTTPS do piloto publicado.");
if (!process.env.PRODUCTION_SMOKE_IDENTIFIER || !process.env.PRODUCTION_SMOKE_PASSWORD) throw new Error("Configure PRODUCTION_SMOKE_IDENTIFIER e PRODUCTION_SMOKE_PASSWORD de uma conta de teste com curso liberado.");
export default defineConfig({ testDir: "./tests/production-smoke", workers: 1, retries: 0, use: { baseURL, channel: process.env.PLAYWRIGHT_CHANNEL, screenshot: "off", trace: "off", video: "off" } });
