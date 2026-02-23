import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Heatmap } from "react-native-maps";
import * as Location from "expo-location";
import axios from "../../context/axiosConfig";
import { LOCATION_TASK_NAME } from "../../utils/backgroundLocation.task";

export default function Map() {
  const [heatPoints, setHeatPoints] = useState<any[]>([]);

  // 🔥 AUTO START LOCATION TRACKING
  useEffect(() => {
    (async () => {
      const fg = await Location.requestForegroundPermissionsAsync();
      const bg = await Location.requestBackgroundPermissionsAsync();

      if (fg.status !== "granted" || bg.status !== "granted") {
        console.log("Location permission denied");
        return;
      }

      const isRunning =
        await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

      if (!isRunning) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000,
          distanceInterval: 20,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: "Campus Heatmap",
            notificationBody: "Tracking crowd density"
          }
        });
      }
    })();
  }, []);

  // 🔁 FETCH HEATMAP DATA
  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await axios.get("/map/heatmap");
        setHeatPoints(
          res.data.map((p: any) => ({
            latitude: Number(p.lat),
            longitude: Number(p.lng),
            weight: Number(p.count)
          }))
        );
      } catch (err) {
        console.log("Heatmap fetch failed");
      }
    };

    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        showsUserLocation
        initialRegion={{
          latitude: 28.7529,
          longitude: 77.4976,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02
        }}

      >
        {heatPoints.length > 0 && (
          <Heatmap
            points={heatPoints}
            radius={45}
            opacity={0.8}
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }
});
