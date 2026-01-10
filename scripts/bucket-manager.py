#!/usr/bin/env python3
"""
Bucket Manager for Screen Recorder
===================================

A comprehensive tool for managing MinIO/S3 buckets.

Features:
- Copy bucket contents (same server or between servers)
- Delete buckets
- Create buckets with proper policies and user access
- Update IAM policies for users (bucket access)

Usage:
    # List all buckets
    python3 bucket-manager.py list

    # Copy bucket on same server
    python3 bucket-manager.py copy --source videos --target media

    # Copy bucket to different server
    python3 bucket-manager.py copy --source videos --target media \
        --target-endpoint https://new-minio.example.com \
        --target-access-key admin \
        --target-secret-key password123

    # Delete a bucket
    python3 bucket-manager.py delete --bucket old-bucket

    # Create a new bucket with standard config
    python3 bucket-manager.py create --bucket media

    # Update user policy for bucket access (after bucket rename)
    python3 bucket-manager.py policy --bucket media --user cap

Environment Variables (from .env):
    S3_HOSTNAME          - MinIO hostname
    MINIO_ROOT_USER      - MinIO admin username
    MINIO_ROOT_PASSWORD  - MinIO admin password
    CAP_AWS_SECRET_KEY   - Service account secret key (for create command)

Note: The 'policy' command requires the MinIO Client (mc) to be installed.
      It is available in the tools container.

Run from tools container:
    docker compose -f docker-compose.tools.yml run --rm tools python3 /workspace/scripts/bucket-manager.py <command>
"""

import os
import sys
import json
import argparse
import subprocess
import tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import boto3
    from botocore.client import Config
    from botocore.exceptions import ClientError
    from rich.console import Console
    from rich.panel import Panel
    from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
    from rich.table import Table
    from rich.prompt import Confirm
except ImportError:
    print("ERROR: Required packages not installed. Run:")
    print("  pip3 install boto3 rich")
    sys.exit(1)

console = Console()


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


def get_s3_client(endpoint: str = None, access_key: str = None, secret_key: str = None, region: str = 'global'):
    """Create and return an S3 client configured for MinIO."""
    load_env()

    if endpoint is None:
        endpoint = os.environ.get('S3_HOSTNAME', 'localhost:9000')
    if access_key is None:
        access_key = os.environ.get('MINIO_ROOT_USER', 'admin')
    if secret_key is None:
        secret_key = os.environ.get('MINIO_ROOT_PASSWORD', '')

    # Determine protocol
    if 'localhost' in endpoint or '127.0.0.1' in endpoint or ':9000' in endpoint:
        protocol = 'http'
    else:
        protocol = 'https'

    # Add protocol if not present
    if not endpoint.startswith('http'):
        endpoint_url = f"{protocol}://{endpoint}"
    else:
        endpoint_url = endpoint

    return boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version='s3v4'),
        region_name=region
    )


def list_objects(s3_client, bucket: str) -> list:
    """List all objects in a bucket."""
    objects = []
    paginator = s3_client.get_paginator('list_objects_v2')

    try:
        for page in paginator.paginate(Bucket=bucket):
            if 'Contents' in page:
                objects.extend(page['Contents'])
    except ClientError as e:
        console.print(f"[red]Error listing objects: {e}[/red]")
        return []

    return objects


def copy_object(source_client, target_client, source_bucket: str, target_bucket: str, key: str) -> bool:
    """Copy a single object from source to target bucket."""
    try:
        # Download from source
        response = source_client.get_object(Bucket=source_bucket, Key=key)
        body = response['Body'].read()
        content_type = response.get('ContentType', 'application/octet-stream')

        # Upload to target
        target_client.put_object(
            Bucket=target_bucket,
            Key=key,
            Body=body,
            ContentType=content_type
        )
        return True
    except ClientError as e:
        console.print(f"[red]Failed to copy {key}: {e}[/red]")
        return False


