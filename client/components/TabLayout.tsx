import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import HomeScreen from "../components/home-screen";
import Shorts from "../components/Shorts";
import CreateShorts from "../components/CreateShorts";
import FundingFeed from "../components/FundingFeed";
import QuizHome from "../components/quiz/QuizHome"; 

const Tab = createBottomTabNavigator();

export default function TabLayout() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          bottom: 40,
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
          if (route.name === "QuizHome") iconName = "podium-outline";
          if (route.name === "Shorts") iconName = "image-outline";
          if (route.name === "CreateShorts") iconName = "add-circle";
          if (route.name === "FundingFeed") iconName = "heart-outline";

          return (
            <Ionicons
              name={iconName}
              size={focused ? 24 : 24}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="QuizHome" component={QuizHome} />
      <Tab.Screen name="Shorts" component={Shorts}/>
      <Tab.Screen name="CreateShorts" component={CreateShorts} />
      <Tab.Screen name="FundingFeed" component={FundingFeed}/>
    </Tab.Navigator>
  );
}
