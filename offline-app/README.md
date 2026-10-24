# 📊 Accounting & Inventory ERP (100% Offline Standalone Desktop Executable)

A self-contained Windows desktop executable for the **Accounting & Inventory ERP** web application.

---

## ✨ Features

- **🚀 100% Standalone Executable**: Entire application (HTML, CSS, JS, Vue 3, Tailwind, ExcelJS, jsPDF, Docx, assets, and icons) is embedded directly inside `AccountingERP.exe` (`offline-app.exe`). No external server, runtime, Node.js, or internet connection required.
- **⚡ Port 8759 Built-in**: Runs on `http://localhost:8759` by default.
- **🎨 Custom App Icon**: High-resolution multi-size icon embedded into the `.exe` binary resource table (16x16, 32x32, 48x48, 64x64, 128x128, 256x256) and used in the web app, taskbar, and system tray.
- **🖥️ Native App Window Mode**: Automatically detects Microsoft Edge / Google Chrome and launches in clean, frameless App Mode (`--app=http://localhost:8759`) without browser address bars, making it feel like a native desktop application.
- **🔔 Windows System Tray Integration**:
  - Runs quietly in the notification area with a custom tray icon.
  - Right-click menu:
    - `🚀 Open ERP Application`
    - `🌐 Open in Default Browser`
    - `📌 Server: http://localhost:8759`
    - `❌ Exit Application`
  - Single-instance protection: Launching again brings the existing instance into view instead of failing.
- **🛡️ Silent GUI Execution**: Compiled with `-ldflags="-H windowsgui -s -w"` so no annoying black command-prompt window appears.

---

## 🚀 How to Run

1. Simply double-click **`AccountingERP.exe`** (or **`offline-app.exe`**).
2. The ERP window will immediately open on screen.
3. The app is also accessible in any browser at:
   ```
   http://localhost:8759
   ```
4. To close the application, right-click the system tray icon in the Windows taskbar corner and select **Exit Application**.

---

## 🛠️ CLI Flags (Optional)

You can customize port or behavior via command-line:

```powershell
# Run on a custom port
.\AccountingERP.exe -port 9000

# Open in standard default browser instead of Edge/Chrome App Window
.\AccountingERP.exe -app=false

# Start server only without opening browser
.\AccountingERP.exe -browser=false
```

---

## 🔨 How to Recompile (1-Click)

Whenever you edit JavaScript, CSS, or HTML files in `offline-app/`:

Double-click **`build.bat`** (or run `go build -mod=mod -ldflags="-H windowsgui -s -w" -o AccountingERP.exe .` from PowerShell).
