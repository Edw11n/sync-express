const { Tray, Menu } = require("electron");
const pathModule = require("path");

function createTray(app, mainWindow) {
	// 1. Corregimos la ruta subiendo un nivel si este archivo está en src/
	const tray = new Tray(pathModule.join(__dirname, "../icon.png"));

	const contextMenu = Menu.buildFromTemplate([
		{
			label: "Abrir Sync Express",
			click: () => mainWindow.show(),
		},
		{ type: "separator" },
		{
			label: "Salir",
			click: () => {
				app.isQuitting = true;
				app.quit();
			},
		},
	]);

	tray.setToolTip("Sync Express");
	tray.setContextMenu(contextMenu);

	tray.on("double-click", () => {
		mainWindow.show();
	});

	return tray; // IMPORTANTE: Retornar la instancia
}

module.exports = createTray;