def cmd_copy(args):
    """Copy bucket contents from source to target."""
    console.print(Panel.fit(
        "[bold orange1]Bucket Manager - Copy[/bold orange1]\n"
        f"Source: [cyan]{args.source}[/cyan] → Target: [cyan]{args.target}[/cyan]",
        border_style="orange1"
    ))

    # Create source client
    console.print("\n[bold]Step 1: Connecting to source[/bold]")
    source_client = get_s3_client(
        endpoint=args.source_endpoint,
        access_key=args.source_access_key,
        secret_key=args.source_secret_key
    )

    try:
        source_client.head_bucket(Bucket=args.source)
        console.print(f"[green]✓[/green] Connected to source bucket '{args.source}'")
    except ClientError as e:
        console.print(f"[red]✗[/red] Source bucket not accessible: {e}")
        return 1

    # Create target client (same or different server)
    console.print("\n[bold]Step 2: Connecting to target[/bold]")
    if args.target_endpoint:
        target_client = get_s3_client(
            endpoint=args.target_endpoint,
            access_key=args.target_access_key,
            secret_key=args.target_secret_key
        )
        console.print(f"[dim]Using different target server: {args.target_endpoint}[/dim]")
    else:
        target_client = source_client
        console.print("[dim]Using same server for target[/dim]")

    # Check if target bucket exists, create if not
    try:
        target_client.head_bucket(Bucket=args.target)
        console.print(f"[green]✓[/green] Target bucket '{args.target}' exists")
    except ClientError:
        if args.create_target:
            console.print(f"[yellow]![/yellow] Creating target bucket '{args.target}'...")
            target_client.create_bucket(Bucket=args.target)
            console.print(f"[green]✓[/green] Created target bucket '{args.target}'")
        else:
            console.print(f"[red]✗[/red] Target bucket does not exist. Use --create-target to create it.")
            return 1

    # List source objects
    console.print("\n[bold]Step 3: Listing source objects[/bold]")
    objects = list_objects(source_client, args.source)

    if not objects:
        console.print("[yellow]![/yellow] No objects found in source bucket")
        return 0

    console.print(f"[green]✓[/green] Found {len(objects)} objects to copy")

    # Calculate total size
    total_size = sum(obj['Size'] for obj in objects)
    console.print(f"[dim]Total size: {total_size / (1024*1024):.2f} MB[/dim]")

    # Confirm before copying
    if not args.yes:
        if not Confirm.ask(f"Copy {len(objects)} objects from '{args.source}' to '{args.target}'?"):
            console.print("[yellow]Cancelled[/yellow]")
            return 0

    # Copy objects
    console.print("\n[bold]Step 4: Copying objects[/bold]")
    success_count = 0
    failed_count = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console
    ) as progress:
        task = progress.add_task("Copying...", total=len(objects))

        for obj in objects:
            key = obj['Key']
            progress.update(task, description=f"[cyan]{key[:50]}...[/cyan]" if len(key) > 50 else f"[cyan]{key}[/cyan]")

            if copy_object(source_client, target_client, args.source, args.target, key):
                success_count += 1
            else:
                failed_count += 1

            progress.advance(task)

    # Summary
    console.print(Panel.fit(
        f"[bold green]Copy Complete![/bold green]\n\n"
        f"Copied: [green]{success_count}[/green]\n"
        f"Failed: [red]{failed_count}[/red]",
        border_style="green" if failed_count == 0 else "yellow"
    ))

    return 0 if failed_count == 0 else 1


