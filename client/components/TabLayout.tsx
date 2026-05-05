import { TouchableOpacity, View, Dimensions, Animated, Pressable, Text, Platform, Image } from "react-native";
import { Image as ExpoImage } from 'expo-image';
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import Shorts from "./Shorts";
import FundingFeed from "./FundingFeed";
import HomeScreen from "./home-screen";
import CreateShorts from "./CreateShorts";
import Profile from "./profile";
import { useAuth } from "context/auth.context";
import { useState } from "react";

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
        <TouchableOpacity className="w-12 h-12 rounded-full bg-zinc-800 items-center justify-center border border-white/10 shadow-lg" onPress={() => navigation.navigate('CreatePost')}>
          <Ionicons name="aperture-outline" size={20} color="#dc7100ff" />
        </TouchableOpacity>
        <Text className="text-white text-[10px] font-bold mt-1 uppercase tracking-tighter shadow-black">Add Post</Text>
      </Animated.View>

      {/* Sub Button 1 (e.g., Create Video) */}
      <Animated.View style={[item2Style]} className="absolute items-center">
        <TouchableOpacity className="w-12 h-12 rounded-full bg-zinc-800 items-center justify-center border border-white/10 shadow-lg" onPress={() => navigation.navigate('CreateShorts')}>
          <Ionicons name="videocam" size={20} color="#f07c01ff" />
        </TouchableOpacity>
        <Text className="text-white text-[10px] whitespace-nowrap font-bold mt-1 uppercase tracking-tighter shadow-black">Add Shorts</Text>
      </Animated.View>

      <Animated.View style={[item3Style]} className="absolute items-center">
        <TouchableOpacity className="w-12 h-12 rounded-full bg-zinc-800 items-center justify-center border border-white/10 shadow-lg" onPress={() => { toggleMenu(); navigation.navigate('CreateFundingFeed'); }}>
          <Ionicons name="bulb-outline" size={20} color="#e58c2eff" />
        </TouchableOpacity>
        <Text className="text-white text-[10px] font-bold mt-1 uppercase tracking-tighter shadow-black">Add Startup</Text>
      </Animated.View>



      {/* Main Center Button */}
      <View
        style={{
          shadowColor: '#dc7100ff', shadowOffset: { width: 0, height: 5 },
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
            colors={['#dc7100ff', '#e58c2eff']}
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
  return (
    <View className="flex-1 bg-black justify-center">
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: "#dc7100ff",
          tabBarInactiveTintColor: "#ffffffff",
          tabBarStyle: {
            position: "absolute",
            bottom: 40,
            marginHorizontal: width * 0.05,
            backgroundColor: "rgba(20, 20, 20, 0.86)",
            borderRadius: 40,
            height: 60,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.12)",
            elevation: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 15,
            paddingTop: 10,
            paddingBottom: 46,
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

        <Tab.Screen name="Funding" component={FundingFeed} options={{ tabBarIcon: ({ color }) => <Ionicons name="bulb-outline" size={24} color={color} /> }} />
        
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
