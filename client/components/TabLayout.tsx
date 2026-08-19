import { TouchableOpacity, View, Dimensions, Animated, Pressable, Text, Platform, Image } from "react-native";
import { Image as ExpoImage } from 'expo-image';
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import Shorts from "./Shorts";
import ExploreHub from "./ExploreHub";
import HomeScreen from "./home-screen";
import CreateShorts from "./CreateShorts";
import Profile from "./profile";
import { useAuth } from "context/auth.context";
import { useState } from "react";
import { TAB_BAR_HEIGHT, useTabBarOffset } from "../constants/layout";

const { width } = Dimensions.get('window');
const Tab = createBottomTabNavigator();

const CustomTabBarButton = ({ children, onPress }: any) => {
  const [opened, setOpened] = useState(false);
  const animation = useState(new Animated.Value(0))[0];
  const navigation = useNavigation<any>();

  const toggleMenu = () => {
    const toValue = opened ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      friction: 5,
      useNativeDriver: true,
    }).start();
    setOpened(!opened);
  };

  // Styles for the two popup buttons
  const item1Style = {
    transform: [
      { scale: animation },
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -70], // Position of first button
        }),
      },
      {
        translateX: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -70], // Slide left
        }),
      },
    ],
  };

  const item2Style = {
    transform: [
      { scale: animation },
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -70], // Position of second button
        }),
      },
      {
        translateX: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0], // Slide right
        }),
      },
    ],
  };

  const item3Style = {
    transform: [
      { scale: animation },
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -70], // Position of first button
        }),
      },
      {
        translateX: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 70], // Slide left
        }),
      },
    ],
  };

  const rotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View className="flex-1 items-center justify-center">
      {/* Background Overlay to close menu when clicking outside */}
      {opened && (
        <Pressable
          onPress={toggleMenu}
          className="absolute -top-[1000] -left-[1000] -right-[1000] -bottom-[1000]"
        />
      )}

      {/* Sub Button 2 (e.g., Create Post) */}
      <Animated.View style={[item1Style]} className="absolute items-center">
        <TouchableOpacity className="w-12 h-12 rounded-full bg-slate-800 items-center justify-center border border-white/10 shadow-lg" onPress={() => navigation.navigate('CreatePost')}>
          <Ionicons name="aperture-outline" size={20} color="#f97316" />
        </TouchableOpacity>
        <Text className="text-white text-2xs font-bold mt-1 uppercase tracking-tighter shadow-black">Add Post</Text>
      </Animated.View>

      {/* Sub Button 1 (e.g., Create Video) */}
      <Animated.View style={[item2Style]} className="absolute items-center">
        <TouchableOpacity className="w-12 h-12 rounded-full bg-slate-800 items-center justify-center border border-white/10 shadow-lg" onPress={() => navigation.navigate('CreateShorts')}>
          <Ionicons name="videocam" size={20} color="#f97316" />
        </TouchableOpacity>
        <Text className="text-white text-2xs whitespace-nowrap font-bold mt-1 uppercase tracking-tighter shadow-black">Add Shorts</Text>
      </Animated.View>

      <Animated.View style={[item3Style]} className="absolute items-center">
        <TouchableOpacity className="w-12 h-12 rounded-full bg-slate-800 items-center justify-center border border-white/10 shadow-lg" onPress={() => { toggleMenu(); navigation.navigate('CreateFundingFeed'); }}>
          <Ionicons name="bulb-outline" size={20} color="#fb923c" />
        </TouchableOpacity>
        <Text className="text-white text-2xs font-bold mt-1 uppercase tracking-tighter shadow-black">Add Startup</Text>
      </Animated.View>



      {/* Main Center Button */}
      <View
        style={{
          shadowColor: '#f97316', shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.4, shadowRadius: 10, elevation: 10
        }}
        className="w-[72px] h-[72px] rounded-full bg-black items-center justify-center"
      >
        <TouchableOpacity
          onPress={toggleMenu}
          activeOpacity={0.9}
          className="w-[60px] h-[60px] rounded-full overflow-hidden"
        >
          <LinearGradient
            colors={['#f97316', '#fb923c']}
            className="flex-1 items-center justify-center"
          >
            <Animated.View style={{ transform: [{ rotate: rotation }] }}>
              <Ionicons name="add" size={32} color="#fff" />
            </Animated.View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function TabLayout() {
  const { user } = useAuth();
  // Sits above the home indicator / gesture bar rather than at a fixed 40px,
  // which floated too high on devices without one and too low on devices with a
  // tall one.
  const bottomOffset = useTabBarOffset();

  return (
    <View className="flex-1 bg-white justify-center">
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: "#f97316",
          tabBarInactiveTintColor: "#ffffffff",
          tabBarItemStyle: {
            // Let each item fill the pill and centre its own icon. Without this
            // the navigator's default item padding fights the bar's height.
            height: TAB_BAR_HEIGHT,
            paddingVertical: 0,
          },
          tabBarStyle: {
            position: "absolute",
            bottom: bottomOffset,
            marginHorizontal: width * 0.05,
            backgroundColor: "rgba(20, 20, 20, 0.86)",
            borderRadius: TAB_BAR_HEIGHT / 2,
            height: TAB_BAR_HEIGHT,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.12)",
            elevation: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 15,
            // The old bar was 60px tall with 10px top + 46px bottom padding,
            // leaving 4px of usable space for 24px icons — which is why they
            // rendered spilling out above the pill.
            paddingTop: 0,
            paddingBottom: 0,
          },
        }}
      >
        {/* Screens stay the same */}
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} /> }} />

        <Tab.Screen name="Shorts" component={Shorts} options={{ tabBarIcon: ({ color }) => <Ionicons name="play-outline" size={24} color={color} /> }} />

        <Tab.Screen
          name="Create"
          component={CreateShorts}
          options={{
            tabBarButton: (props) => <CustomTabBarButton {...props} />
          }}
        />

        <Tab.Screen name="Explore" component={ExploreHub} options={{ tabBarIcon: ({ color }) => <Ionicons name="compass-outline" size={24} color={color} /> }} />
        
        <Tab.Screen 
          name="Profile" 
          component={Profile} 
          options={{ 
            tabBarIcon: ({ color, focused }) => (
              user?.avatar ? (
                <View style={{ 
                  width: 28, 
                  height: 28, 
                  borderRadius: 14, 
                  borderWidth: focused ? 1.5 : 0, 
                  borderColor: '#ec4899',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <ExpoImage 
                    source={{ uri: user.avatar }} 
                    style={{ width: 28, height: 28, borderRadius: 14 }}
                    contentFit="cover"
                    cachePolicy="disk"
                  />
                </View>
              ) : (
                <Ionicons name="person-outline" size={24} color={color} />
              )
            ) 
          }} 
        />
      </Tab.Navigator>
    </View>
  );
}
