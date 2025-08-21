# Injury Tagging System

Monorepo containing frontend (React + Vite) and backend (Node.js/Express + SQLite) for tagging injury events in sports match videos.

## Structure
- backend (API, SQLite persistence)
- frontend (React UI)
- .github/workflows (CI/CD)

## Development

### Prerequisites
- Node.js 18+
- ffmpeg installed (for clip extraction)

### Run Backend
```
cd backend
npm install
npm run dev
```
API runs on http://localhost:4000

### Run Frontend
```
cd frontend
npm install
npm run dev
```
App runs on http://localhost:5173

### Environment Variables (backend/.env)
```
PORT=4000
DATA_DIR=./data
FFMPEG_PATH=/usr/bin/ffmpeg # optional
APP_VERSION=0.1.0
CORS_ORIGIN=https://yourdomain.com # or *
AUTH_TOKEN=changeme # optional bearer token
LOG_LEVEL=info
```

## Production Deployment (Summary)
1. Build frontend: `cd frontend && npm run build` -> outputs to `dist/`.
2. Copy `dist/` to nginx web root (e.g. `/var/www/injury`).
3. Start backend with process manager (pm2) on port 4000.
4. Nginx reverse proxy `/api/` to backend and serve static frontend.

## CI/CD
GitHub Actions workflow at `.github/workflows/ci.yml`:
- On push / PR to `main` runs build + tests.
- Deploy job (only on `main`) bundles backend (production deps) + built frontend and ships to server via SSH.
- Remote PM2 reload with new `APP_VERSION` (commit SHA) and shared persistent `data/` directory.

### Required GitHub Secrets
Set these in the repository settings -> Secrets and variables -> Actions:
- `PROD_HOST` = 206.189.111.34
- `PROD_USER` = root
- `PROD_PATH` = /var/www/injury
- `SSH_PRIVATE_KEY` = (private key matching a public key added to server `~/.ssh/authorized_keys`)
- `DOMAIN` = lukesinjurytagger.best
- (Optional) `PROD_PORT` if not 22
- (Optional) `AUTH_TOKEN` if using bearer token (then add export in ecosystem or server env)

Never store raw passwords or passphrases in the repo. Use key-based auth. (Do NOT commit actual passwords.)

### Server Preparation (one-time)
```
# On server (as root or sudo)
adduser deploy --disabled-password
usermod -aG sudo deploy
mkdir -p /var/www/injury/releases /var/www/injury/shared/data
chown -R deploy:deploy /var/www/injury
# Install Node + pm2 + ffmpeg (Ubuntu example)
apt update && apt install -y curl ffmpeg
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs build-essential
npm install -g pm2
# Add your public key to /home/deploy/.ssh/authorized_keys
```
Update GitHub secrets to use `deploy` user instead of root once created.

### Nginx Sample
```
server {
  server_name lukesinjurytagger.best;
  root /var/www/injury/current/frontend_dist;
  index index.html;
  location /api/ {
    proxy_pass http://127.0.0.1:4000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
  location / {
    try_files $uri /index.html;
  }
  # Add SSL (after certbot --nginx obtains certs)
  listen 80;
}
```
Then run certbot to enable HTTPS.

## API Endpoints
- GET /api/health
- GET /api/version
- GET /api/events (?label=Label to filter)
- POST /api/events { timestamp_s, label, note, match_id?, player?, severity? }
- PATCH /api/events/:id (partial update any of above fields)
- DELETE /api/events/:id
- GET /api/export/xlsx (download Excel)
- GET /api/export/csv (download CSV)
- POST /api/upload (multipart video)
- POST /api/extract { source, pre, post }

## Features
- SQLite persistence (`data/events.db`).
- Event metadata: match_id, player, severity (0-5).
- Filter events by label (dropdown).
- Inline edit of events (label, note, metadata, severity).
- Timeline slider with clickable markers & red playhead.
- XLSX & CSV export with human-readable time & metadata fields.
- Version endpoint + UI display.
- Keyboard shortcuts (T,F,I,O) & delete events.
- Live video time display.
- CORS restriction via `CORS_ORIGIN`.
- Rate limiting (120 req/min default) & security headers (helmet).
- Structured logging (pino / pino-http).
- Optional bearer token protection (set `AUTH_TOKEN`).

## Testing
```
cd backend
npm test
```
(Placeholder tests included.)

## Next Steps
- Authentication / user accounts.
- Async clip extraction queue & job status endpoints.
- Persistent clip job records.
- Backup strategy for `data/` & clips.
- More comprehensive test suite.
