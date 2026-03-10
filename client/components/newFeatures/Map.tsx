import React, { useEffect, useState } from "react";
import { View, StyleSheet, Platform, Text, ActivityIndicator } from "react-native";
import MapView, { Heatmap, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import axios from "../../context/axiosConfig";
import { LOCATION_TASK_NAME } from "../../utils/backgroundLocation.task";
import { Ionicons } from "@expo/vector-icons";

// ── Default region (KIET Group of Institutions, Ghaziabad) ──
const DEFAULT_REGION = {
  latitude: 28.7529,
  longitude: 77.4976,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

export default function Map() {
  const [heatPoints, setHeatPoints] = useState<any[]>([]);
  const [userRegion, setUserRegion] = useState(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);
  const [permDenied, setPermDenied] = useState(false);

  // ── 1. Request permissions & center on real user location ──
  useEffect(() => {
    (async () => {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== "granted") {
        setPermDenied(true);
        setLoading(false);
        return;
      }

      // Center map on actual user location
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      });
      setLoading(false);

      // Start background location tracking (Android only — bg perms needed)
      try {
        const bg = await Location.requestBackgroundPermissionsAsync();
        if (bg.status === "granted") {
          const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
          if (!isRunning) {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 30000,
              distanceInterval: 20,
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: "Campus Heatmap",
                notificationBody: "Tracking crowd density",
              },
            });
          }
        }
      } catch { /* bg perms not available on iOS Expo Go */ }
    })();
  }, []);

  // ── 2. Fetch heatmap every 10 seconds ──
  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await axios.get("/map/heatmap");
        setHeatPoints(
          res.data.map((p: any) => ({
            latitude: Number(p.lat),
            longitude: Number(p.lng),
            weight: Number(p.count),
          }))
        );
      } catch {
        // Silent fail — heatmap is non-critical
      }
    };

    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Loading state ──
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#ec4899" />
        <Text style={{ color: "#9ca3af", marginTop: 12, fontSize: 14 }}>
          Getting your location...
        </Text>
      </View>
    );
  }

  // ── Permission denied state ──
  if (permDenied) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="location-outline" size={48} color="#374151" />
        <Text style={{ color: "#9ca3af", marginTop: 12, fontSize: 14, textAlign: "center", paddingHorizontal: 32 }}>
          Location permission is required to show the crowd heatmap.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton
        initialRegion={userRegion}
      >
        {/* Heatmap — Android only (react-native-maps Heatmap not available on iOS) */}
        {Platform.OS === "android" && heatPoints.length > 0 && (
          <Heatmap
            points={heatPoints}
            radius={45}
            opacity={0.8}
          />
        )}

        {/* iOS fallback — show dot markers for each crowd cluster */}
        {Platform.OS === "ios" && heatPoints.map((point, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: point.latitude, longitude: point.longitude }}
            title={`${point.weight} ${point.weight === 1 ? "person" : "people"}`}
          >
            <View style={[
              styles.dot,
              {
                width: Math.min(12 + point.weight * 4, 40),
                height: Math.min(12 + point.weight * 4, 40),
                borderRadius: Math.min(12 + point.weight * 4, 40) / 2,
                opacity: Math.min(0.4 + point.weight * 0.1, 0.9),
              }
            ]} />
          </Marker>
        ))}
      </MapView>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>📍 Crowd Density</Text>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: "#22c55e" }]} />
          <Text style={styles.legendText}>Low</Text>
          <View style={[styles.legendDot, { backgroundColor: "#f59e0b" }]} />
          <Text style={styles.legendText}>Medium</Text>
          <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
          <Text style={styles.legendText}>High</Text>
        </View>
        <Text style={styles.legendSub}>Updates every 10 seconds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center" },
  dot: {
    backgroundColor: "#ec4899",
    borderWidth: 2,
    borderColor: "#fff",
  },
  legend: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  legendTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    marginBottom: 6,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: "#9ca3af",
    fontSize: 11,
    marginRight: 8,
  },
  legendSub: {
    color: "#6b7280",
    fontSize: 10,
    marginTop: 2,
  },
});
