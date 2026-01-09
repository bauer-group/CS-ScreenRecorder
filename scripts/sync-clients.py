#!/usr/bin/env python3
"""
Sync Cap Client Installers to MinIO Bucket
==========================================

This script downloads the official Cap client installers from GitHub releases
and uploads them to your MinIO bucket for local distribution.

Features:
- Fetches release from Cap GitHub repository (uses CAP_VERSION from .env)
- Supports both GitHub assets and CrabNebula CDN downloads
- Downloads all available platform installers (Windows, macOS, Linux)
- Uploads to MinIO with standardized lowercase filenames
- Shows download progress

Usage:
    python3 sync-clients.py [--version VERSION]

Arguments:
    --version VERSION  Specific version tag (e.g., cap-v0.4.1)
                       If not specified, uses CAP_VERSION from .env

Environment Variables (from .env):
    CAP_VERSION          - Version to sync (should match your server!)
    S3_HOSTNAME          - MinIO hostname
    MINIO_ROOT_USER      - MinIO admin username
    MINIO_ROOT_PASSWORD  - MinIO admin password

Run from tools container:
    docker compose -f docker-compose.tools.yml run --rm tools python3 /workspace/scripts/sync-clients.py
"""

import os
import sys
import re
import argparse
import tempfile
import shutil
from pathlib import Path
from urllib.parse import urlparse

try:
    import boto3
    import requests
    from botocore.client import Config
    from botocore.exceptions import ClientError
    from rich.console import Console
    from rich.panel import Panel
    from rich.progress import (
        Progress, SpinnerColumn, TextColumn, BarColumn,
        DownloadColumn, TransferSpeedColumn, TimeRemainingColumn
    )
    from rich.table import Table
except ImportError:
    print("ERROR: Required packages not installed. Run:")
    print("  pip3 install boto3 requests rich")
    sys.exit(1)

console = Console()

# Configuration
BUCKET_NAME = "clients"
GITHUB_REPO = "CapSoftware/Cap"
GITHUB_API_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases"

# =============================================================================
# Asset mappings for GitHub release assets (older releases)
# Format: (pattern_in_name, target_filename, content_type)
# =============================================================================
GITHUB_ASSET_MAPPINGS = [
    # Windows
    ("_x64-setup.exe", "cap-windows-x64.exe", "application/octet-stream"),
    ("_x64_en-US.msi", "cap-windows-x64.msi", "application/octet-stream"),
    ("_arm64-setup.exe", "cap-windows-arm64.exe", "application/octet-stream"),

    # macOS
    ("_universal.dmg", "cap-macos-universal.dmg", "application/octet-stream"),
    ("_x64.dmg", "cap-macos-x64.dmg", "application/octet-stream"),
    ("_aarch64.dmg", "cap-macos-arm64.dmg", "application/octet-stream"),

    # Linux
    ("_amd64.AppImage", "cap-linux-x64.AppImage", "application/octet-stream"),
    ("_amd64.deb", "cap-linux-x64.deb", "application/vnd.debian.binary-package"),
    ("_x86_64.rpm", "cap-linux-x64.rpm", "application/x-rpm"),
]

# =============================================================================
# CrabNebula CDN mappings (newer releases since ~v0.3.x)
# Maps markdown link text patterns to target filenames
# =============================================================================
CRABNEBULA_MAPPINGS = [
    # Pattern in release body -> (target_filename, content_type, file_extension)
    (r"macOS.*Apple Silicon", "cap-macos-arm64.dmg", "application/octet-stream", ".dmg"),
    (r"macOS.*Intel", "cap-macos-x64.dmg", "application/octet-stream", ".dmg"),
    (r"Windows", "cap-windows-x64.exe", "application/octet-stream", ".exe"),
    # Linux (if available in future)
    (r"Linux.*AppImage", "cap-linux-x64.AppImage", "application/octet-stream", ".AppImage"),
    (r"Linux.*deb", "cap-linux-x64.deb", "application/vnd.debian.binary-package", ".deb"),
]


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
    console.print(f"[dim]S3 Endpoint: {endpoint_url}[/dim]")

    return boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version='s3v4'),
        region_name='us-east-1'
    )


def get_latest_release():
    """Fetch the latest release from GitHub."""
    response = requests.get(
        f"{GITHUB_API_URL}/latest",
        headers={"Accept": "application/vnd.github+json"}
    )
    response.raise_for_status()
    return response.json()


def get_release_by_tag(tag: str):
    """Fetch a specific release by tag from GitHub."""
    response = requests.get(
        f"{GITHUB_API_URL}/tags/{tag}",
        headers={"Accept": "application/vnd.github+json"}
    )
    response.raise_for_status()
    return response.json()


