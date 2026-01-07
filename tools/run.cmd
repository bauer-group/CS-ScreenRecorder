@echo off
REM =============================================================================
REM Development Tools Container Launcher (Windows)
REM Starts an interactive Linux container with all required tools
REM =============================================================================

setlocal

REM Get the project directory (parent of tools folder)
set "TOOLS_DIR=%~dp0"
set "TOOLS_DIR=%TOOLS_DIR:~0,-1%"
for %%I in ("%TOOLS_DIR%\..") do set "PROJECT_DIR=%%~fI"

REM Container/image name
set "IMAGE_NAME=cap-screen-recorder-tools"
set "CONTAINER_NAME=cap-screen-recorder-tools-shell"

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    exit /b 1
)

REM Build if --build flag is passed (force rebuild)
if "%1"=="--build" (
    echo [INFO] Rebuilding tools container...
    docker build -t %IMAGE_NAME% "%TOOLS_DIR%"
    if errorlevel 1 (
        echo [ERROR] Failed to build tools container
        exit /b 1
    )
    echo.
    goto :run_container
)

REM Check if image exists, build if not
docker image inspect %IMAGE_NAME% >nul 2>&1
if errorlevel 1 (
    echo [INFO] Tools image not found. Building...
    docker build -t %IMAGE_NAME% "%TOOLS_DIR%"
    if errorlevel 1 (
        echo [ERROR] Failed to build tools container
        exit /b 1
    )
    echo.
)

:run_container

echo ===========================================
echo  Cap Screen Recorder - Development Tools
echo ===========================================
echo.
echo Available scripts:
echo   ./scripts/generate-secrets.sh   - Generate all required secrets
echo   ./scripts/generate-assets.sh    - Generate logos ^& favicons from source
echo.
echo Branding Assets:
echo   Place logo files in src/branding/logo-source-*.{eps,svg,png}
echo   Run generate-assets.sh to create favicons, app icons, etc.
echo.
echo Docker Image Build:
echo   docker build -t cap-screen-recorder ./src
echo.
echo Type 'exit' to leave the container.
echo ===========================================
echo.

REM Run interactive container
docker run -it --rm ^
    --name %CONTAINER_NAME% ^
    -v "%PROJECT_DIR%:/workspace" ^
    -v /var/run/docker.sock:/var/run/docker.sock ^
    -w /workspace ^
    %IMAGE_NAME%

endlocal
