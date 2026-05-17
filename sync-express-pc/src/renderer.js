let localHistory = [];

const statusBadge = document.getElementById("status");
const clipListDiv = document.getElementById("clipList");

function formatSmartDate(timestamp) {
	if (!timestamp) return "";
	const date = new Date(timestamp);
	const now = new Date();

	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const itemDate = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	);

	const diffTime = today - itemDate;
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");
	const timeStr = `${hours}:${minutes}`;

	if (diffDays === 0) return `Hoy a las ${timeStr}`;
	if (diffDays === 1) return `Ayer a las ${timeStr}`;
	if (diffDays === 2) return `Anteayer a las ${timeStr}`;

	return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()} a las ${timeStr}`;
}

function renderHistory() {
	clipListDiv.innerHTML = "";
	localHistory = localHistory.slice(0, 20);

	localHistory.forEach((item) => {
		const textContent = item.text || item;
		const timeContent = item.timestamp || null;

		const itemDiv = document.createElement("div");
		itemDiv.className = "clip-item";

		const safeTextBase64 = btoa(unescape(encodeURIComponent(textContent)));

		itemDiv.innerHTML = `
      <div class="clip-content">
        <div class="clip-date">${timeContent ? formatSmartDate(timeContent) : "Formato antiguo"}</div>
        <div class="clip-text">${textContent}</div>
      </div>
      <button class="copy-btn" onclick="copyText('${safeTextBase64}')">
        <i class="fa-regular fa-copy"></i>
      </button>
    `;
		clipListDiv.appendChild(itemDiv);
	});
}

window.copyText = (base64Text) => {
	const decodedText = decodeURIComponent(escape(atob(base64Text)));
	if (window.electronAPI && window.electronAPI.writeToClipboard) {
		window.electronAPI.writeToClipboard(decodedText);
	} else {
		navigator.clipboard.writeText(decodedText);
	}
};

async function inicializarHistorial() {
	if (window.electronAPI && window.electronAPI.getHistory) {
		try {
			const rows = await window.electronAPI.getHistory();
			if (rows && rows.length > 0) {
				localHistory = rows;
				renderHistory();
			}
		} catch (err) {
			console.error("Error al cargar historial inicial:", err);
		}
	}
}
inicializarHistorial();

// --- ESCUCHAR EVENTOS DESDE EL PROCESO MAIN ---
if (window.electronAPI) {
	// CORRECCIÓN: Eliminado el argumento 'event' fantasma para leer directamente el string del preload
	window.electronAPI.onStatusChanged((status) => {
		if (status === "online" || status === "connected" || status === true) {
			statusBadge.textContent = "Conectado";
			statusBadge.className = "status-badge connected";
		} else {
			statusBadge.textContent = "Desconectado";
			statusBadge.className = "status-badge disconnected";
		}
	});

	window.electronAPI.onNewClip((event, item) => {
		// CORRECCIÓN: Desempaquetado blindado por si los datos viajan directos en el primer argumento
		const actualItem = item || event;
		const textToCheck = actualItem.text || actualItem;

		if (
			localHistory.length > 0 &&
			(localHistory[0].text === textToCheck || localHistory[0] === textToCheck)
		) {
			return;
		}

		localHistory.unshift(actualItem);
		renderHistory();
	});
}

// --- CAPTURA DE EVENTOS DE LOS COMPONENTES DE LA INTERFAZ (TOGGLES) ---
document.getElementById("alwaysTopCheck").addEventListener("change", (e) => {
	if (window.electronAPI)
		window.electronAPI.toggleAlwaysOnTop(e.target.checked);
});

document.getElementById("autoLaunchCheck").addEventListener("change", (e) => {
	if (window.electronAPI) window.electronAPI.toggleAutoLaunch(e.target.checked);
});

document.getElementById("autoSendCheck").addEventListener("change", (e) => {
	if (window.electronAPI) window.electronAPI.toggleAutoSend(e.target.checked);
});

document.getElementById("btnSendManual").addEventListener("click", async () => {
	let text = "";
	if (window.electronAPI && window.electronAPI.readClipboard) {
		text = await window.electronAPI.readClipboard();
	} else {
		text = await navigator.clipboard.readText();
	}

	if (text) {
		if (window.electronAPI) window.electronAPI.manualSendClipboard(text);
	}
});
