import { StyleSheet, Text, View } from "react-native";
import { theme } from "../styles/globalStyles";

const StatusBadge = ({ isConnected }) => {
	return (
		<View
			style={[
				styles.badge,
				{
					backgroundColor: isConnected
						? theme.colors.success
						: theme.colors.error,
				},
			]}
		>
			<View style={styles.dot} />
			<Text style={styles.text}>
				{isConnected ? "Conectado (LAN)" : "Sin conexion"}
			</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	badge: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 20,
		marginTop: 10,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: "#fff",
		marginRight: 8,
	},
	text: {
		color: "#fff",
		fontWeight: "bold",
		fontSize: 12,
	},
});

export default StatusBadge;
