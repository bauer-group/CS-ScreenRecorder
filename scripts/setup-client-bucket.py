#!/usr/bin/env python3
"""
Setup Client Download Bucket for Screen Recorder
=================================================

This script creates and configures the public 'downloads' bucket on MinIO
for hosting client downloads.

Features:
- Creates 'downloads' bucket if it doesn't exist
- Sets public read policy for anonymous access
- Uploads/updates the download page (index.html)
- Uploads favicon and logo assets
- Replaces logo link with WEB_URL for proper navigation

Usage:
    python3 setup-client-bucket.py

Environment Variables (from .env):
    S3_HOSTNAME          - MinIO hostname (e.g., assets.screenrecorder.app.bauer-group.com)
    MINIO_ROOT_USER      - MinIO admin username
    MINIO_ROOT_PASSWORD  - MinIO admin password
    WEB_URL              - Main application URL (for logo link in download page)

Run from tools container:
    docker compose -f docker-compose.tools.yml run --rm tools python3 /workspace/scripts/setup-client-bucket.py
"""

import os
import sys
import json
from pathlib import Path

try:
    import boto3
    from botocore.client import Config
    from botocore.exceptions import ClientError
    from rich.console import Console
    from rich.panel import Panel
    from rich.progress import Progress, SpinnerColumn, TextColumn
except ImportError:
    print("ERROR: Required packages not installed. Run:")
    print("  pip3 install boto3 rich")
    sys.exit(1)

console = Console()

# Configuration
BUCKET_NAME = "downloads"
ASSETS_DIR = Path("/workspace/assets")
HTML_FILE = ASSETS_DIR / "download-page.html"

# Public read policy for the bucket
PUBLIC_READ_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {"AWS": "*"},
            "Action": ["s3:GetObject"],
            "Resource": [f"arn:aws:s3:::{BUCKET_NAME}/*"]
        },
        {
            "Effect": "Allow",
            "Principal": {"AWS": "*"},
            "Action": ["s3:ListBucket"],
            "Resource": [f"arn:aws:s3:::{BUCKET_NAME}"]
        }
    ]
}


def load_env():
    """Load environment variables from .env file if not already set."""
    env_file = Path("/workspace/.env")
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, value = line.partition('=')
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if key and not os.environ.get(key):
                        os.environ[key] = value


def get_s3_client():
    """Create and return an S3 client configured for MinIO."""
    load_env()

    # Get configuration from environment
    endpoint = os.environ.get('S3_HOSTNAME', 'localhost:9000')
    access_key = os.environ.get('MINIO_ROOT_USER', 'admin')
    secret_key = os.environ.get('MINIO_ROOT_PASSWORD', '')

    # Determine protocol:
    # - HTTP for localhost, 127.0.0.1, or endpoints with port :9000
    # - HTTPS for external hostnames (no port)
    if 'localhost' in endpoint or '127.0.0.1' in endpoint or ':9000' in endpoint:
        protocol = 'http'
    else:
        protocol = 'https'

    endpoint_url = f"{protocol}://{endpoint}"

    console.print(f"[dim]Connecting to: {endpoint_url}[/dim]")

    return boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version='s3v4'),
        region_name='global'
    )


def create_bucket(s3_client):
    """Create the bucket if it doesn't exist."""
    try:
        s3_client.head_bucket(Bucket=BUCKET_NAME)
        console.print(f"[green]✓[/green] Bucket '{BUCKET_NAME}' already exists")
        return True
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        if error_code == '404':
            # Bucket doesn't exist, create it
            try:
                s3_client.create_bucket(Bucket=BUCKET_NAME)
                console.print(f"[green]✓[/green] Created bucket '{BUCKET_NAME}'")
                return True
            except ClientError as create_error:
                console.print(f"[red]✗[/red] Failed to create bucket: {create_error}")
                return False
        else:
            console.print(f"[red]✗[/red] Error checking bucket: {e}")
            return False


def set_bucket_policy(s3_client):
    """Set public read policy on the bucket."""
    try:
        s3_client.put_bucket_policy(
            Bucket=BUCKET_NAME,
            Policy=json.dumps(PUBLIC_READ_POLICY)
        )
        console.print(f"[green]✓[/green] Set public read policy on '{BUCKET_NAME}'")
        return True
    except ClientError as e:
        console.print(f"[red]✗[/red] Failed to set bucket policy: {e}")
        return False


def process_html_template(html_content: str) -> str:
    """
    Process HTML template by replacing placeholders with environment values.

    Placeholders:
    - {WEB_URL} -> Main application URL from environment
    """
    web_url = os.environ.get('WEB_URL', '')

    if web_url:
        # Replace {WEB_URL} placeholder with actual URL
        html_content = html_content.replace('{WEB_URL}', web_url)
        console.print(f"[green]✓[/green] Replaced {{WEB_URL}} placeholder with: {web_url}")
    else:
        # Fallback to "/" if WEB_URL not set
        html_content = html_content.replace('{WEB_URL}', '/')
        console.print("[yellow]![/yellow] WEB_URL not set - using '/' as fallback")

    return html_content


