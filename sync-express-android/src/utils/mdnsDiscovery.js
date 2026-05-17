import Zeroconf from "react-native-zeroconf";

const zeroconf = new Zeroconf();
let escuchadoresConfigurados = false;
let resolverActual = null;

const configurarListenersGlobales = () => {
	if (escuchadoresConfigurados) return;

	zeroconf.on("start", () => {
		console.log("[mDNS] Escaner activado en Android.");
	});

	zeroconf.on("resolved", (service) => {
		const nameLower = (service.name || "").toLowerCase();

		if (nameLower.includes("syncexpress")) {
			console.log(`[mDNS] Servidor detectado: ${service.name}`);

			let ipValida = null;

			if (service.txt && service.txt.ip) {
				ipValida = service.txt.ip;
			}

			if (!ipValida && service.host) {
				ipValida = service.host.endsWith(".")
					? service.host.slice(0, -1)
					: service.host;
			}

			if (!ipValida && service.addresses && service.addresses.length > 0) {
				const ipv4Regex =
					/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
				ipValida = service.addresses.find((addr) => ipv4Regex.test(addr));
			}

			if (ipValida && resolverActual) {
				const urlFormateada = ipValida.startsWith("http")
					? ipValida
					: `http://${ipValida}:6402`;

				console.log(`[mDNS] Conectado dinámicamente a: ${urlFormateada}`);

				try {
					zeroconf.stop();
				} catch (e) {}
				resolverActual(urlFormateada);
				resolverActual = null;
			}
		}
	});

	zeroconf.on("error", (err) => {
		const msg = err.message || String(err);
		if (!msg.includes("listener not registered")) {
			console.log("[mDNS] Error nativo:", msg);
		}
	});

	escuchadoresConfigurados = true;
};

export const discoverServerViaMdns = () => {
	return new Promise((resolve) => {
		configurarListenersGlobales();
		resolverActual = resolve;

		let finalizado = false;
		let timerFallback = null;

		const terminarBusqueda = (url) => {
			if (finalizado) return;
			finalizado = true;
			if (timerFallback) clearTimeout(timerFallback);
			try {
				zeroconf.stop();
			} catch (e) {}
			resolve(url);
		};

		// --- Fase 1: Intentar con tu configuración ganadora (.local) ---
		try {
			try {
				zeroconf.stop();
			} catch (e) {}
			console.log("[mDNS] Buscando con sufijo '.local'...");
			zeroconf.scan("syncexpress", "tcp", ".local");
		} catch (e) {
			console.log("[mDNS] Error en escaneo inicial:", e.message);
		}

		// --- Fase 2: Fallback estratégico a los 3 segundos si no ha resuelto ---
		timerFallback = setTimeout(() => {
			if (resolverActual === resolve) {
				console.log(
					"[mDNS] No hubo respuesta con '.local'. Cambiando a 'local.' por compatibilidad...",
				);
				try {
					try {
						zeroconf.stop();
					} catch (e) {}
					zeroconf.scan("syncexpress", "tcp", "local.");
				} catch (e) {
					console.log("[mDNS] Error en escaneo de contingencia:", e.message);
				}
			}
		}, 3000); // 3 segundos es ideal, da tiempo de sobra en redes locales normales

		// Timeout definitivo de muerte del ciclo completo (6 segundos)
		setTimeout(() => {
			if (resolverActual === resolve) {
				console.log("[mDNS] Tiempo de espera total agotado.");
				terminarBusqueda(null);
			}
		}, 6000);
	});
};
