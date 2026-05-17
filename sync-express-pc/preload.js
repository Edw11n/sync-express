const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
	getHistory: () => ipcRenderer.invoke("get-history"),
	getAppConfig: () => ipcRenderer.invoke("get-app-config"),
	readClipboard: () => ipcRenderer.invoke("read-clipboard"),

	writeToClipboard: (text) => ipcRenderer.send("write-to-clipboard", text),
	manualSendClipboard: (text) =>
		ipcRenderer.send("manual-send-clipboard", text),
	toggleAlwaysOnTop: (enabled) =>
		ipcRenderer.send("toggle-always-on-top", enabled),
	toggleAutoLaunch: (enabled) =>
		ipcRenderer.send("toggle-auto-launch", enabled),
	toggleAutoSend: (enabled) => ipcRenderer.send("toggle-auto-send", enabled),

	onNewClip: (callback) =>
		ipcRenderer.on("new-clip", (event, data) => callback(data)),
	// 🔥 Normalizado a onStatusChanged para hacer match perfecto con tu renderer
	onStatusChanged: (callback) =>
		ipcRenderer.on("status-changed", (event, data) => callback(data)),
});
