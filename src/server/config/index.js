const path = require('path');
const fs = require('fs');
const { z } = require('zod');
const dotenv = require('dotenv');

const ENV_PATH = path.join(process.cwd(), '.env');

if (fs.existsSync(ENV_PATH)) {
  dotenv.config({ path: ENV_PATH });
} else {
  dotenv.config();
}

const booleanFromEnv = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const numberFromEnv = (value, fallback) => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const configSchema = z.object({
  env: z.enum(['development', 'production', 'test']).default('development'),
  server: z.object({
    port: z.number().int().min(0).max(65535).default(4000),
    host: z.string().default('0.0.0.0'),
  }),
  gmail: z.object({
    clientId: z.string().min(1).optional(),
    clientSecret: z.string().min(1).optional(),
    redirectUri: z.string().min(1).optional(),
    tokenPath: z.string().default(path.join(process.cwd(), 'config', 'token.json')),
  }),
  deepseek: z.object({
    apiKey: z.string().min(1).optional(),
    defaultModel: z.string().default('deepseek-chat'),
  }),
  settings: z.object({
    maxEmailsPerRun: z.number().int().min(1).max(100).default(20),
    autoContinue: z.boolean().default(true),
    deleteAfterUnsubscribe: z.boolean().default(false),
    permanentDelete: z.boolean().default(false),
    maxConcurrentJobs: z.number().int().min(1).max(5).default(1),
    retryCount: z.number().int().min(0).max(5).default(2),
  }),
  storage: z.object({
    dataDir: z.string().default(path.join(process.cwd(), 'data')),
    logsDir: z.string().default(path.join(process.cwd(), 'logs')),
    screenshotsDir: z.string().default(path.join(process.cwd(), 'screenshots')),
  }),
});

const rawConfig = {
  env: process.env.NODE_ENV || 'development',
  server: {
    port: numberFromEnv(process.env.APP_PORT || process.env.SERVER_PORT, 4000),
    host: process.env.HOST || '0.0.0.0',
  },
  gmail: {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI,
    tokenPath: process.env.GMAIL_TOKEN_PATH,
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    defaultModel: process.env.DEEPSEEK_MODEL,
  },
  settings: {
    maxEmailsPerRun: numberFromEnv(process.env.MAX_EMAILS_TO_PROCESS, 20),
    autoContinue: booleanFromEnv(process.env.AUTO_CONTINUE, true),
    deleteAfterUnsubscribe: booleanFromEnv(process.env.DELETE_AFTER_UNSUBSCRIBE, false),
    permanentDelete: booleanFromEnv(process.env.PERMANENT_DELETE, false),
    maxConcurrentJobs: numberFromEnv(process.env.MAX_CONCURRENT_JOBS, 1),
    retryCount: numberFromEnv(process.env.RETRY_COUNT, 2),
  },
  storage: {
    dataDir: process.env.DATA_DIR,
    logsDir: process.env.LOGS_DIR,
    screenshotsDir: process.env.SCREENSHOTS_DIR,
  },
};

const { data, error } = configSchema.safeParse(rawConfig);

if (error) {
  console.error('Invalid configuration:', error.flatten().fieldErrors);
  throw new Error('Configuration validation failed');
}

const ensureDirectories = (...dirs) => {
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureDirectories(data.storage.dataDir, data.storage.logsDir, data.storage.screenshotsDir);

module.exports = data;
