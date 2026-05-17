const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { app } = require("electron");

// Guardamos la base de datos en la carpeta de datos de usuario de la app
const dbPath = path.join(app.getPath("userData"), "sync_history.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
	db.run(`CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// MODIFICADO: Ahora recibe el objeto estructurado { text, timestamp }
const saveText = (clipObj) => {
	let text = typeof clipObj === "object" ? clipObj.text : clipObj;

	// Si viene del móvil, le ponemos su marca
	if (typeof clipObj === "object" && clipObj.origin === "mobile") {
		text = "═►MOBILE═►" + text;
	}
	// SI ESTÁ PENDIENTE (PC offline/espera), le ponemos una marca especial de pendiente
	else if (typeof clipObj === "object" && clipObj.pending === true) {
		text = "═►PENDING═►" + text;
	}

	if (typeof clipObj === "object" && clipObj.timestamp) {
		const isoDate = new Date(clipObj.timestamp).toISOString();
		db.run(`INSERT INTO history (content, timestamp) VALUES (?, ?)`, [
			text,
			isoDate,
		]);
	} else {
		db.run(`INSERT INTO history (content) VALUES (?)`, [text]);
	}
};

// MODIFICADO: Mapea las filas de la DB para que coincidan con las propiedades que busca el renderer.js
const getHistory = (callback) => {
	db.all(
		`SELECT * FROM history ORDER BY timestamp DESC LIMIT 20`,
		[],
		(err, rows) => {
			if (err || !rows) {
				callback([]);
				return;
			}

			const mappedRows = rows.map((row) => {
				const isFromMobile = row.content.startsWith("═►MOBILE═►");
				const isPending = row.content.startsWith("═►PENDING═►");

				// Limpiamos los tokens para obtener el texto puro original
				let cleanText = row.content;
				if (isFromMobile) cleanText = cleanText.replace("═►MOBILE═►", "");
				if (isPending) cleanText = cleanText.replace("═►PENDING═►", "");

				return {
					id: row.id,
					text: cleanText,
					timestamp: new Date(row.timestamp).getTime(),
					pending: isPending, // <--- ¡AHORA SÍ LEEMOS EL ESTADO REAL GUARDADO!
					origin: isFromMobile ? "mobile" : "pc",
				};
			});

			callback(mappedRows);
		},
	);
};

const clearPendingStatus = (id, cleanText) => {
	db.run(
		`UPDATE history SET content = ?, timestamp = CURRENT_TIMESTAMP WHERE id = ?`,
		[cleanText, id],
	);
};

module.exports = { saveText, getHistory, clearPendingStatus };
