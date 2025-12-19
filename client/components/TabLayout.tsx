import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";

import HomeScreen from "../components/home-screen";
import Profile from "../components/profile";
import CreatePost from "../components/create-post";
import RazorpayWebView from "../utils/RazorpayWebView";
import PaymentVerify from "../utils/PaymentVerify";
import Shorts from "../components/Shorts";

const Tab = createBottomTabNavigator();

export default function TabLayout() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "black",
          paddingTop: 10,
          borderColor: "black"
        },
        tabBarActiveTintColor: "#f9a8d4",
        tabBarInactiveTintColor: "#fff",
        tabBarIcon: ({ color }) => {
          let iconName: any = "home";
          if (route.name === "Profile") iconName = "megaphone-outline";
          if (route.name === "CreatePost") iconName = "pricetags-outline";
          if (route.name === "RazorpayWebView") iconName = "heart-outline";
          if (route.name === "Shorts") iconName = "image-outline";
          return <Ionicons name={iconName} size={30} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "" }} />
      <Tab.Screen name="Profile" component={Profile} options={{ title: "" }} />
      <Tab.Screen name="Shorts" component={Shorts} options={{ title: "" }} />
      <Tab.Screen name="CreatePost" component={CreatePost} options={{ title: "" }} />
      <Tab.Screen name="RazorpayWebView" component={RazorpayWebView as any} options={{ title: "" }} />
    </Tab.Navigator>
  );
}
