# Cap Desktop App mit Self-Hosted Server verbinden

Diese Anleitung beschreibt, wie Sie die Cap Desktop-Anwendung mit Ihrer selbst gehosteten Cap-Instanz verbinden.

**[English Version](DESKTOP-APP-SELF-HOST.md)**

## Voraussetzungen

- Cap Desktop App installiert ([Download](https://assets.screenrecorder.app.bauer-group.com/downloads/index.html))
- Eine laufende selbst gehostete Cap-Instanz
- Die URL Ihrer Cap-Instanz (z.B. `https://screenrecorder.app.bauer-group.com`)
- **Wichtig**: Melden Sie sich zuerst im Webbrowser bei Ihrer Cap-Instanz an, um sicherzustellen, dass Ihr Konto funktioniert

## Schritt-für-Schritt Anleitung

### 1. Einstellungen öffnen

Starten Sie die Cap Desktop App und öffnen Sie die Einstellungen:

- **Windows/Linux**: Klicken Sie auf das Zahnrad-Symbol oder drücken Sie `Strg + ,`
- **macOS**: Klicken Sie auf das Zahnrad-Symbol oder drücken Sie `Cmd + ,`

### 2. Self Host Bereich aufrufen

In den Einstellungen scrollen Sie nach unten zum Bereich **"Self host"**.

### 3. Server URL eingeben

1. Im Feld **"Cap Server URL"** geben Sie die URL Ihrer selbst gehosteten Instanz ein:

   ```text
   https://screenrecorder.app.bauer-group.com
   ```

2. Klicken Sie auf den **"Update"** Button.

### 4. URL-Änderung bestätigen

Es erscheint ein Bestätigungsdialog:

> "Are you sure you want to change the server URL to `https://screenrecorder.app.bauer-group.com`? You will need to sign in again."

Klicken Sie auf **"OK"** um die Änderung zu bestätigen.

![Self-Host Einstellungen](images/desktop-self-host-settings.png)

### 5. Erneut anmelden

Nach der URL-Änderung werden Sie automatisch abgemeldet. Melden Sie sich mit Ihrem Konto auf der neuen Instanz an:

1. Klicken Sie auf **"Sign In"**
2. Es öffnet sich ein Browser-Fenster zur Anmeldung
3. Melden Sie sich mit Ihren Zugangsdaten an (z.B. Microsoft Entra ID)
4. Nach erfolgreicher Anmeldung kehren Sie zur Desktop-App zurück

## Zur Standard-Instanz zurückkehren

Um wieder die offizielle Cap-Instanz zu verwenden:

1. Öffnen Sie die Einstellungen
2. Navigieren Sie zu **"Self host"**
3. Ändern Sie die URL zu `https://cap.so`
4. Bestätigen Sie die Änderung und melden Sie sich erneut an

## Hinweise

- Alle Ihre Aufnahmen werden auf dem konfigurierten Server gespeichert
- Aufnahmen von verschiedenen Servern sind nicht automatisch synchronisiert
- Bei einem Serverwechsel bleiben lokale, nicht hochgeladene Aufnahmen erhalten
