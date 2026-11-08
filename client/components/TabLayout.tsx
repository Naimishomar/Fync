import { TouchableOpacity, View, Dimensions, Animated, Pressable, Text, Platform, StyleSheet, BackHandler } from "react-native";
import { Image as ExpoImage } from 'expo-image';
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Path } from "react-native-svg";
import { useNavigation, useIsFocused } from '@react-navigation/native';
import Shorts from "./Shorts";
import ExploreHub from "./ExploreHub";
import HomeScreen from "./home-screen";
import CreateShorts from "./CreateShorts";
import Profile from "./profile";
import { useAuth } from "context/auth.context";
import { useState, useEffect } from "react";
import { getFullUrl, getThumbUrl } from "../utils/imageUtils";
import { TAB_BAR_HEIGHT, useTabBarOffset } from "../constants/layout";
import SlidingTabBar from "./ui/SlidingTabBar";
import { C } from '../constants/colors';
import { isFeatureOn } from '../constants/features';

const { width } = Dimensions.get('window');
const Tab = createBottomTabNavigator();

/** Small `_sm` twin first, full file when an older upload has none. */
const TabAvatar = ({ path }: { path: string }) => {
  const [src, setSrc] = useState(getThumbUrl(path) || '');
  return (
    <ExpoImage
      source={{ uri: src }}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      cachePolicy="disk"
      onError={() => { const full = getFullUrl(path); if (full && src !== full) setSrc(full); }}
    />
  );
};

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

  // Leaving the tab screen (a pushed screen, a back) must not leave the fan open behind it.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused && opened) toggleMenu();
  }, [isFocused]);
  useEffect(() => {
    if (!opened) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { toggleMenu(); return true; });
    return () => sub.remove();
  }, [opened]);

  // Three arms with Add Startup; without it, Post and Shorts sit as a mirrored pair.
  const startupArm = isFeatureOn('startups');

  // Styles for the popup buttons
  const item1Style = {
    transform: [
      { scale: animation },
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, startupArm ? -62 : -84], // Left arm sits lower than the centre
        }),
      },
      {
        translateX: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, startupArm ? -92 : -60], // Wide enough that "Add Post" clears the centre label
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
          outputRange: [0, startupArm ? -104 : -84], // Apex of the arc
        }),
      },
      {
        translateX: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, startupArm ? 0 : 60], // Slide right
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
          outputRange: [0, -62], // Right arm, mirroring the left
        }),
      },
      {
        translateX: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 92], // Mirrors the left arm
        }),
      },
    ],
  };

  const rotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View className="flex-1 items-center justify-center" style={{ transform: [{ translateY: FAB_LIFT }] }}>
      {/* Background Overlay to close menu when clicking outside */}
      {opened && (
        <Pressable
          onPress={toggleMenu}
          className="absolute -top-[1000] -left-[1000] -right-[1000] -bottom-[1000]"
        />
      )}

      {/* Sub Button 2 (e.g., Create Post) */}
      <Animated.View style={[item1Style]} className="absolute items-center">
        <TouchableOpacity className="w-12 h-12 rounded-full bg-night items-center justify-center border border-white/10 shadow-hair" onPress={() => { toggleMenu(); navigation.navigate('CreatePost'); }}>
          <Ionicons name="aperture-outline" size={20} color={C.brand[500]} />
        </TouchableOpacity>
        <Text className="text-white text-label font-display uppercase mt-2 px-3 py-1 rounded-md overflow-hidden" numberOfLines={1} style={{ backgroundColor: "rgba(18,16,14,0.85)", letterSpacing: 0.6, overflow: "hidden" }}>Add Post</Text>
      </Animated.View>

      {/* Sub Button 1 (e.g., Create Video) */}
      <Animated.View style={[item2Style]} className="absolute items-center">
        <TouchableOpacity className="w-12 h-12 rounded-full bg-night items-center justify-center border border-white/10 shadow-hair" onPress={() => { toggleMenu(); navigation.navigate('CreateShorts'); }}>
          <Ionicons name="videocam" size={20} color={C.brand[500]} />
        </TouchableOpacity>
        <Text className="text-white text-label font-display uppercase mt-2 px-3 py-1 rounded-md overflow-hidden" numberOfLines={1} style={{ backgroundColor: "rgba(18,16,14,0.85)", letterSpacing: 0.6, overflow: "hidden" }}>Add Shorts</Text>
      </Animated.View>

      {startupArm && (
      <Animated.View style={[item3Style]} className="absolute items-center">
        <TouchableOpacity className="w-12 h-12 rounded-full bg-night items-center justify-center border border-white/10 shadow-hair" onPress={() => { toggleMenu(); navigation.navigate('CreateFundingFeed'); }}>
          <Ionicons name="bulb-outline" size={20} color={C.brand[500]} />
        </TouchableOpacity>
        <Text className="text-white text-label font-display uppercase mt-2 px-3 py-1 rounded-md overflow-hidden" numberOfLines={1} style={{ backgroundColor: "rgba(18,16,14,0.85)", letterSpacing: 0.6, overflow: "hidden" }}>Add Startup</Text>
      </Animated.View>
      )}



      {/* Main Center Button — raised into the bar's notch, half above the bar. */}
      <View
        style={{
          width: FAB,
          height: FAB,
          borderRadius: FAB / 2,
          backgroundColor: C.brand[500],
          shadowColor: C.brand[500], shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45, shadowRadius: 14, elevation: 8,
        }}
      >
        <TouchableOpacity
          onPress={toggleMenu}
          activeOpacity={0.85}
          className="flex-1 rounded-full items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Create"
        >
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name="add" size={32} color={C.white} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/** Line icon, centred; the active tab fills in and turns brand orange. */
const TabIcon = ({ name, focused }: { name: any; focused: boolean }) => (
  <View className="items-center justify-center">
    <Ionicons
      name={focused ? String(name).replace('-outline', '') as any : name}
      size={28}
      color={focused ? C.accentText : C.ink3}
    />
  </View>
);

