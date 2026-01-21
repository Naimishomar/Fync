import React, { useEffect, useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import MapView, { Heatmap } from "react-native-maps";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import axios from "../../context/axiosConfig";

interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight?: number;
}

interface HeatmapProps {
  points: HeatmapPoint[];
  radius?: number;
  opacity?: number;
  gradient?: {
    colors: string[];
    startPoints: number[];
    colorMapSize: number;
  };
}

const TypedHeatmap = Heatmap as unknown as React.ComponentType<HeatmapProps>;

const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TASK";

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const { locations } = data as any;
  if (!locations || locations.length === 0) return;

  const { latitude, longitude } = locations[0].coords;

  try {
    await axios.post("/map/location", {
      lat: latitude,
      lng: longitude
    });
  } catch (err : any) {
    Alert.alert("Error", "Check your internet connection.", err);
  }
});

export default function Map() {
  const [heatPoints, setHeatPoints] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const fg = await Location.requestForegroundPermissionsAsync();
      const bg = await Location.requestBackgroundPermissionsAsync();

      if (fg.status !== "granted" || bg.status !== "granted") return;

      const running =
        await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

      if (!running) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000,
          distanceInterval: 20,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: "Campus Heatmap",
            notificationBody: "Tracking location for crowd density"
          }
        });
      }
    })();
  }, []);

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await axios.get("map/heatmap");
        setHeatPoints(
          res.data.map((p: any) => ({
            latitude: p.lat,
            longitude: p.lng,
            weight: p.count
          }))
        );
      } catch (err: any) {
        Alert.alert("Error", "Check your internet connection.", err);
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
        initialRegion={{
          latitude: 12.9716,   // change to your campus center
          longitude: 77.5946,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004
        }}
        showsUserLocation
      >
        <TypedHeatmap
          points={heatPoints}
          radius={45}
          opacity={0.8}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});
