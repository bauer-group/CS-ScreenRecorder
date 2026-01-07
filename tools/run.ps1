# =============================================================================
# Development Tools Container Launcher (PowerShell)
# Starts an interactive Linux container with all required tools
# =============================================================================

param(
    [switch]$Build,
    [string]$Script
)

$ErrorActionPreference = "Stop"

# Configuration - get project dir (parent of tools folder)
$ToolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ToolsDir
$ImageName = "cap-screen-recorder-tools"
$ContainerName = "cap-screen-recorder-tools-shell"

# Check if Docker is running
try {
    docker info 2>&1 | Out-Null
} catch {
    Write-Host "[ERROR] Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if image exists
docker image inspect $ImageName 2>&1 | Out-Null
$imageExists = $LASTEXITCODE -eq 0

# Build if explicitly requested with -Build flag, or if image doesn't exist
if ($Build) {
    Write-Host "[INFO] Rebuilding tools container..." -ForegroundColor Cyan
    docker build -t $ImageName "$ToolsDir"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to build tools container" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
} elseif (-not $imageExists) {
    Write-Host "[INFO] Tools image not found. Building..." -ForegroundColor Cyan
    docker build -t $ImageName "$ToolsDir"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to build tools container" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

# If a script is specified, run it directly
if ($Script) {
    Write-Host "[INFO] Running: $Script" -ForegroundColor Cyan
    docker run --rm `
        -v "${ProjectDir}:/workspace" `
        -v /var/run/docker.sock:/var/run/docker.sock `
        -w /workspace `
        $ImageName `
        /bin/bash -c $Script
    exit $LASTEXITCODE
}

# Interactive mode
Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host " Cap Screen Recorder - Development Tools" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Available scripts:"
Write-Host "  ./scripts/generate-secrets.sh   - Generate all required secrets" -ForegroundColor Yellow
Write-Host "  ./scripts/generate-assets.sh    - Generate logos & favicons from source" -ForegroundColor Yellow
Write-Host ""
Write-Host "Branding Assets:"
Write-Host "  Place logo files in src/branding/logo-source-*.{eps,svg,png}"
Write-Host "  Run generate-assets.sh to create favicons, app icons, etc."
Write-Host ""
Write-Host "Docker Image Build:"
Write-Host "  docker build -t cap-screen-recorder ./src"
Write-Host ""
Write-Host "Type 'exit' to leave the container."
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""

# Run interactive container
docker run -it --rm `
    --name $ContainerName `
    -v "${ProjectDir}:/workspace" `
    -v /var/run/docker.sock:/var/run/docker.sock `
    -w /workspace `
    $ImageName