def cmd_delete(args):
    """Delete a bucket and all its contents."""
    console.print(Panel.fit(
        "[bold red]Bucket Manager - Delete[/bold red]\n"
        f"Bucket: [cyan]{args.bucket}[/cyan]",
        border_style="red"
    ))

    # Connect to MinIO
    console.print("\n[bold]Step 1: Connecting to MinIO[/bold]")
    s3_client = get_s3_client()

    try:
        s3_client.head_bucket(Bucket=args.bucket)
        console.print(f"[green]✓[/green] Found bucket '{args.bucket}'")
    except ClientError as e:
        console.print(f"[red]✗[/red] Bucket not found: {e}")
        return 1

    # List objects
    console.print("\n[bold]Step 2: Listing objects[/bold]")
    objects = list_objects(s3_client, args.bucket)
    console.print(f"[dim]Found {len(objects)} objects[/dim]")

    # Confirm deletion
    if not args.yes:
        console.print(f"\n[bold red]WARNING:[/bold red] This will permanently delete:")
        console.print(f"  - Bucket: [cyan]{args.bucket}[/cyan]")
        console.print(f"  - Objects: [cyan]{len(objects)}[/cyan]")
        if not Confirm.ask("Are you sure you want to delete this bucket?", default=False):
            console.print("[yellow]Cancelled[/yellow]")
            return 0

    # Delete all objects first
    if objects:
        console.print("\n[bold]Step 3: Deleting objects[/bold]")

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=console
        ) as progress:
            task = progress.add_task("Deleting...", total=len(objects))

            # Delete in batches of 1000 (S3 limit)
            for i in range(0, len(objects), 1000):
                batch = objects[i:i+1000]
                delete_objects = [{'Key': obj['Key']} for obj in batch]

                try:
                    s3_client.delete_objects(
                        Bucket=args.bucket,
                        Delete={'Objects': delete_objects}
                    )
                except ClientError as e:
                    console.print(f"[red]Error deleting objects: {e}[/red]")

                progress.advance(task, len(batch))

        console.print(f"[green]✓[/green] Deleted {len(objects)} objects")

    # Delete bucket
    console.print("\n[bold]Step 4: Deleting bucket[/bold]")
    try:
        s3_client.delete_bucket(Bucket=args.bucket)
        console.print(f"[green]✓[/green] Deleted bucket '{args.bucket}'")
    except ClientError as e:
        console.print(f"[red]✗[/red] Failed to delete bucket: {e}")
        return 1

    console.print(Panel.fit(
        f"[bold green]Bucket Deleted![/bold green]\n\n"
        f"Bucket: [cyan]{args.bucket}[/cyan]\n"
        f"Objects removed: [cyan]{len(objects)}[/cyan]",
        border_style="green"
    ))

    return 0


def cmd_create(args):
    """Create a new bucket with standard configuration."""
    console.print(Panel.fit(
        "[bold orange1]Bucket Manager - Create[/bold orange1]\n"
        f"Bucket: [cyan]{args.bucket}[/cyan]",
        border_style="orange1"
    ))

    load_env()

    # Get credentials
    endpoint = os.environ.get('S3_HOSTNAME', 'localhost:9000')
    admin_user = os.environ.get('MINIO_ROOT_USER', 'admin')
    admin_password = os.environ.get('MINIO_ROOT_PASSWORD', '')
    service_user = args.service_user or 'cap'
    service_key = args.service_key or os.environ.get('CAP_AWS_SECRET_KEY', '')

    if not admin_password:
        console.print("[red]✗[/red] MINIO_ROOT_PASSWORD not set")
        return 1

    if not service_key and not args.no_user:
        console.print("[red]✗[/red] CAP_AWS_SECRET_KEY not set (required for service user)")
        console.print("[dim]  Use --no-user to skip service user creation[/dim]")
        return 1

    # Connect to MinIO
    console.print("\n[bold]Step 1: Connecting to MinIO[/bold]")
    s3_client = get_s3_client()
    console.print(f"[green]✓[/green] Connected to MinIO")

    # Check if bucket exists
    try:
        s3_client.head_bucket(Bucket=args.bucket)
        if not args.force:
            console.print(f"[yellow]![/yellow] Bucket '{args.bucket}' already exists")
            console.print("[dim]  Use --force to reconfigure anyway[/dim]")
            return 0
        console.print(f"[yellow]![/yellow] Bucket '{args.bucket}' exists, reconfiguring...")
    except ClientError:
        # Create bucket
        console.print("\n[bold]Step 2: Creating bucket[/bold]")
        try:
            s3_client.create_bucket(Bucket=args.bucket)
            console.print(f"[green]✓[/green] Created bucket '{args.bucket}'")
        except ClientError as e:
            console.print(f"[red]✗[/red] Failed to create bucket: {e}")
            return 1

    # Set public read policy if requested
    if args.public:
        console.print("\n[bold]Step 3: Setting public read policy[/bold]")
        public_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": "*"},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{args.bucket}/*"]
                }
            ]
        }
        try:
            s3_client.put_bucket_policy(
                Bucket=args.bucket,
                Policy=json.dumps(public_policy)
            )
            console.print(f"[green]✓[/green] Set public read policy")
        except ClientError as e:
            console.print(f"[yellow]![/yellow] Could not set bucket policy: {e}")

    # Note about service user (requires mc CLI)
    if not args.no_user:
        console.print("\n[bold]Step 4: Service user configuration[/bold]")
        console.print("[dim]Note: Service user and IAM policies require MinIO mc CLI.[/dim]")
        console.print("[dim]Run the minio-setup container or use mc directly:[/dim]")
        console.print()

        # Generate the IAM policy
        policy_json = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject",
                        "s3:PutObject",
                        "s3:DeleteObject",
                        "s3:AbortMultipartUpload",
                        "s3:ListMultipartUploadParts"
                    ],
                    "Resource": f"arn:aws:s3:::{args.bucket}/*"
                },
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:ListBucket",
                        "s3:GetBucketLocation"
                    ],
                    "Resource": f"arn:aws:s3:::{args.bucket}"
                }
            ]
        }

        policy_name = f"{args.bucket}-policy"

        console.print(f"[cyan]# Create/update service user[/cyan]")
        console.print(f"mc admin user add minio {service_user} <SECRET_KEY>")
        console.print()
        console.print(f"[cyan]# Create policy file[/cyan]")
        console.print(f"cat > /tmp/{policy_name}.json << 'EOF'")
        console.print(json.dumps(policy_json, indent=2))
        console.print("EOF")
        console.print()
        console.print(f"[cyan]# Apply policy[/cyan]")
        console.print(f"mc admin policy create minio {policy_name} /tmp/{policy_name}.json")
        console.print(f"mc admin policy attach minio {policy_name} --user {service_user}")

    # Summary
    console.print(Panel.fit(
        f"[bold green]Bucket Created![/bold green]\n\n"
        f"Bucket: [cyan]{args.bucket}[/cyan]\n"
        f"Public: [cyan]{'Yes' if args.public else 'No'}[/cyan]\n"
        f"Service User: [cyan]{service_user if not args.no_user else 'Skipped'}[/cyan]",
        border_style="green"
    ))

    return 0


