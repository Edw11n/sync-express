import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import StatusBadge from "../src/components/StatusBadge";
import { useSync } from "../src/hooks/useSync";
import { globalStyles as styles } from "../src/styles/globalStyles";

export default function MainApp() {
	const insets = useSafeAreaInsets();

	const { isConnected, history, sendClipboardToPC, lastReceived } = useSync();

	const [toastMessage, setToastMessage] = useState("");
	const [toastType, setToastType] = useState("success");
	const toastOpacity = useRef(new Animated.Value(0)).current;

	const showToast = (message, type = "success") => {
		setToastMessage(message);
		setToastType(type);

		Animated.timing(toastOpacity, {
			toValue: 1,
			duration: 200,
			useNativeDriver: true,
		}).start(() => {
			setTimeout(() => {
				Animated.timing(toastOpacity, {
					toValue: 0,
					duration: 200,
					useNativeDriver: true,
				}).start();
			}, 2000);
		});
	};

	const copiarAlPortapapeles = async (text) => {
		await Clipboard.setStringAsync(text);
		showToast("Copiado al portapapeles del dispositivo", "success");
	};

	useEffect(() => {
		if (lastReceived) {
			showToast("Clip recibido desde la PC", "success");
		}
	}, [lastReceived]);

	return (
		<View style={[styles.container, { paddingTop: insets.top + 10 }]}>
			<StatusBar barStyle="light-content" backgroundColor="#121212" />

			{/* TOAST POP-UP ANIMADO SUPERIOR */}
			<Animated.View
				style={[
					styles.toast,
					toastType === "success" ? styles.toastSuccess : styles.toastWarning,
					{ opacity: toastOpacity },
				]}
			>
				<Feather
					name={toastType === "success" ? "check-circle" : "alert-circle"}
					size={14}
					color={toastType === "success" ? "#2ecc71" : "#f1c40f"}
				/>
				<Text style={styles.toastText}>{toastMessage}</Text>
			</Animated.View>

			{/* MARCA DE AGUA */}
			<View
				style={{
					position: "absolute",
					left: 7,
					top: "75%",
					transform: [{ translateY: -50 }, { rotate: "-90deg" }],
					zIndex: 999,
					pointerEvents: "none",
					transformOrigin: "left center",
				}}
			>
				<Text
					style={{
						color: "#ffffff",
						fontSize: 9,
						fontWeight: "bold",
						letterSpacing: 2,
						opacity: 0.25,
						textTransform: "uppercase",
					}}
				>
					v1.0.0 - github.com/Edw11n | tiktok.com/@awatuki
				</Text>
			</View>

			{/* CONTENIDO PRINCIPAL */}
			<View style={{ flex: 1, paddingHorizontal: 20 }}>
				<View style={styles.header}>
					<View style={styles.logoContainer}>
						<Image
							source={require("../header-logo.png")}
							style={{
								width: 32,
								height: 32,
								resizeMode: "contain",
							}}
						/>
					</View>
					<Text style={styles.title}>Sync Express Movil</Text>
					<StatusBadge isConnected={isConnected} />
				</View>

				{/* BOTON MANUAL SUPREMO */}
				<TouchableOpacity
					style={[styles.btnManual, { marginTop: 15 }]}
					onPress={sendClipboardToPC}
				>
					<Text style={styles.btnManualText}>ENVIAR MI PORTAPAPELES</Text>
				</TouchableOpacity>

				{/* HISTORIAL */}
				<Text style={styles.historyTitle}>Historial de Clips</Text>
				<FlatList
					data={history}
					keyExtractor={(item) => item.id}
					contentContainerStyle={{ paddingBottom: 40 }}
					renderItem={({ item }) => {
						const valorOrigen = (
							item.origin ||
							item.type ||
							item.source ||
							"pc"
						).toLowerCase();
						const esMovil =
							valorOrigen === "mobile" || valorOrigen === "android";

						return (
							<TouchableOpacity
								style={styles.clipCard}
								onPress={() => copiarAlPortapapeles(item.text)}
								activeOpacity={0.7}
							>
								<View style={styles.clipInfo}>
									<View style={styles.metaRow}>
										<Feather
											name={
												item.pending
													? "clock"
													: esMovil
														? "arrow-up-right"
														: "arrow-down-left"
											}
											size={12}
											color={
												item.pending
													? "#f1c40f"
													: esMovil
														? "#2ecc71"
														: "#3498db"
											}
											style={{ marginRight: 4 }}
										/>
										<Text style={styles.clipTime}>
											{new Date(item.timestamp).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</Text>
									</View>
									<Text style={styles.clipText} numberOfLines={2}>
										{item.text}
									</Text>
								</View>
								<Feather
									name="copy"
									size={14}
									color="#555"
									style={{ marginLeft: 10 }}
								/>
							</TouchableOpacity>
						);
					}}
					ListEmptyComponent={
						<Text style={styles.placeholder}>Esperando sincronizacion...</Text>
					}
				/>
			</View>
		</View>
	);
}
