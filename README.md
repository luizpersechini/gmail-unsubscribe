# Gmail Unsubscribe Control Center

Modernize your inbox upkeep. This project combines a resilient Node.js backend with a sleek React dashboard to find promotional emails, unsubscribe automatically (using DeepSeek AI when needed), and keep a full audit trail of what happened.

---

## Highlights

- **Express API + Job Runner** – handles Gmail OAuth, queues unsubscribe sessions, and keeps structured logs.
- **DeepSeek-assisted automation** – falls back to AI guidance when an email does not expose a simple unsubscribe link.
- **React dashboard** – monitor live progress, review individual email outcomes, and browse the activity log in real time.
- **Audit friendly** – screenshots are captured to `screenshots/`, logs persist to `logs/`, and historical runs are stored in `data/runs.json`.

---

## Project Layout

```
/src/server       # Express app, services, job runner, configuration
/web              # Vite + React dashboard (development source)
/dist/web         # Production-ready UI bundle (generated)
/.env.example     # Configuration template
/data             # JSON data store (created automatically)
/logs             # Server + run logs (created automatically)
/screenshots      # Browser automation evidence (created automatically)
```

---

## Prerequisites

- **Node.js 18+** (Node 20 or 22 LTS recommended)
- A Google Cloud project with Gmail API enabled
- A DeepSeek API key (needed for AI-powered fallback)

---

## 1. Configuration

1. Copy the template and fill in your secrets:

   ```bash
   cp .env.example .env
   ```

2. Update the new `.env` file:

   | Key | Description |
   | --- | ----------- |
   | `APP_PORT` | Port used by the Express API (defaults to 4000) |
   | `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI` | Gmail OAuth credentials. Redirect URI must match what you set in Google Cloud |
   | `DEEPSEEK_API_KEY` | API key for DeepSeek AI |
   | `MAX_EMAILS_TO_PROCESS` | Default email cap per run |
   | `DELETE_AFTER_UNSUBSCRIBE` / `PERMANENT_DELETE` | Optional cleanup behaviour |
   | `MAX_CONCURRENT_JOBS` | Limit simultaneous unsubscribe runs |
   | `DATA_DIR`, `LOGS_DIR`, `SCREENSHOTS_DIR` | Override storage locations if desired |

> Tokens granted by Gmail are stored at `config/token.json` (created automatically).

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Development Workflow

Two servers run together in development:

```bash
npm run dev
```

- Express API → `http://localhost:4000`
- Vite dev server → `http://localhost:5173`

Open the dashboard in your browser, click **“Authorize Gmail”**, and complete the OAuth flow. Once connected you can trigger new unsubscribe sessions from the UI.

---

## 4. Production Build

Build the React dashboard and serve everything through Express:

```bash
npm run build        # creates dist/web
npm start            # serves API + static dashboard
```

Express automatically serves the contents of `dist/web` in production mode while keeping the `/api` namespace reserved for JSON endpoints.

---

## Key npm Scripts

| Script | Description |
| ------ | ----------- |
| `npm start` | Run the Express API (expects the UI bundle to be pre-built) |
| `npm run dev` | Launch API (via nodemon) + Vite dashboard together |
| `npm run web:dev` | Vite dev server only |
| `npm run web:build` | Build the React dashboard for production |
| `npm run web:preview` | Preview the production build locally |

---

## API Endpoints (summary)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/status/app` | Basic health and authorization status |
| `GET` | `/api/status/config` | Sanitised configuration details |
| `GET` | `/api/auth/url` | Obtain OAuth URL for Gmail sign-in |
| `POST` | `/api/auth/callback` | Persist OAuth tokens (if handled manually) |
| `POST` | `/api/auth/revoke` | Revoke Gmail access |
| `POST` | `/api/unsubscribe/start` | Launch a new unsubscribe run |
| `GET` | `/api/unsubscribe/runs` | List historical runs |
| `GET` | `/api/unsubscribe/runs/:id` | Inspect a specific run |
| `GET` | `/api/unsubscribe/runs/:id/logs` | Stream run logs |
| `POST` | `/api/unsubscribe/runs/:id/cancel` | Cancel a run in progress |

The React dashboard consumes these endpoints; you can also integrate them with other systems.

---

## Notes & Good Practices

- Puppeteer runs in headless mode by default. Screenshots for each major step are saved under `screenshots/`.
- Failed automation attempts still record logs and instructions so you can step in manually.
- The job runner limits concurrency (`MAX_CONCURRENT_JOBS`) to protect your Gmail rate limits.
- When experimenting locally, consider setting `MAX_EMAILS_TO_PROCESS` to a small number until you trust the automation.

---

## Troubleshooting

- **Server won’t start** → ensure `.env` is populated and no other process is locking the chosen port.
- **Gmail auth issues** → double-check the Google Cloud OAuth redirect URI and regenerate the token by revoking it in the dashboard.
- **DeepSeek failures** → the automation falls back gracefully; check logs in the dashboard for details.

---

## License

MIT © 2025 – use responsibly and keep your credentials safe.