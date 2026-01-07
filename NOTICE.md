# Third-Party Software Notices

## License Clarification

This repository (Docker Compose files, scripts, patches) is licensed under **MIT**.

The Docker images built from this repository include Cap, which is licensed under
**AGPL-3.0**. Therefore, the resulting Docker images are subject to AGPL-3.0 terms.

**Important:** If you deploy this software as a network service, you must make the
complete source code available to users. The source is available at:

- Cap: <https://github.com/CapSoftware/Cap>
- This repository: <https://github.com/bauer-group/CS-ScreenRecorder>

---

This project includes or depends on the following third-party software:

## Screen Recorder

- **Project**: Cap
- **Source**: <https://github.com/CapSoftware/Cap>
- **License**: AGPL-3.0
- **Copyright**: Cap Software, Inc.

This Docker image builds upon the Cap open-source screen recording platform.
The original Cap source code is cloned during the Docker build process and
modified with custom patches for enterprise deployment.

## Runtime Dependencies

### MySQL

- **Project**: MySQL Community Server
- **Source**: <https://www.mysql.com/>
- **License**: GPL-2.0
- **Image**: `mysql:8.0`

### MinIO

- **Project**: MinIO Object Storage
- **Source**: <https://min.io/>
- **License**: AGPL-3.0
- **Image**: `quay.io/minio/minio`

### Node.js

- **Project**: Node.js
- **Source**: <https://nodejs.org/>
- **License**: MIT
- **Image**: `node:24-alpine`

## Build-Time Dependencies

The following are installed during the Docker build process as part of the
Cap application dependencies. See the Cap repository for a complete list
of npm dependencies and their licenses.

### Key Frameworks

| Package | License | Description |
|---------|---------|-------------|
| Next.js | MIT | React framework |
| React | MIT | UI library |
| NextAuth.js | ISC | Authentication |
| Prisma | Apache-2.0 | Database ORM |
| nodemailer | MIT | Email sending (SMTP patch) |

## Custom Patches

This distribution includes the following patches applied to the Cap source:

### 001-microsoft-entra-id.sh

Adds Microsoft Entra ID (Azure AD) as an OAuth authentication provider.
This patch modifies the NextAuth.js configuration to support enterprise
single sign-on via Microsoft accounts.

### 002-smtp-email.sh

Replaces the Resend cloud email service with standard SMTP support using
nodemailer. This allows self-hosted deployments to use their own mail
servers instead of third-party email APIs.

## Trademarks

- **Cap** is a trademark of Cap Software, Inc.
- **BAUER GROUP** is a trademark of BAUER GROUP.
- **Microsoft**, **Azure**, **Entra ID** are trademarks of Microsoft Corporation.
- **Docker** is a trademark of Docker, Inc.
- **MySQL** is a trademark of Oracle Corporation.

## Disclaimer

This software is provided "as is" without warranty of any kind. The authors
and copyright holders are not liable for any claims, damages, or other
liability arising from the use of this software.
