const { clipboard, Notification } = require("electron");
const db = require("./database");

class SocketManager {
	constructor() {
		this.roomId = process.env.ROOM_ID || "mi_sala_privada";
		this.ignorarProximoCambio = false;
		this.mainWindow = null;
		this.autoSendEnabled = true;
		this.ioServer = null;
	}

	setWindow(mainWindow) {
		this.mainWindow = mainWindow;
	}

	setIoServer(ioServer) {
		this.ioServer = ioServer;
		this.initServerEvents();
	}

	setAutoSend(enabled) {
		this.autoSendEnabled = enabled;
		console.log(`[Server] Envio automatico en PC modificado a: ${enabled}`);
	}

	initServerEvents() {
		if (!this.ioServer) return;

		this.ioServer.removeAllListeners("connection");

		this.ioServer.on("connection", (socket) => {
			console.log("[LAN] Socket conectado:", socket.id);

			socket.on("join_room", (room) => {
				// CORRECCIÓN: Usar ámbito local para evitar mutar la propiedad global de la instancia de la app
				const currentTargetRoom = room || this.roomId;

				socket.join(currentTargetRoom);
				console.log(`[LAN] Movil acoplado a la sala: ${currentTargetRoom}`);

				if (this.mainWindow) {
					this.mainWindow.webContents.send("status-changed", "online");
				}

				setTimeout(() => {
					db.getHistory((rows) => {
						if (!rows) return;

						const pendientes = rows.filter(
							(row) => row.pending === true || row.pending === 1,
						);

						if (pendientes.length > 0) {
							console.log(
								`[LAN] Se encontraron ${pendientes.length} clips pendientes. Despachando...`,
							);

							pendientes.forEach((clip) => {
								socket.emit("clipboard_updated", clip.text);
								db.clearPendingStatus(clip.id, clip.text);
							});
						}
					});
				}, 100);
			});

			socket.on("update_clipboard", (data) => {
				if (!data || !data.text || data.text === clipboard.readText()) return;

				console.log("[LAN] Texto recibido desde el movil. Sincronizando PC...");
				this.ignorarProximoCambio = true;
				const timestamp = Date.now();

				db.saveText({
					text: data.text,
					timestamp: timestamp,
					origin: "mobile",
					pending: false,
				});

				clipboard.writeText(data.text);

				const activeRoom = data.room || this.roomId;
				socket.to(activeRoom).emit("clipboard_updated", data.text);

				if (this.mainWindow) {
					this.mainWindow.webContents.send("new-clip", {
						text: data.text,
						timestamp: timestamp,
						pending: false,
						origin: "mobile",
					});
				}

				new Notification({
					title: "Sync Express LAN",
					body: "Texto recibido desde la red local",
				}).show();
			});

			socket.on("disconnect", () => {
				console.log(`[LAN] Socket desconectado: ${socket.id}`);
				if (this.mainWindow) {
					this.mainWindow.webContents.send("status-changed", "waiting");
				}
			});
		});
	}

	debeIgnorar = () => {
		if (this.ignorarProximoCambio) {
			this.ignorarProximoCambio = false;
			return true;
		}
		return false;
	};

	enviar(texto, forzar = false, marcarComoCompletado = false) {
		if (!forzar && !this.autoSendEnabled) {
			console.log(
				"[Server] Envio automatico deshabilitado. Clip de PC ignorado.",
			);
			return;
		}

		const timestamp = Date.now();

		if (this.ioServer) {
			const roomSockets = this.ioServer.sockets.adapter.rooms.get(this.roomId);
			const dispositivosConectados = roomSockets ? roomSockets.size : 0;

			console.log(
				`[LAN] Transmitiendo clip desde PC. Dispositivos oyentes: ${dispositivosConectados}`,
			);

			this.ioServer.to(this.roomId).emit("clipboard_updated", texto);

			const isPending = dispositivosConectados === 0;

			if (!marcarComoCompletado) {
				db.saveText({
					text: texto,
					timestamp: timestamp,
					pending: isPending,
					origin: "pc",
				});

				if (this.mainWindow) {
					this.mainWindow.webContents.send("new-clip", {
						text: texto,
						timestamp: timestamp,
						pending: isPending,
						origin: "pc",
					});
				}
			}
		} else {
			console.log("[Server] Servidor de sockets de Electron no inicializado.");
		}
	}
}

module.exports = SocketManager;