const FAB = 60;
/** Raises the create button clear of the bar: its centre sits 8pt above the top
 *  edge, so the notch shows a ring of space under it and it reads as floating. */
const FAB_LIFT = -(TAB_BAR_HEIGHT / 2 + 8);
const CORNER = 26;

/**
 * Bar outline: fully rounded (it floats), with a round notch in the top middle
 * where the create button sits. Inset by half the stroke so the hairline is not
 * clipped at the edges.
 */
const barPath = (w: number, h: number) => {
  const i = 0.75;
  const r = CORNER;
  const cx = w / 2;
  const n = FAB / 2 + 7;
  const notch = `L ${cx - n - 10} ${i} Q ${cx - n} ${i} ${cx - n + 2} ${i + 6} A ${n} ${n} 0 0 0 ${cx + n - 2} ${i + 6} Q ${cx + n} ${i} ${cx + n + 10} ${i}`;
  return `M ${i} ${r} Q ${i} ${i} ${r} ${i} ${notch} L ${w - r} ${i} Q ${w - i} ${i} ${w - i} ${r} L ${w - i} ${h - r} Q ${w - i} ${h - i} ${w - r} ${h - i} L ${r} ${h - i} Q ${i} ${h - i} ${i} ${h - r} Z`;
};

const BAR_WIDTH = width * 0.9;