def cmd_list(args):
    """List all buckets."""
    console.print(Panel.fit(
        "[bold orange1]Bucket Manager - List[/bold orange1]",
        border_style="orange1"
    ))

    # Connect to MinIO
    s3_client = get_s3_client()

    try:
        response = s3_client.list_buckets()
        buckets = response.get('Buckets', [])
    except ClientError as e:
        console.print(f"[red]✗[/red] Failed to list buckets: {e}")
        return 1

    if not buckets:
        console.print("[yellow]No buckets found[/yellow]")
        return 0

    # Create table
    table = Table(show_header=True, header_style="bold")
    table.add_column("Bucket")
    table.add_column("Created")
    table.add_column("Objects")
    table.add_column("Size")

    for bucket in buckets:
        name = bucket['Name']
        created = bucket['CreationDate'].strftime('%Y-%m-%d %H:%M')

        # Get object count and size
        objects = list_objects(s3_client, name)
        obj_count = len(objects)
        total_size = sum(obj['Size'] for obj in objects)
        size_str = f"{total_size / (1024*1024):.2f} MB" if total_size > 0 else "0 B"

        table.add_row(name, created, str(obj_count), size_str)

    console.print(table)
    return 0


def run_mc_command(cmd: list, description: str = None) -> tuple:
    """
    Run a MinIO mc CLI command.
    Returns (success: bool, output: str)
    """
    load_env()

    # Get credentials
    endpoint = os.environ.get('S3_HOSTNAME', 'localhost:9000')
    admin_user = os.environ.get('MINIO_ROOT_USER', 'admin')
    admin_password = os.environ.get('MINIO_ROOT_PASSWORD', '')

    # Determine protocol
    if 'localhost' in endpoint or '127.0.0.1' in endpoint or ':9000' in endpoint:
        protocol = 'http'
    else:
        protocol = 'https'

    endpoint_url = f"{protocol}://{endpoint}"

    # First, configure the mc alias
    alias_cmd = ['mc', 'alias', 'set', 'minio', endpoint_url, admin_user, admin_password, '--api', 's3v4']

    try:
        result = subprocess.run(
            alias_cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode != 0:
            return False, f"Failed to configure mc alias: {result.stderr}"
    except subprocess.TimeoutExpired:
        return False, "mc alias command timed out"
    except FileNotFoundError:
        return False, "mc CLI not found. Please install MinIO Client (mc)"
    except Exception as e:
        return False, f"Error configuring mc alias: {e}"

    # Now run the actual command
    if description:
        console.print(f"[dim]Running: {description}[/dim]")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            return True, result.stdout
        else:
            return False, result.stderr
    except subprocess.TimeoutExpired:
        return False, "Command timed out"
    except Exception as e:
        return False, f"Error running command: {e}"


def cmd_policy(args):
    """Update IAM policy for a MinIO user to access a specific bucket."""
    console.print(Panel.fit(
        "[bold orange1]Bucket Manager - Policy[/bold orange1]\n"
        f"Bucket: [cyan]{args.bucket}[/cyan]\n"
        f"User: [cyan]{args.user}[/cyan]",
        border_style="orange1"
    ))

    load_env()

    # Build the policy
    policy_name = f"{args.user}-policy"

    if args.policy_name:
        policy_name = args.policy_name

    console.print("\n[bold]Step 1: Creating policy document[/bold]")

    policy_json = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:DeleteObject",
                    "s3:AbortMultipartUpload",
                    "s3:ListMultipartUploadParts"
                ],
                "Resource": f"arn:aws:s3:::{args.bucket}/*"
            },
            {
                "Effect": "Allow",
                "Action": [
                    "s3:ListBucket",
                    "s3:GetBucketLocation"
                ],
                "Resource": f"arn:aws:s3:::{args.bucket}"
            }
        ]
    }

    console.print(f"[green]✓[/green] Policy document created for bucket '{args.bucket}'")

    # Create temporary policy file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(policy_json, f, indent=2)
        policy_file = f.name

    try:
        # Step 2: Check if user exists
        console.print("\n[bold]Step 2: Checking user exists[/bold]")
        success, output = run_mc_command(
            ['mc', 'admin', 'user', 'info', 'minio', args.user],
            f"mc admin user info minio {args.user}"
        )

        if not success:
            console.print(f"[red]✗[/red] User '{args.user}' not found or error: {output}")
            console.print("[dim]  Create the user first or check the username[/dim]")
            return 1

        console.print(f"[green]✓[/green] User '{args.user}' exists")

        # Step 3: Remove old policy if it exists (we'll recreate it)
        console.print("\n[bold]Step 3: Updating policy[/bold]")

        # Try to remove existing policy first (ignore errors if it doesn't exist)
        run_mc_command(
            ['mc', 'admin', 'policy', 'detach', 'minio', policy_name, '--user', args.user],
            f"Detaching old policy '{policy_name}' from user"
        )

        # Delete old policy (ignore errors)
        run_mc_command(
            ['mc', 'admin', 'policy', 'remove', 'minio', policy_name],
            f"Removing old policy '{policy_name}'"
        )

        # Create new policy
        success, output = run_mc_command(
            ['mc', 'admin', 'policy', 'create', 'minio', policy_name, policy_file],
            f"Creating policy '{policy_name}'"
        )

        if not success:
            console.print(f"[red]✗[/red] Failed to create policy: {output}")
            return 1

        console.print(f"[green]✓[/green] Created policy '{policy_name}'")

        # Step 4: Attach policy to user
        console.print("\n[bold]Step 4: Attaching policy to user[/bold]")
        success, output = run_mc_command(
            ['mc', 'admin', 'policy', 'attach', 'minio', policy_name, '--user', args.user],
            f"Attaching policy to user '{args.user}'"
        )

        if not success:
            console.print(f"[red]✗[/red] Failed to attach policy: {output}")
            return 1

        console.print(f"[green]✓[/green] Attached policy to user '{args.user}'")

        # Step 5: Verify
        console.print("\n[bold]Step 5: Verifying configuration[/bold]")
        success, output = run_mc_command(
            ['mc', 'admin', 'user', 'info', 'minio', args.user],
            f"Verifying user '{args.user}'"
        )

        if success:
            console.print(f"[green]✓[/green] User configuration verified")
            if args.verbose:
                console.print(f"[dim]{output}[/dim]")

    finally:
        # Clean up temp file
        try:
            os.unlink(policy_file)
        except Exception:
            pass

    # Summary
    console.print(Panel.fit(
        f"[bold green]Policy Updated![/bold green]\n\n"
        f"User: [cyan]{args.user}[/cyan]\n"
        f"Policy: [cyan]{policy_name}[/cyan]\n"
        f"Bucket: [cyan]{args.bucket}[/cyan]\n\n"
        f"User now has access to:\n"
        f"  - [cyan]arn:aws:s3:::{args.bucket}/*[/cyan] (objects)\n"
        f"  - [cyan]arn:aws:s3:::{args.bucket}[/cyan] (bucket)",
        border_style="green"
    ))

    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Bucket Manager for Screen Recorder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List all buckets
  python3 bucket-manager.py list

  # Copy bucket on same server
  python3 bucket-manager.py copy --source videos --target media --create-target

  # Copy to different server
  python3 bucket-manager.py copy --source videos --target media \\
      --target-endpoint https://new-minio.example.com \\
      --target-access-key admin --target-secret-key secret123

  # Delete a bucket
  python3 bucket-manager.py delete --bucket old-bucket

  # Create a new bucket with public read
  python3 bucket-manager.py create --bucket media --public

  # Update user policy for a bucket (after bucket rename)
  python3 bucket-manager.py policy --bucket media --user cap
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to run')

    # List command
    list_parser = subparsers.add_parser('list', help='List all buckets')

    # Copy command
    copy_parser = subparsers.add_parser('copy', help='Copy bucket contents')
    copy_parser.add_argument('--source', '-s', required=True, help='Source bucket name')
    copy_parser.add_argument('--target', '-t', required=True, help='Target bucket name')
    copy_parser.add_argument('--create-target', action='store_true', help='Create target bucket if it does not exist')
    copy_parser.add_argument('--yes', '-y', action='store_true', help='Skip confirmation')

    # Source server options
    copy_parser.add_argument('--source-endpoint', help='Source server endpoint (default: from env)')
    copy_parser.add_argument('--source-access-key', help='Source server access key')
    copy_parser.add_argument('--source-secret-key', help='Source server secret key')

    # Target server options
    copy_parser.add_argument('--target-endpoint', help='Target server endpoint (default: same as source)')
    copy_parser.add_argument('--target-access-key', help='Target server access key')
    copy_parser.add_argument('--target-secret-key', help='Target server secret key')

    # Delete command
    delete_parser = subparsers.add_parser('delete', help='Delete a bucket')
    delete_parser.add_argument('--bucket', '-b', required=True, help='Bucket name to delete')
    delete_parser.add_argument('--yes', '-y', action='store_true', help='Skip confirmation')

    # Create command
    create_parser = subparsers.add_parser('create', help='Create a new bucket')
    create_parser.add_argument('--bucket', '-b', required=True, help='Bucket name to create')
    create_parser.add_argument('--public', action='store_true', help='Enable public read access')
    create_parser.add_argument('--no-user', action='store_true', help='Skip service user configuration')
    create_parser.add_argument('--service-user', default='cap', help='Service user name (default: cap)')
    create_parser.add_argument('--service-key', help='Service user secret key (default: from CAP_AWS_SECRET_KEY)')
    create_parser.add_argument('--force', action='store_true', help='Reconfigure even if bucket exists')

    # Policy command
    policy_parser = subparsers.add_parser('policy', help='Update IAM policy for a user')
    policy_parser.add_argument('--bucket', '-b', required=True, help='Bucket name to grant access to')
    policy_parser.add_argument('--user', '-u', required=True, help='MinIO user name')
    policy_parser.add_argument('--policy-name', '-p', help='Custom policy name (default: <user>-policy)')
    policy_parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed output')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    load_env()

    if args.command == 'list':
        return cmd_list(args)
    elif args.command == 'copy':
        return cmd_copy(args)
    elif args.command == 'delete':
        return cmd_delete(args)
    elif args.command == 'create':
        return cmd_create(args)
    elif args.command == 'policy':
        return cmd_policy(args)

    return 0


if __name__ == "__main__":
    sys.exit(main())
