# Cap Screen Recorder - Self-Hosted [BAUER GROUP Edition]

> Docker-based self-hosting solution for [Cap](https://cap.so) - Beautiful screen recordings, owned by you.

This repository provides production-ready Docker Compose configurations for self-hosting Cap with MySQL (SSD-optimized) and MinIO (S3-compatible storage), including custom BAUER GROUP branding.

## Features

- **Custom Branding** - BAUER GROUP logos and styling
- **Microsoft Entra ID** - Azure AD OAuth (single/multi-tenant)
- **SMTP Email** - Use your own mail server (no cloud dependency)
- **SSD-optimized MySQL** - InnoDB tuning for NVMe/SSD storage
- **MinIO with Init Container** - Automatic bucket and user setup
- **Three Deployment Options** - Development, Traefik (Production), Coolify (PaaS)
- **Automatic Secret Generation** - Secure passwords with one script
- **Health Checks** - All services monitored
- **Log Rotation** - Configured out of the box

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

# For production
WEB_URL=https://screenrecorder.app.bauer-group.com
SERVICE_HOSTNAME=screenrecorder.app.bauer-group.com
S3_HOSTNAME=assets.screenrecorder.app.bauer-group.com
S3_CONSOLE_HOSTNAME=assets-console.screenrecorder.app.bauer-group.com
```

### 3. Start the Stack

**Development** (builds custom branded image locally):
```bash
docker compose -f docker-compose.development.yml up -d
```

**Production with Traefik** (uses pre-built GHCR image):
```bash
docker compose -f docker-compose.traefik.yml up -d
```

**Coolify PaaS**:
```bash
# Deploy via Coolify dashboard using docker-compose.coolify.yml
```

### 4. Access Cap

| Environment | URL |
|-------------|-----|
| Development | http://localhost:3000 |
| Production | https://screenrecorder.app.bauer-group.com |
| MinIO Console | http://localhost:9001 (dev) / https://assets-console... (prod) |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Traefik                               │
│                   (Reverse Proxy + SSL)                      │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Cap Web   │      │  MinIO S3   │      │MinIO Console│
│   :3000     │      │   :9000     │      │   :9001     │
└─────────────┘      └─────────────┘      └─────────────┘
         │                    │
         ▼                    │
┌─────────────┐               │
│    MySQL    │◄──────────────┘
│   :3306     │         (Video Storage)
└─────────────┘
```

## Project Structure

```
CS-ScreenRecorder/
├── .github/
│   ├── workflows/
│   │   └── docker-release.yml    # CI/CD pipeline
│   └── dependabot.yml            # Dependency updates
├── scripts/
│   ├── generate-secrets.sh       # Secret generator
│   └── generate-assets.sh        # Logo/favicon generator
├── src/
│   ├── Dockerfile                # Custom Cap image
│   ├── patches/                  # Source code patches
│   │   ├── 001-microsoft-entra-id.sh
│   │   └── 002-smtp-email.sh
│   └── branding/                 # Logo sources
│       ├── branding.env          # Branding config
│       └── logo-source-*.{eps,svg,png}
├── tools/
│   ├── Dockerfile                # Development tools
│   ├── run.sh                    # Linux/macOS launcher
│   └── run.ps1                   # PowerShell launcher
├── docker-compose.development.yml
├── docker-compose.traefik.yml
├── docker-compose.coolify.yml
├── .env.example
├── NOTICE.md                     # Third-party licenses
└── README.md
```

## Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `WEB_URL` | Public URL of Cap |
| `NEXTAUTH_SECRET` | Session encryption key (generated) |
| `DATABASE_PASSWORD` | MySQL password (generated) |
| `MINIO_ROOT_PASSWORD` | MinIO admin password (generated) |
| `CAP_AWS_SECRET_KEY` | S3 service account key (generated) |

### Static Configuration (in compose files)

| Setting | Value |
|---------|-------|
| Database name | `cap` |
| Database user | `cap` |
| S3 bucket | `videos` |
| S3 user | `cap` |
| S3 region | `global` |

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
| **Payments** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

See [.env.example](.env.example) for all options.

## Branding

Custom branding is built into the Docker image. To update:

1. Place logo files in `src/branding/`:
   - `logo-source-wide.{eps,svg,png}` - Wide logo
   - `logo-source-square.{eps,svg,png}` - Square logo

2. Generate assets using the tools container:
   ```bash
   ./tools/run.sh
   ./scripts/generate-assets.sh
   ```

3. Rebuild the Docker image:
   ```bash
   docker compose -f docker-compose.development.yml build
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
SMTP_FROM_NAME=Cap Screen Recorder
```

**Option 2: Resend (Cloud)**

```bash
RESEND_API_KEY=re_xxxxx
RESEND_FROM_DOMAIN=mail.bauer-group.com
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

## Backup & Restore

### Backup

```bash
# MySQL
docker exec ${STACK_NAME}_MYSQL mysqldump -u root -p${DATABASE_PASSWORD} cap > backup.sql

# MinIO
docker run --rm -v ${STACK_NAME}-minio-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/minio-backup.tar.gz /data
```

### Restore

```bash
# MySQL
docker exec -i ${STACK_NAME}_MYSQL mysql -u root -p${DATABASE_PASSWORD} cap < backup.sql

# MinIO
docker run --rm -v ${STACK_NAME}-minio-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/minio-backup.tar.gz -C /
```

## Troubleshooting

```bash
# View logs
docker compose -f docker-compose.development.yml logs -f

# Check health
docker compose -f docker-compose.development.yml ps

# Reset (WARNING: deletes data!)
docker compose -f docker-compose.development.yml down
docker volume rm ${STACK_NAME}-mysql-data ${STACK_NAME}-minio-data
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
