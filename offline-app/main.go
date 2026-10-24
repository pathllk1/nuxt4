package main

import (
	"context"
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gogpu/systray"
)

// Embed all web assets, icons, and pre-seeded database directly into the binary
//
//go:embed index.html css js vendor icon.png icon.ico tray_icon.png database.sqlite
var embeddedFS embed.FS

const (
	defaultPort = "8759"
	appName     = "Accounting & Inventory ERP"
)

var (
	portFlag     = flag.String("port", defaultPort, "Port to run the offline ERP web server on")
	appModeFlag  = flag.Bool("app", true, "Launch in standalone desktop app window mode (Edge/Chrome)")
	openBrowser  = flag.Bool("browser", true, "Automatically open browser window on startup")
	serverInstance *http.Server
)

func main() {
	flag.Parse()

	port := *portFlag
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}

	appURL := fmt.Sprintf("http://localhost:%s", port)

	// 1. Check if server is already running on this port
	if isPortInUse("127.0.0.1", port) {
		// Ping or just launch browser to existing instance
		launchWindow(appURL, *appModeFlag)
		return
	}

	// 2. Configure robust MIME types for offline Windows environment
	setupMimeTypes()

	// 2b. Determine executable directory and ensure physical database.sqlite exists on disk
	exeDir := "."
	if exePath, err := os.Executable(); err == nil {
		dir := filepath.Dir(exePath)
		if !strings.Contains(dir, "go-build") {
			exeDir = dir
		}
	}
	dbFilePath := filepath.Join(exeDir, "database.sqlite")

	// If database.sqlite is not present on client machine, auto-create it from embedded template
	if !fileExists(dbFilePath) {
		if dbBytes, readErr := embeddedFS.ReadFile("database.sqlite"); readErr == nil && len(dbBytes) > 0 {
			if writeErr := os.WriteFile(dbFilePath, dbBytes, 0644); writeErr == nil {
				log.Printf("[Database] Auto-created database.sqlite at: %s", dbFilePath)
			}
		}
	}

	// 3. Setup HTTP router
	mux := http.NewServeMux()

	// API endpoints
	mux.HandleFunc("/api/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"app":     appName,
			"status":  "running",
			"port":    port,
			"offline": true,
			"db_path": dbFilePath,
			"time":    time.Now().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("/api/exit", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "Shutting down ERP server..."})
		go func() {
			time.Sleep(500 * time.Millisecond)
			os.Exit(0)
		}()
	})

	// Database file sync endpoints (Physical database.sqlite file on disk)
	mux.HandleFunc("/api/db", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method == "GET" {
			data, err := os.ReadFile(dbFilePath)
			if err != nil {
				// Fallback to embedded copy if file not yet written on disk
				data, err = embeddedFS.ReadFile("database.sqlite")
				if err != nil {
					http.Error(w, "Database file not found", http.StatusNotFound)
					return
				}
				// Auto-write to disk immediately
				_ = os.WriteFile(dbFilePath, data, 0644)
			}
			w.Header().Set("Content-Type", "application/x-sqlite3")
			w.Header().Set("Content-Disposition", "attachment; filename=database.sqlite")
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Write(data)
			return
		}

		if r.Method == "POST" {
			body, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			if len(body) > 0 {
				err = os.WriteFile(dbFilePath, body, 0644)
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "bytes": len(body)})
			return
		}
	})

	// Static file handler from embedded files
	fileServer := http.FileServer(http.FS(embeddedFS))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Security and offline headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("X-Content-Type-Options", "nosniff")

		// Zero caching for local offline app so updates and live code are immediately active
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")

		fileServer.ServeHTTP(w, r)
	})

	// 4. Start HTTP Server on loopback
	listener, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		log.Fatalf("Failed to bind port %s: %v", port, err)
	}

	serverInstance = &http.Server{
		Handler: mux,
	}

	go func() {
		if err := serverInstance.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Printf("HTTP server stopped: %v", err)
		}
	}()

	// 5. Open App Window or Browser
	if *openBrowser {
		go func() {
			time.Sleep(200 * time.Millisecond)
			launchWindow(appURL, *appModeFlag)
		}()
	}

	// 6. Setup System Tray Icon & Menu
	setupSystemTray(appURL, port)
}

