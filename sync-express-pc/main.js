const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const SocketManager = require("./src/socketManager");
const createTray = require("./src/trayManager");
const startClipboardWatcher = require("./src/clipboard");
const db = require("./src/database");
const { Server } = require("socket.io");
const http = require("http");
const { Bonjour } = require("bonjour-service");
const os = require("os");

const bonjour = new Bonjour();
let mainWindow;
let socketNet;

const configPath = path.join(app.getPath("userData"), "config.json");

let appConfig = {
	alwaysOnTop: false,
	autoLaunch: true,
	autoSend: true,
};

if (fs.existsSync(configPath)) {
	try {
		appConfig = {
			...appConfig,
			...JSON.parse(fs.readFileSync(configPath, "utf-8")),
		};
	} catch (e) {
		console.error("Error al leer config.json, usando valores por defecto.");
	}
}

// Servidor HTTP para validaciones de Fase 1 (Ping rápido)
const server = http.createServer((req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "*");
	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	if (req.url === "/ping" && req.method === "GET") {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ status: "ok", service: "sync-express-server" }));
	} else {
		res.writeHead(404);
		res.end();
	}
});

const io = new Server(server, { cors: { origin: "*" } });

// Función auxiliar para extraer la IP privada IPv4 activa de la PC
const getLocalIP = () => {
	const interfaces = os.networkInterfaces();
	for (const interfaceName in interfaces) {
		for (const iface of interfaces[interfaceName]) {
			if (iface.family === "IPv4" && !iface.internal) {
				return iface.address;
			}
		}
	}
	return "0.0.0.0";
};

app.whenReady().then(() => {
	app.setLoginItemSettings({
		openAtLogin: true,
		path: app.getPath("exe"),
	});

	try {
		bonjour.unpublishAll();
	} catch (e) {}

	const localIP = getLocalIP();

	server.listen(6402, "0.0.0.0", () => {
		console.log(`Servidor LAN escuchando en el puerto 6402 (IP: ${localIP})`);
		try {
			bonjour.publish({
				name: "syncexpress",
				type: "syncexpress", // 👈 CAMBIADO: De "http" a "syncexpress" (Electron creará el protocolo _syncexpress._tcp)
				protocol: "tcp", // 👈 ASEGURADO: Forzamos que sea bajo TCP
				port: 6402,
				txt: {
					syncexpress: "true",
					service: "sync-express-server",
					app: "syncexpress",
					ip: localIP,
					host: `http://${localIP}:6402`,
				},
			});
			console.log("Anuncio mDNS (Bonjour) lanzado con protocolo limpio.");
		} catch (err) {
			console.error("Error al publicar servicio Bonjour:", err);
		}
	});

	socketNet = new SocketManager();
	socketNet.setIoServer(io);
	socketNet.setAutoSend(appConfig.autoSend);

	Menu.setApplicationMenu(null);

	// --- Handlers IPC de Sincronización ---
	ipcMain.handle("get-history", () => {
		return new Promise((resolve) => {
			db.getHistory((rows) => resolve(rows));
		});
	});

	ipcMain.handle("get-app-config", () => appConfig);

	ipcMain.handle("read-clipboard", () => {
		const { clipboard } = require("electron");
		return clipboard.readText();
	});

	ipcMain.on("write-to-clipboard", (event, text) => {
		const { clipboard } = require("electron");
		if (socketNet) socketNet.ignorarProximoCambio = true;
		clipboard.writeText(text);
	});

	ipcMain.on("toggle-always-on-top", (event, enabled) => {
		appConfig.alwaysOnTop = enabled;
		fs.writeFileSync(configPath, JSON.stringify(appConfig));
		if (mainWindow) mainWindow.setAlwaysOnTop(enabled, "screen-saver");
	});

	ipcMain.on("toggle-auto-launch", (event, enabled) => {
		appConfig.autoLaunch = enabled;
	});

	ipcMain.on("toggle-auto-send", (event, enabled) => {
		appConfig.autoSend = enabled;
		fs.writeFileSync(configPath, JSON.stringify(appConfig));
		if (socketNet) socketNet.setAutoSend(enabled);
	});

	ipcMain.on("manual-send-clipboard", (event, text) => {
		if (socketNet) socketNet.enviar(text, true);
	});

	mainWindow = new BrowserWindow({
		width: 350,
		height: 450,
		icon: path.join(__dirname, "icon.png"),
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	mainWindow.loadFile("index.html");
	socketNet.setWindow(mainWindow);

	mainWindow.webContents.on("did-finish-load", () => {
		mainWindow.show();
		mainWindow.focus();
		mainWindow.setAlwaysOnTop(appConfig.alwaysOnTop, "screen-saver");
		mainWindow.webContents.send("status-changed", "waiting");
	});

	createTray(app, mainWindow);

	mainWindow.on("close", (event) => {
		if (!app.isQuitting) {
			event.preventDefault();
			mainWindow.hide();
		}
		return false;
	});

	startClipboardWatcher((text) => {
		if (socketNet.debeIgnorar()) return;
		socketNet.enviar(text);
	});
});

app.on("will-quit", () => {
	bonjour.unpublishAll();
	bonjour.destroy();
});