def find_matching_asset(assets: list, pattern: str):
    """Find a GitHub asset matching the given pattern."""
    for asset in assets:
        if pattern in asset['name']:
            return asset
    return None


def parse_crabnebula_downloads(release_body: str) -> list:
    """
    Parse release body for CrabNebula CDN download links.

    Returns list of tuples: (platform_text, url, target_filename, content_type)
    """
    downloads = []

    if not release_body:
        return downloads

    # Find all markdown links with cdn.crabnebula.app
    # Pattern: [text](url) or **text**: url
    patterns = [
        # Markdown link: [macOS (Apple Silicon)](https://cdn.crabnebula.app/...)
        r'\[([^\]]+)\]\((https://cdn\.crabnebula\.app/[^)]+)\)',
        # Bold text with URL: **macOS (Apple Silicon)**: https://cdn.crabnebula.app/...
        r'\*\*([^*]+)\*\*[:\s]+(https://cdn\.crabnebula\.app/\S+)',
        # Plain text with URL: - macOS (Apple Silicon): https://cdn.crabnebula.app/...
        r'-\s*([^:]+):\s*(https://cdn\.crabnebula\.app/\S+)',
    ]

    found_urls = {}  # Deduplicate by URL

    for pattern in patterns:
        matches = re.findall(pattern, release_body, re.IGNORECASE)
        for platform_text, url in matches:
            if url not in found_urls:
                found_urls[url] = platform_text.strip()

    # Map found URLs to our target filenames
    for url, platform_text in found_urls.items():
        for pattern, target_name, content_type, ext in CRABNEBULA_MAPPINGS:
            if re.search(pattern, platform_text, re.IGNORECASE):
                downloads.append((platform_text, url, target_name, content_type))
                break
        else:
            # Unknown platform - use generic name based on URL
            console.print(f"[yellow]![/yellow] Unknown platform: {platform_text}")

    return downloads


