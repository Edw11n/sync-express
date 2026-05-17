const { clipboard } = require("electron");

function startClipboardWatcher(onNewText) {
	let lastText = clipboard.readText();

	setInterval(() => {
		const currentText = clipboard.readText();
		if (currentText !== lastText && currentText !== "") {
			lastText = currentText;
			onNewText(currentText);
		}
	}, 1500);
}

module.exports = startClipboardWatcher;