def upload_file(s3_client, local_path: Path, s3_key: str, content_type: str = None):
    """Upload a file to the bucket."""
    if not local_path.exists():
        console.print(f"[yellow]![/yellow] File not found: {local_path}")
        return False

    extra_args = {}
    if content_type:
        extra_args['ContentType'] = content_type

    # Determine content type from extension if not specified
    if not content_type:
        ext = local_path.suffix.lower()
        content_types = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.ico': 'image/x-icon',
            '.exe': 'application/octet-stream',
            '.dmg': 'application/octet-stream',
            '.appimage': 'application/octet-stream',
            '.deb': 'application/vnd.debian.binary-package',
            '.rpm': 'application/x-rpm',
        }
        extra_args['ContentType'] = content_types.get(ext, 'application/octet-stream')

    try:
        s3_client.upload_file(
            str(local_path),
            BUCKET_NAME,
            s3_key,
            ExtraArgs=extra_args
        )
        console.print(f"[green]✓[/green] Uploaded: {s3_key}")
        return True
    except ClientError as e:
        console.print(f"[red]✗[/red] Failed to upload {s3_key}: {e}")
        return False


def upload_html_with_replacements(s3_client, local_path: Path, s3_key: str):
    """Upload HTML file after processing template replacements."""
    if not local_path.exists():
        console.print(f"[yellow]![/yellow] File not found: {local_path}")
        return False

    try:
        # Read and process HTML
        html_content = local_path.read_text(encoding='utf-8')
        processed_html = process_html_template(html_content)

        # Upload processed content
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=s3_key,
            Body=processed_html.encode('utf-8'),
            ContentType='text/html; charset=utf-8'
        )
        console.print(f"[green]✓[/green] Uploaded: {s3_key}")
        return True
    except ClientError as e:
        console.print(f"[red]✗[/red] Failed to upload {s3_key}: {e}")
        return False


def create_favicon_svg():
    """Create a simple favicon SVG."""
    svg_content = '''<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="#FF8500"/>
    <circle cx="50" cy="50" r="30" fill="#1a1a1a"/>
    <circle cx="50" cy="50" r="15" fill="#FF8500"/>
</svg>'''
    return svg_content


def main():
    console.print(Panel.fit(
        "[bold orange1]Screen Recorder - Client Bucket Setup[/bold orange1]\n"
        f"Bucket: [cyan]{BUCKET_NAME}[/cyan]",
        border_style="orange1"
    ))
    console.print()

    # Create S3 client
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task("Connecting to MinIO...", total=None)
        try:
            s3_client = get_s3_client()
            progress.update(task, description="[green]Connected to MinIO[/green]")
        except Exception as e:
            progress.stop()
            console.print(f"[red]✗[/red] Failed to connect: {e}")
            sys.exit(1)

    console.print()

    # Step 1: Create bucket
    console.print("[bold]Step 1: Create/verify bucket[/bold]")
    if not create_bucket(s3_client):
        sys.exit(1)

    # Step 2: Set public policy
    console.print("\n[bold]Step 2: Set public read policy[/bold]")
    if not set_bucket_policy(s3_client):
        sys.exit(1)

    # Step 3: Upload files
    console.print("\n[bold]Step 3: Upload assets[/bold]")

    # Upload index.html (with WEB_URL replacement)
    if HTML_FILE.exists():
        upload_html_with_replacements(s3_client, HTML_FILE, "index.html")
    else:
        console.print(f"[yellow]![/yellow] HTML file not found at {HTML_FILE}")
        console.print("[dim]  Create it at: assets/download-page.html[/dim]")

    # Create and upload favicon
    favicon_path = ASSETS_DIR / "favicon.svg"
    if not favicon_path.exists():
        # Create favicon SVG
        favicon_path.parent.mkdir(parents=True, exist_ok=True)
        favicon_path.write_text(create_favicon_svg())
        console.print(f"[green]✓[/green] Created favicon.svg")
    upload_file(s3_client, favicon_path, "favicon.svg")

    # Summary
    console.print()
    s3_hostname = os.environ.get('S3_HOSTNAME', 'assets.screenrecorder.app.bauer-group.com')
    console.print(Panel.fit(
        f"[bold green]Setup Complete![/bold green]\n\n"
        f"Download page URL:\n"
        f"[cyan]https://{s3_hostname}/{BUCKET_NAME}/[/cyan]\n\n"
        f"Next steps:\n"
        f"1. Run [bold]sync-clients.py[/bold] to download and upload client installers\n"
        f"2. Set [bold]CAP_CLIENT_DOWNLOAD_URL[/bold] in your .env:\n"
        f"   [dim]CAP_CLIENT_DOWNLOAD_URL=https://{s3_hostname}/{BUCKET_NAME}[/dim]",
        border_style="green"
    ))


if __name__ == "__main__":
    main()