export default function TabLayout() {
  const { user } = useAuth();
  // Sits above the home indicator / gesture bar rather than at a fixed 40px,
  // which floated too high on devices without one and too low on devices with a
  // tall one.
  const bottomOffset = useTabBarOffset();

  return (
    <View className="flex-1 bg-paper justify-center">
      <Tab.Navigator
        tabBar={(props) => <SlidingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarIconStyle: {
            // tabBarItemStyle lands on the OUTER wrapper View, not the Pressable
            // that actually holds the icon — that one is styles.tabVerticalUiKit
            // (justifyContent 'flex-start', padding 5) and is not overridable.
            // So the icon wrapper, normally a fixed 28px box, is grown to fill the
            // 54px content area instead; TabBarIcon's inner layer is absolutely
            // positioned at 100% and self-centring, so the glyph lands dead centre.
            flex: 1,
            height: undefined,
          },
          tabBarItemStyle: {
            // RN v7's tab item is justifyContent:'flex-start' with padding 5 (10 on
            // Android). Zeroing the padding alone leaves the icon pinned to the top of
            // the 64px item with every spare pixel below it, so centring is explicit.
            height: TAB_BAR_HEIGHT,
            paddingVertical: 0,
            justifyContent: 'center',
          },
          // Drawn as one SVG shape so the notch for the create button can be cut
          // out of it; a View can't have a concave edge.
          tabBarBackground: () => (
            <Svg width={BAR_WIDTH} height={TAB_BAR_HEIGHT} style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <Path d={barPath(BAR_WIDTH, TAB_BAR_HEIGHT)} fill={C.card} stroke={C.line} strokeWidth={1.5} />
            </Svg>
          ),
          tabBarStyle: {
            position: "absolute",
            bottom: bottomOffset,
            marginHorizontal: width * 0.05,
            backgroundColor: "transparent",
            // No overflow:hidden here. It was added to keep the blur inside the
            // pill, but it also clipped everything the create button opens —
            // those sub-buttons animate to -70px, outside the bar, so the menu
            // appeared to do nothing. The blur clips itself in its own
            // container, which is where that rounding belongs.
            borderRadius: TAB_BAR_HEIGHT / 2,
            height: TAB_BAR_HEIGHT,
            borderWidth: 0,
            // React Navigation draws a hairline top border and an Android
            // elevation shadow by default; both showed as a dark line across the notch.
            borderTopWidth: 0,
            elevation: 0,
            // No elevation here.
            //
            // On Android, elevation makes the view draw a background layer to
            // cast its shadow. With backgroundColor "transparent" that layer
            // renders as a solid black box — which is what was sitting behind
            // the blur the whole time, and why changing the tint never helped.
            // Shadow props are iOS-only and harmless, but the glass reads from
            // its own rim highlight rather than a drop shadow anyway.
            ...(Platform.OS === 'ios'
              ? {
                  shadowColor: "#12100E",
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.22,
                  shadowRadius: 24,
                }
              : {}),
            // The old bar was 60px tall with 10px top + 46px bottom padding,
            // leaving 4px of usable space for 24px icons — which is why they
            // rendered spilling out above the pill.
            paddingTop: 0,
            paddingBottom: 0,
          },
        }}
      >
        {/* Screens stay the same */}
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarAccessibilityLabel: "Home tab", tabBarIcon: ({ focused }) => <TabIcon name="home-outline" focused={focused} /> }} />

        <Tab.Screen name="Shorts" component={Shorts} options={{ tabBarAccessibilityLabel: "Shorts tab", tabBarStyle: { display: 'none' }, tabBarIcon: ({ focused }) => <TabIcon name="play-outline" focused={focused} /> }} />

        <Tab.Screen
          name="Create"
          component={CreateShorts}
          options={{
            tabBarButton: (props) => <CustomTabBarButton {...props} />
          }}
        />

        <Tab.Screen name="Explore" component={ExploreHub} options={{ tabBarAccessibilityLabel: "Explore tab", tabBarIcon: ({ focused }) => <TabIcon name="compass-outline" focused={focused} /> }} />
        
        <Tab.Screen 
          name="Profile" 
          component={Profile} 
          options={{ 
            tabBarAccessibilityLabel: 'You, profile tab',
            tabBarIcon: ({ focused }) => (
              user?.avatar ? (
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: focused ? C.accentText : 'transparent',
                  overflow: 'hidden',
                }}>
                  <TabAvatar key={user.avatar} path={user.avatar} />
                </View>
              ) : (
                <TabIcon name="person-outline" focused={focused} />
              )
            ) 
          }} 
        />
      </Tab.Navigator>
    </View>
  );
}
