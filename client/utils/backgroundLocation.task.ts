import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import axios from "../context/axiosConfig";

export const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TASK";

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.log("Background task error:", error);
    return;
  }

  const { locations } = data as any;
  if (!locations?.length) return;

  const { latitude, longitude } = locations[0].coords;

  try {
    await axios.post("/map/location", {
      lat: latitude,
      lng: longitude
    });
  } catch (err: any) {
    console.log("Location upload failed:", err?.message);
  }
});