def download_file(url: str, dest_path: Path, progress: Progress, task_id) -> bool:
    """Download a file with progress tracking."""
    try:
        # Follow redirects and get final response
        response = requests.get(url, stream=True, allow_redirects=True)
        response.raise_for_status()

        total_size = int(response.headers.get('content-length', 0))
        progress.update(task_id, total=total_size)

        with open(dest_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    progress.update(task_id, advance=len(chunk))

        return True
    except Exception as e:
        console.print(f"[red]Download failed: {e}[/red]")
        return False


def upload_to_s3(s3_client, local_path: Path, s3_key: str, content_type: str) -> bool:
    """Upload a file to S3/MinIO."""
    try:
        s3_client.upload_file(
            str(local_path),
            BUCKET_NAME,
            s3_key,
            ExtraArgs={'ContentType': content_type}
        )
        return True
    except ClientError as e:
        console.print(f"[red]Upload failed: {e}[/red]")
        return False


def main():
    parser = argparse.ArgumentParser(description="Sync Cap clients to MinIO bucket")
    parser.add_argument('--version', '-v', help="Specific version tag (e.g., cap-v0.4.1)")
    args = parser.parse_args()

    load_env()

    console.print(Panel.fit(
        "[bold orange1]Screen Recorder - Client Sync[/bold orange1]\n"
        f"Repository: [cyan]{GITHUB_REPO}[/cyan]",
        border_style="orange1"
    ))
    console.print()

    # Get version to download - prefer CLI arg, then env var
    version = args.version or os.environ.get('CAP_VERSION', None)

    # Fetch release information
    console.print("[bold]Step 1: Fetching release information[/bold]")
    try:
        if version:
            console.print(f"[dim]Looking for version: {version}[/dim]")
            release = get_release_by_tag(version)
        else:
            console.print("[dim]Fetching latest release...[/dim]")
            console.print("[yellow]![/yellow] No CAP_VERSION set - using latest release")
            release = get_latest_release()

        release_tag = release['tag_name']
        release_name = release.get('name', release_tag)
        github_assets = release.get('assets', [])
        release_body = release.get('body', '')

        console.print(f"[green]✓[/green] Found release: {release_name} ({release_tag})")

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            console.print(f"[red]✗[/red] Release not found: {version}")
            console.print("[dim]  Check available releases at:[/dim]")
            console.print(f"[dim]  https://github.com/{GITHUB_REPO}/releases[/dim]")
        else:
            console.print(f"[red]✗[/red] Failed to fetch release: {e}")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]✗[/red] Error: {e}")
        sys.exit(1)

    # Determine download source: GitHub assets or CrabNebula CDN
    crabnebula_downloads = []
    if github_assets:
        console.print(f"[dim]  Source: GitHub Assets ({len(github_assets)} files)[/dim]")
    else:
        # Parse release body for CrabNebula downloads
        crabnebula_downloads = parse_crabnebula_downloads(release_body)
        if crabnebula_downloads:
            console.print(f"[dim]  Source: CrabNebula CDN ({len(crabnebula_downloads)} files)[/dim]")
        else:
            console.print("[yellow]![/yellow] No downloads found in release")

    # Connect to MinIO
    console.print("\n[bold]Step 2: Connecting to MinIO[/bold]")
    try:
        s3_client = get_s3_client()
        s3_client.head_bucket(Bucket=BUCKET_NAME)
        console.print(f"[green]✓[/green] Connected to bucket '{BUCKET_NAME}'")
    except ClientError as e:
        console.print(f"[red]✗[/red] Bucket not accessible: {e}")
        console.print("[dim]  Run setup-client-bucket.py first[/dim]")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]✗[/red] Connection failed: {e}")
        sys.exit(1)

    # Create temp directory for downloads
    temp_dir = Path(tempfile.mkdtemp(prefix="cap-clients-"))
    console.print(f"[dim]Temp directory: {temp_dir}[/dim]")

    # Download and upload assets
    console.print("\n[bold]Step 3: Downloading and uploading clients[/bold]")

    results = []
    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            DownloadColumn(),
            TransferSpeedColumn(),
            TimeRemainingColumn(),
            console=console
        ) as progress:

            # Method 1: GitHub Assets (older releases)
            if github_assets:
                for pattern, target_name, content_type in GITHUB_ASSET_MAPPINGS:
                    asset = find_matching_asset(github_assets, pattern)

                    if not asset:
                        results.append((target_name, "Not found", "yellow"))
                        continue

                    # Download
                    download_url = asset['browser_download_url']
                    local_file = temp_dir / target_name
                    file_size = asset.get('size', 0)

                    task = progress.add_task(
                        f"[cyan]Downloading {target_name}[/cyan]",
                        total=file_size
                    )

                    if not download_file(download_url, local_file, progress, task):
                        results.append((target_name, "Download failed", "red"))
                        continue

                    progress.update(task, description=f"[cyan]Uploading {target_name}[/cyan]")

                    # Upload
                    if upload_to_s3(s3_client, local_file, target_name, content_type):
                        size_mb = local_file.stat().st_size / (1024 * 1024)
                        results.append((target_name, f"✓ {size_mb:.1f} MB", "green"))
                    else:
                        results.append((target_name, "Upload failed", "red"))

                    # Remove temp file
                    local_file.unlink(missing_ok=True)

            # Method 2: CrabNebula CDN (newer releases)
            elif crabnebula_downloads:
                for platform_text, download_url, target_name, content_type in crabnebula_downloads:
                    local_file = temp_dir / target_name

                    task = progress.add_task(
                        f"[cyan]Downloading {target_name}[/cyan]",
                        total=None  # Unknown size until we start
                    )

                    if not download_file(download_url, local_file, progress, task):
                        results.append((target_name, "Download failed", "red"))
                        continue

                    progress.update(task, description=f"[cyan]Uploading {target_name}[/cyan]")

                    # Upload
                    if upload_to_s3(s3_client, local_file, target_name, content_type):
                        size_mb = local_file.stat().st_size / (1024 * 1024)
                        results.append((target_name, f"✓ {size_mb:.1f} MB", "green"))
                    else:
                        results.append((target_name, "Upload failed", "red"))

                    # Remove temp file
                    local_file.unlink(missing_ok=True)

    finally:
        # Cleanup temp directory
        shutil.rmtree(temp_dir, ignore_errors=True)

    # Summary table
    console.print("\n[bold]Summary[/bold]")
    table = Table(show_header=True, header_style="bold")
    table.add_column("File")
    table.add_column("Status")

    for filename, status, color in results:
        table.add_row(filename, f"[{color}]{status}[/{color}]")

    console.print(table)

    # Upload version info
    try:
        version_info = f"{release_tag}\n"
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key="version.txt",
            Body=version_info.encode(),
            ContentType="text/plain"
        )
        console.print(f"\n[green]✓[/green] Version file updated: {release_tag}")
    except Exception:
        pass

    # Final info
    s3_hostname = os.environ.get('S3_HOSTNAME', 'assets.screenrecorder.app.bauer-group.com')
    success_count = sum(1 for _, status, color in results if color == "green")
    total_count = len(results) if results else len(GITHUB_ASSET_MAPPINGS)

    console.print(Panel.fit(
        f"[bold green]Sync Complete![/bold green]\n\n"
        f"Version: [cyan]{release_tag}[/cyan]\n"
        f"Files uploaded: [cyan]{success_count}/{total_count}[/cyan]\n\n"
        f"Download URL:\n"
        f"[cyan]https://{s3_hostname}/{BUCKET_NAME}/[/cyan]",
        border_style="green"
    ))


if __name__ == "__main__":
    main()
