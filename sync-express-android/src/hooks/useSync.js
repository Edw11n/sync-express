import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { io } from "socket.io-client";
import { CONFIG } from "../config/constants";
import { discoverServerViaMdns } from "../utils/mdnsDiscovery";

export const useSync = () => {
	const [socket, setSocket] = useState(null);
	const [isConnected, setIsConnected] = useState(false);
	const [lastReceived, setLastReceived] = useState("");
	const [history, setHistory] = useState([]);
	const [offlineQueue, setOfflineQueue] = useState([]);

	const queueRef = useRef([]);
	const socketRef = useRef(null);

	useEffect(() => {
		queueRef.current = offlineQueue;
	}, [offlineQueue]);

	const loadHistory = async () => {
		const saved = await AsyncStorage.getItem("sync_history");
		if (saved) setHistory(JSON.parse(saved));
	};

	const saveToLocal = async (text, isPending = false, origin = "mobile") => {
		try {
			const saved = await AsyncStorage.getItem("sync_history");
			const currentHistory = saved ? JSON.parse(saved) : [];

			const newItem = {
				id: Date.now().toString(),
				text,
				timestamp: Date.now(),
				pending: isPending,
				origin,
			};

			const newHistory = [newItem, ...currentHistory].slice(0, 20);
			setHistory(newHistory);
			await AsyncStorage.setItem("sync_history", JSON.stringify(newHistory));
		} catch (e) {
			console.error("Error al guardar el historial local:", e);
		}
	};

	useEffect(() => {
		loadHistory();

		const loadOfflineQueue = async () => {
			const savedQueue = await AsyncStorage.getItem("sync_offline_queue");
			if (savedQueue) {
				const parsed = JSON.parse(savedQueue);
				setOfflineQueue(parsed);
				queueRef.current = parsed;
			}
		};
		loadOfflineQueue();

		const inicializarConexionInteligente = async () => {
			if (socketRef.current && socketRef.current.connected) return;

			let urlServidor = await AsyncStorage.getItem("LAST_SAVED_SERVER_URL");
			let conexionExitosa = false;

			// Fase 1: Cache mDNS Rápida (Ping de control)
			if (urlServidor) {
				console.log(`[Sync] Probando acceso rapido: ${urlServidor}`);
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 1200);

				try {
					const res = await fetch(`${urlServidor}/ping`, {
						signal: controller.signal,
					});
					if (res.ok || res.status) conexionExitosa = true;
				} catch (err) {
					conexionExitosa = false;
				} finally {
					// 👈 ¡CORREGIDO AQUÍ! Con doble 'l'
					clearTimeout(timeoutId);
				}
			}

			// Fase 2: Descubrimiento Activo mDNS Exclusivo (Si la caché falló)
			if (!conexionExitosa) {
				console.log(
					"[Sync] Cache ausente o PC movida de IP. Activando mDNS...",
				);
				await AsyncStorage.removeItem("LAST_SAVED_SERVER_URL");
				setIsConnected(false);

				const urlResuelta = await discoverServerViaMdns();

				if (urlResuelta) {
					urlServidor = urlResuelta;
					await AsyncStorage.setItem("LAST_SAVED_SERVER_URL", urlServidor);
				} else {
					console.log(
						"[Sync] No se encontró la PC en este ciclo de red. Reintentando en 8s...",
					);
					setTimeout(inicializarConexionInteligente, 8000);
					return;
				}
			}

			// Fase 3: Conectar Canal WebSocket
			console.log(`[Sync] Conectando Socket.io a: ${urlServidor}`);
			if (socketRef.current) {
				socketRef.current.removeAllListeners();
				socketRef.current.close();
			}

			const activeSocket = io(urlServidor, {
				transports: ["websocket"],
				forceNew: true,
				reconnection: true,
				reconnectionAttempts: 10,
				reconnectionDelay: 2000,
			});

			socketRef.current = activeSocket;
			setSocket(activeSocket);

			activeSocket.on("connect", async () => {
				setIsConnected(true);
				activeSocket.emit("join_room", CONFIG.ROOM_ID);
				console.log("[Sync] Socket en linea con el servidor.");

				if (queueRef.current.length > 0) {
					console.log(
						`[Sync] Despachando ${queueRef.current.length} elementos de la cola local.`,
					);
					queueRef.current.forEach((text) => {
						activeSocket.emit("update_clipboard", {
							room: CONFIG.ROOM_ID,
							text,
						});
					});

					setOfflineQueue([]);
					await AsyncStorage.removeItem("sync_offline_queue");

					const saved = await AsyncStorage.getItem("sync_history");
					if (saved) {
						const currentHistory = JSON.parse(saved);
						const updatedHistory = currentHistory.map((item) =>
							item.pending ? { ...item, pending: false } : item,
						);
						setHistory(updatedHistory);
						await AsyncStorage.setItem(
							"sync_history",
							JSON.stringify(updatedHistory),
						);
					}

					Alert.alert(
						"Sincronizacion Completa",
						"Elementos pendientes enviados al PC.",
					);
				}
			});

			activeSocket.on("clipboard_updated", async (texto) => {
				setLastReceived(texto);
				await Clipboard.setStringAsync(texto);

				const saved = await AsyncStorage.getItem("sync_history");
				const currentHistory = saved ? JSON.parse(saved) : [];

				if (currentHistory.length > 0 && currentHistory[0].text === texto)
					return;

				const newItem = {
					id: Date.now().toString(),
					text: texto,
					timestamp: Date.now(),
					pending: false,
					origin: "pc",
				};

				const updated = [newItem, ...currentHistory].slice(0, 20);
				setHistory(updated);
				await AsyncStorage.setItem("sync_history", JSON.stringify(updated));
			});

			activeSocket.on("disconnect", () => {
				setIsConnected(false);
				console.log(
					"[Sync] Canal cerrado. Socket.io reintentará de forma nativa...",
				);
			});

			activeSocket.on("reconnect_failed", () => {
				console.log(
					"[Sync] Fallaron reintentos nativos. Buscando nueva IP mediante mDNS...",
				);
				inicializarConexionInteligente();
			});
		};

		const inicioTimer = setTimeout(inicializarConexionInteligente, 300);

		return () => {
			clearTimeout(inicioTimer);
			if (socketRef.current) {
				socketRef.current.removeAllListeners();
				socketRef.current.close();
			}
		};
	}, []);

	const sendClipboardToPC = async () => {
		const text = await Clipboard.getStringAsync();
		if (!text) return;

		if (socket && socket.connected) {
			socket.emit("update_clipboard", { room: CONFIG.ROOM_ID, text });
			await saveToLocal(text, false, "mobile");
			Alert.alert("Enviado", "Contenido sincronizado con el PC");
		} else {
			console.log("[Sync] Servidor offline. Guardando en cola interna...");

			if (offlineQueue.includes(text)) {
				Alert.alert("Offline", "Este elemento ya esta en la lista de espera.");
				return;
			}

			const nuevaCola = [...offlineQueue, text];
			setOfflineQueue(nuevaCola);

			await AsyncStorage.setItem(
				"sync_offline_queue",
				JSON.stringify(nuevaCola),
			);
			await saveToLocal(text, true, "mobile");

			Alert.alert(
				"Modo Offline",
				"El texto se guardo y se enviara al conectar.",
			);
		}
	};

	return { isConnected, lastReceived, sendClipboardToPC, history, loadHistory };
};
