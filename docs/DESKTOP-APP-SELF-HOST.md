# Connect Cap Desktop App to Self-Hosted Server

This guide explains how to connect the Cap Desktop application to your self-hosted Cap instance.

**[Deutsche Version / German Version](DESKTOP-APP-SELF-HOST-DE.md)**

## Prerequisites

- Cap Desktop App installed ([Download](https://assets.screenrecorder.app.bauer-group.com/downloads/index.html))
- A running self-hosted Cap instance
- The URL of your Cap instance (e.g., `https://screenrecorder.app.bauer-group.com`)
- **Important**: Sign in to your Cap instance via web browser first to verify your account works

## Step-by-Step Guide

### 1. Open Settings

Launch the Cap Desktop App and open the settings:

- **Windows/Linux**: Click the gear icon or press `Ctrl + ,`
- **macOS**: Click the gear icon or press `Cmd + ,`

### 2. Navigate to Self Host Section

In the settings, scroll down to the **"Self host"** section.

### 3. Enter Server URL

1. In the **"Cap Server URL"** field, enter the URL of your self-hosted instance:

   ```text
   https://screenrecorder.app.bauer-group.com
   ```

2. Click the **"Update"** button.

### 4. Confirm URL Change

A confirmation dialog will appear:

> "Are you sure you want to change the server URL to `https://screenrecorder.app.bauer-group.com`? You will need to sign in again."

Click **"OK"** to confirm the change.

![Self-Host Settings](images/desktop-self-host-settings.png)

### 5. Sign In Again

After the URL change, you will be automatically signed out. Sign in with your account on the new instance:

1. Click **"Sign In"**
2. A browser window will open for authentication
3. Sign in with your credentials (e.g., Microsoft Entra ID)
4. After successful authentication, you will return to the desktop app

## Return to Default Instance

To switch back to the official Cap instance:

1. Open settings
2. Navigate to **"Self host"**
3. Change the URL to `https://cap.so`
4. Confirm the change and sign in again

## Notes

- All your recordings will be stored on the configured server
- Recordings from different servers are not automatically synchronized
- When switching servers, local recordings that haven't been uploaded will remain