func isPortInUse(host, port string) bool {
	timeout := 300 * time.Millisecond
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, port), timeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func setupMimeTypes() {
	_ = mime.AddExtensionType(".js", "application/javascript")
	_ = mime.AddExtensionType(".mjs", "application/javascript")
	_ = mime.AddExtensionType(".css", "text/css; charset=utf-8")
	_ = mime.AddExtensionType(".html", "text/html; charset=utf-8")
	_ = mime.AddExtensionType(".json", "application/json")
	_ = mime.AddExtensionType(".png", "image/png")
	_ = mime.AddExtensionType(".jpg", "image/jpeg")
	_ = mime.AddExtensionType(".jpeg", "image/jpeg")
	_ = mime.AddExtensionType(".ico", "image/x-icon")
	_ = mime.AddExtensionType(".svg", "image/svg+xml")
	_ = mime.AddExtensionType(".woff2", "font/woff2")
	_ = mime.AddExtensionType(".woff", "font/woff")
	_ = mime.AddExtensionType(".wasm", "application/wasm")
}

func launchWindow(url string, appMode bool) {
	if appMode {
		// Try Microsoft Edge in standalone app mode
		edgePaths := []string{
			`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
			`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
			filepath.Join(os.Getenv("LOCALAPPDATA"), `Microsoft\Edge\Application\msedge.exe`),
		}
		for _, p := range edgePaths {
			if fileExists(p) {
				cmd := exec.Command(p, "--app="+url, "--window-size=1366,868")
				if err := cmd.Start(); err == nil {
					return
				}
			}
		}

		// Try Google Chrome in standalone app mode
		chromePaths := []string{
			`C:\Program Files\Google\Chrome\Application\chrome.exe`,
			`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
			filepath.Join(os.Getenv("LOCALAPPDATA"), `Google\Chrome\Application\chrome.exe`),
		}
		for _, p := range chromePaths {
			if fileExists(p) {
				cmd := exec.Command(p, "--app="+url, "--window-size=1366,868")
				if err := cmd.Start(); err == nil {
					return
				}
			}
		}
	}

	// Fallback to standard default browser
	launchDefaultBrowser(url)
}

func launchDefaultBrowser(url string) {
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	if err := cmd.Start(); err != nil {
		_ = exec.Command("cmd", "/c", "start", url).Start()
	}
}

func fileExists(path string) bool {
	if path == "" {
		return false
	}
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return !info.IsDir()
}

func setupSystemTray(appURL, port string) {
	trayIconBytes, err := embeddedFS.ReadFile("tray_icon.png")
	if err != nil {
		// Fallback to icon.png if tray_icon.png is somehow missing
		trayIconBytes, _ = embeddedFS.ReadFile("icon.png")
	}

	tray := systray.New()
	tray.SetAppName(appName)
	tray.SetTooltip(fmt.Sprintf("%s (Port %s)", appName, port))
	if len(trayIconBytes) > 0 {
		tray.SetIcon(trayIconBytes)
	}

	menu := systray.NewMenu()
	menu.Add("🚀 Open ERP Application", func() {
		launchWindow(appURL, true)
	})
	menu.Add("🌐 Open in Default Browser", func() {
		launchDefaultBrowser(appURL)
	})
	menu.AddSeparator()
	menu.Add(fmt.Sprintf("📌 Server: %s", appURL), func() {
		launchWindow(appURL, true)
	})
	menu.AddSeparator()
	menu.Add("❌ Exit Application", func() {
		tray.Remove()
		if serverInstance != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
			defer cancel()
			_ = serverInstance.Shutdown(ctx)
		}
		os.Exit(0)
	})

	tray.SetMenu(menu)
	tray.OnClick(func() {
		launchWindow(appURL, true)
	})

	tray.Show()
	tray.ShowNotification(appName, fmt.Sprintf("Running offline on port %s. Click tray icon anytime to open.", port))

	// Run the Win32 message loop (blocks on main thread)
	if err := tray.Run(); err != nil {
		log.Printf("System tray run error: %v, keeping server alive", err)
		select {}
	}
}
