import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import HomeScreen from "../components/home-screen";
import Profile from "../components/profile";
import CreatePost from "../components/create-post";
import RazorpayWebView from "../utils/RazorpayWebView";
import Shorts from "../components/Shorts";

const Tab = createBottomTabNavigator();

export default function TabLayout() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          bottom: 30,
          alignSelf: "center",
          height: 60,
          marginHorizontal: 20,
          paddingTop: 10,
          backgroundColor: "#000",
          borderRadius: 40,
          borderTopWidth: 0,  
        },

        tabBarActiveTintColor: "#60a5fa",
        tabBarInactiveTintColor: "#fff",

        tabBarShowLabel: false,

        tabBarIcon: ({ color, focused }) => {
          let iconName: any = "home";

          if (route.name === "Home") iconName = "home";
          if (route.name === "Profile") iconName = "megaphone-outline";
          if (route.name === "Shorts") iconName = "image-outline";
          if (route.name === "CreatePost") iconName = "add-circle";
          if (route.name === "RazorpayWebView") iconName = "heart-outline";

          return (
            <Ionicons
              name={iconName}
              size={focused ? 32 : 28}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Profile" component={Profile} />
      <Tab.Screen name="Shorts" component={Shorts} />
      <Tab.Screen name="CreatePost" component={CreatePost} />
      <Tab.Screen
        name="RazorpayWebView"
        component={RazorpayWebView as any}
      />
    </Tab.Navigator>
  );
}
