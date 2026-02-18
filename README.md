# Screen Recorder - Self-Hosted [BAUER GROUP Edition]

> Docker-based self-hosting solution for [Cap](https://cap.so) - Beautiful screen recordings, owned by you.

This repository provides production-ready Docker Compose configurations for self-hosting Cap with a dedicated Media Server, MySQL (SSD-optimized) and MinIO (S3-compatible storage), including custom BAUER GROUP branding.

## Features

- **Custom Branding** - BAUER GROUP logos and styling
- **Media Server** - Dedicated video/audio processing microservice (FFmpeg + Bun)
- **Microsoft Entra ID** - Azure AD OAuth (single/multi-tenant)
- **SMTP Email** - Use your own mail server (no cloud dependency)
- **Unlimited Pro License** - All Pro features enabled, no Stripe payments
- **SSD-optimized MySQL** - InnoDB tuning for NVMe/SSD storage
- **MinIO with Init Container** - Automatic bucket and user setup
- **Three Deployment Options** - Development, Traefik (Production), Coolify (PaaS)
- **Automatic Secret Generation** - Secure passwords with one script
- **Health Checks** - All services monitored
- **Log Rotation** - Configured out of the box

## Cap Version Compatibility

| Screen Recorder Version | Cap Version  | Status       |
| ----------------------- | ------------ | ------------ |
| 0.5.x                   | cap-v0.3.83  | Archived     |
| 0.6.x                   | cap-v0.4.1+  | Archived     |
| 0.7.x - 0.8.x           | cap-v0.4.3+  | Maintained   |
| 0.9.x                   | cap-v0.4.6+  | ✅ Current   |

**Note:** Cap 0.4.x introduces cloud services (Workflow, Tinybird) that are automatically disabled for self-hosted deployments. Cap 0.4.6 introduces the Media Server as a separate microservice for video/audio processing.

## Self-Hosted Patches

The following patches are automatically applied during Docker build of the frontend image:

| Patch | Description |
| ----- | ----------- |
| `002-smtp-email.ast` | SMTP email support (alternative to Resend) |
| `003-branding.sh` | Custom BAUER GROUP branding |
| `004-redirects.ast` | URL redirects for self-hosted deployment |
| `005-remove-intercom.ast` | Remove Intercom chat widget |
| `006-replace-google-with-microsoft.ast` | Replace Google OAuth with Microsoft Entra ID |
| `007-remove-stripe.ast` | Disable Stripe payments, enable unlimited Pro license |
| `008-skip-onboarding-steps.ast` | Skip cloud-only onboarding steps (Custom Domain, Invite Team) |
| `009-disable-workflow.ast` | Disable cloud services (Workflow, Tinybird) |

All patches are AST-based (using ts-morph) for robust version compatibility.

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/bauer-group/CS-ScreenRecorder.git
cd CS-ScreenRecorder

# Generate secrets and create .env file
./scripts/generate-secrets.sh
```

### 2. Configure Your Domain

Edit `.env` and set your domain:

```bash
# For development
WEB_URL=http://localhost:3000

# For production (set your own domain)
WEB_URL=https://your-domain.com
SERVICE_HOSTNAME=your-domain.com
S3_HOSTNAME=assets.your-domain.com
S3_CONSOLE_HOSTNAME=assets-console.your-domain.com
```

### 3. Start the Stack

**Development** (builds custom branded images locally):
```bash
docker compose -f docker-compose.development.yml up -d
```

**Production with Traefik** (uses pre-built GHCR images):
```bash
docker compose -f docker-compose.traefik.yml up -d
```

**Coolify PaaS**:
```bash
# Deploy via Coolify dashboard using docker-compose.coolify.yml
```

### 4. Access Cap (Development)

| Service | URL |
|---------|-----|
| Web App | `http://localhost:3000` |
| MinIO Console | `http://localhost:9001` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Traefik                               │
│                   (Reverse Proxy + SSL)                      │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Frontend   │      │  MinIO S3   │      │MinIO Console│
│  (Cap Web)  │      │   :9000     │      │   :9001     │
│   :3000     │      └─────────────┘      └─────────────┘
└─────────────┘              │
     │       │               │
     ▼       ▼               │
┌────────┐ ┌─────────────┐   │
│ MySQL  │ │Media Server │   │
│ :3306  │ │   :3456     │◄──┘
└────────┘ │  (FFmpeg)   │  (Video Storage)
           └─────────────┘
```

**Services:**

| Service | Image | Description |
| ------- | ----- | ----------- |
| **Frontend** | `ghcr.io/bauer-group/cs-screenrecorder/frontend` | Cap web application (Next.js) |
| **Media Server** | `ghcr.io/bauer-group/cs-screenrecorder/mediaserver` | Video/audio processing (Bun + FFmpeg) |
| **MySQL** | `mysql:8.4` | Database (SSD-optimized) |
| **MinIO** | `quay.io/minio/minio` | S3-compatible object storage |

## Project Structure

```
CS-ScreenRecorder/
├── .github/
│   ├── workflows/
│   │   ├── docker-release.yml      # CI/CD pipeline (frontend + mediaserver)
│   │   └── docker-maintenance.yml  # Dockerfile maintenance
│   └── config/
│       └── release/
│           └── semantic-release.json
├── scripts/
│   ├── generate-secrets.sh         # Secret generator
│   ├── generate-assets.sh          # Logo/favicon generator
│   ├── setup-client-bucket.py      # Client download bucket setup
│   └── sync-clients.py             # Client installer sync
├── src/
│   ├── frontend/                   # Cap Web Application
│   │   ├── Dockerfile              # Multi-stage build with patches
│   │   ├── patches/                # Source code patches (AST-based)
│   │   │   ├── apply-patches.sh            # Patch runner
│   │   │   ├── 002-smtp-email.ast/         # SMTP email support
│   │   │   ├── 003-branding.sh             # Custom branding
│   │   │   ├── 004-redirects.ast/          # URL redirects
│   │   │   ├── 005-remove-intercom.ast/    # Remove Intercom chat
│   │   │   ├── 006-replace-google-with-microsoft.ast/  # Azure AD OAuth
│   │   │   ├── 007-remove-stripe.ast/      # Disable payments
│   │   │   ├── 008-skip-onboarding-steps.ast/  # Skip cloud onboarding
│   │   │   └── 009-disable-workflow.ast/   # Disable cloud services
│   │   └── branding/               # Logo sources & config
│   │       ├── branding.env        # Branding configuration
│   │       ├── apply-branding.sh   # Asset copy script
│   │       └── assets/             # Generated favicons & icons
│   ├── mediaserver/                # Cap Media Server
│   │   └── Dockerfile              # Bun + FFmpeg build
│   └── tools/                      # Development tools container
│       ├── Dockerfile
│       ├── run.sh                  # Linux/macOS launcher
│       └── run.ps1                 # PowerShell launcher
├── docker-compose.development.yml  # Local build + port exposure
├── docker-compose.traefik.yml      # Production with Traefik reverse proxy
├── docker-compose.coolify.yml      # Coolify PaaS deployment
├── .env.example                    # Configuration template
├── .gitattributes                  # Line ending normalization
├── NOTICE.md                       # Third-party licenses
└── README.md
```

## Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `WEB_URL` | Public URL of Cap |
| `NEXTAUTH_SECRET` | Session encryption key (generated) |
| `DATABASE_PASSWORD` | MySQL password (generated) |
| `DATABASE_ENCRYPTION_KEY` | Database field encryption key (generated) |
| `MINIO_ROOT_PASSWORD` | MinIO admin password (generated) |
| `CAP_AWS_SECRET_KEY` | S3 service account key (generated) |
| `MEDIA_SERVER_WEBHOOK_SECRET` | Media server webhook auth secret (generated) |

### Static Configuration (in compose files)

| Setting | Value |
|---------|-------|
| Database name | `cap` |
| Database user | `cap` |
| S3 bucket | `media` |
| S3 user | `cap` |
| S3 region | `global` |
| Media server port | `3456` |

### Optional Features

| Feature | Variables |
|---------|-----------|
| **SMTP Email** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| **Resend Email** | `RESEND_API_KEY`, `RESEND_FROM_DOMAIN` |
| **Microsoft Entra ID** | `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` |
| **Google OAuth** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Enterprise SSO** | `WORKOS_CLIENT_ID`, `WORKOS_API_KEY` |
| **AI Transcription** | `DEEPGRAM_API_KEY` |
| **AI Summaries** | `OPENAI_API_KEY` or `GROQ_API_KEY` |
| **Domain Restriction** | `CAP_ALLOWED_SIGNUP_DOMAINS` |
| **Client Downloads** | `CAP_CLIENT_DOWNLOAD_URL` |

See [.env.example](.env.example) for all options.

## Branding

Custom branding is built into the frontend Docker image. To update:

1. Place logo files in `src/frontend/branding/`:
   - `logo-source-wide.{eps,svg,png}` - Wide logo
   - `logo-source-square.{eps,svg,png}` - Square logo

2. Edit branding colors/names in `src/frontend/branding/branding.env`

3. Generate assets using the tools container:
   ```bash
   ./tools/run.sh
   ./scripts/generate-assets.sh
   ```

4. Rebuild the Docker image:
   ```bash
   docker compose -f docker-compose.development.yml build frontend-server
   ```

## Email Configuration

If email is not configured, login links appear in container logs:

```bash
docker logs ${STACK_NAME}_APP
```

**Option 1: SMTP (Recommended for self-hosted)**

```bash
SMTP_HOST=mail.example.com
SMTP_PORT=587
SMTP_TLS=false
SMTP_USER=user@example.com
SMTP_PASSWORD=secret
SMTP_FROM=no-reply@example.com
SMTP_FROM_NAME=Screen Recorder
```

**Option 2: Resend (Cloud)**

```bash
RESEND_API_KEY=re_xxxxx
RESEND_FROM_DOMAIN=mail.your-domain.com
```

Priority: SMTP > Resend > Console Log

## Microsoft Entra ID (Azure AD)

1. Register app at [Entra Portal](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Set redirect URI: `https://${SERVICE_HOSTNAME}/api/auth/callback/azure-ad`
3. Configure environment:

```bash
AZURE_AD_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=your-tenant-id  # Leave empty for multi-tenant
```

See [.env.example](.env.example) for detailed setup instructions.

## Desktop App

To use Cap Desktop with your self-hosted instance:

1. Open Cap Desktop settings
2. Set "Cap Server URL" to your deployment URL
3. Login and start recording

See detailed instructions: [English](docs/DESKTOP-APP-SELF-HOST.md) | [Deutsch](docs/DESKTOP-APP-SELF-HOST-DE.md)

## Backup & Restore

### Backup

```bash
# MySQL
docker exec ${STACK_NAME}_MYSQL mysqldump -u root -p${DATABASE_PASSWORD} cap > backup.sql

# MinIO
docker run --rm -v screenrecorder-storage:/data -v $(pwd):/backup alpine \
  tar czf /backup/minio-backup.tar.gz /data
```

### Restore

```bash
# MySQL
docker exec -i ${STACK_NAME}_MYSQL mysql -u root -p${DATABASE_PASSWORD} cap < backup.sql

# MinIO
docker run --rm -v screenrecorder-storage:/data -v $(pwd):/backup alpine \
  tar xzf /backup/minio-backup.tar.gz -C /
```

## Troubleshooting

```bash
# View logs
docker compose -f docker-compose.development.yml logs -f

# View specific service logs
docker compose -f docker-compose.development.yml logs -f frontend-server
docker compose -f docker-compose.development.yml logs -f media-server

# Check health
docker compose -f docker-compose.development.yml ps

# Reset (WARNING: deletes data!)
docker compose -f docker-compose.development.yml down
docker volume rm screenrecorder-database screenrecorder-storage
```

## Updates

```bash
docker compose -f docker-compose.traefik.yml pull
docker compose -f docker-compose.traefik.yml up -d
```

## License

MIT License - See [LICENSE](LICENSE) for details.

## Links

- [Cap Website](https://cap.so)
- [Cap GitHub](https://github.com/CapSoftware/Cap)
- [Self-Hosting Docs](https://cap.so/docs/self-hosting)
