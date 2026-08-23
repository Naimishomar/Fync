import { TouchableOpacity, View, Dimensions, Animated, Pressable, Text, Image, Platform, StyleSheet } from "react-native";
import { Image as ExpoImage } from 'expo-image';
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from 'expo-blur';
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
          outputRange: [0, -62], // Left arm sits lower than the centre
        }),
      },
      {
        translateX: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -92], // Wide enough that "Add Post" clears the centre label
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
          outputRange: [0, -104], // Apex of the arc
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
        <TouchableOpacity className="w-12 h-12 rounded-full bg-ink items-center justify-center border border-white/10 shadow-hair" onPress={() => navigation.navigate('CreatePost')}>
          <Ionicons name="aperture-outline" size={20} color="#F97316" />
        </TouchableOpacity>
        <Text className="text-white text-label font-display uppercase mt-2 px-3 py-1 rounded-md overflow-hidden" numberOfLines={1} style={{ backgroundColor: "rgba(18,16,14,0.85)", letterSpacing: 0.6, overflow: "hidden" }}>Add Post</Text>
      </Animated.View>

      {/* Sub Button 1 (e.g., Create Video) */}
      <Animated.View style={[item2Style]} className="absolute items-center">
        <TouchableOpacity className="w-12 h-12 rounded-full bg-ink items-center justify-center border border-white/10 shadow-hair" onPress={() => navigation.navigate('CreateShorts')}>
          <Ionicons name="videocam" size={20} color="#F97316" />
        </TouchableOpacity>
        <Text className="text-white text-label font-display uppercase mt-2 px-3 py-1 rounded-md overflow-hidden" numberOfLines={1} style={{ backgroundColor: "rgba(18,16,14,0.85)", letterSpacing: 0.6, overflow: "hidden" }}>Add Shorts</Text>
      </Animated.View>

      <Animated.View style={[item3Style]} className="absolute items-center">
        <TouchableOpacity className="w-12 h-12 rounded-full bg-ink items-center justify-center border border-white/10 shadow-hair" onPress={() => { toggleMenu(); navigation.navigate('CreateFundingFeed'); }}>
          <Ionicons name="bulb-outline" size={20} color="#F97316" />
        </TouchableOpacity>
        <Text className="text-white text-label font-display uppercase mt-2 px-3 py-1 rounded-md overflow-hidden" numberOfLines={1} style={{ backgroundColor: "rgba(18,16,14,0.85)", letterSpacing: 0.6, overflow: "hidden" }}>Add Startup</Text>
      </Animated.View>



      {/* Main Center Button */}
      {/* The wrapper carries the button's own colour, not just a radius.
          Android elevation draws from the view's background, so an elevated
          view with none renders a dark artifact behind the shape — the same
          fault that was blackening the bar. */}
      <View
        style={{
          backgroundColor: '#F97316',
          borderRadius: 999,
          shadowColor: '#F97316', shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.5, shadowRadius: 16, elevation: 8
        }}
      >
        <TouchableOpacity
          onPress={toggleMenu}
          activeOpacity={0.9}
          className="w-14 h-14 rounded-full items-center justify-center border-2 border-ink"
          style={{ backgroundColor: '#F97316' }}
          accessibilityRole="button"
          accessibilityLabel="Create"
        >
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name="add" size={28} color="#12100E" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * A tab icon that survives a transparent bar.
 *
 * Low-opacity glass means the bar takes the colour of whatever is behind it:
 * near-white over the feed, near-black over Shorts. No single icon colour reads
 * on both, so the active tab brings its own ground — a filled brand circle,
 * which is legible against anything and states the current tab more plainly
 * than a tint ever did.
 *
 * Inactive icons stay ink and take a soft light halo, the same trick a camera
 * UI uses to keep controls readable over an unpredictable photo.
 */
const TabIcon = ({ name, focused }: { name: any; focused: boolean }) => {
  if (focused) {
    return (
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: 40,
          height: 40,
          // Darker than the glass, as in the reference — the selected segment
          // there is a deeper pane inside the panel, not a brighter one. A
          // solid accent chip would read as a button sitting on the glass
          // rather than as part of it.
          backgroundColor: 'rgba(18, 16, 14, 0.45)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.22)',
        }}
      >
        <Ionicons
          name={String(name).replace('-outline', '') as any}
          size={22}
          color="#FFFFFF"
          style={{
            textShadowColor: 'rgba(0,0,0,0.4)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
        />
      </View>
    );
  }
  return (
    <View className="items-center justify-center" style={{ width: 40, height: 40 }}>
      {/* A dark halo, not a heavier tint.
          Glass this transparent takes the colour of whatever is behind it, so a
          white glyph measures 2.04:1 over the paper feed and vanishes. Raising
          the tint would fix that by making the bar opaque — which is the thing
          being asked for here. The shadow gives the glyph its own edge instead,
          so the panel stays see-through and the icon reads on either backdrop.
          It is what a camera UI does with controls over an arbitrary photo. */}
      <Ionicons
        name={name}
        size={24}
        color="rgba(255, 255, 255, 0.92)"
        style={{
          textShadowColor: 'rgba(0,0,0,0.55)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}
      />
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
    <View className="flex-1 bg-paper justify-center">
      <Tab.Navigator
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
          // The blur has to draw behind the items, so the bar itself becomes
          // transparent and a BlurView is laid in as the background. Leaving the
          // solid colour here would sit on top of the blur and cancel it.
          tabBarBackground: () => (
            <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: TAB_BAR_HEIGHT / 2, overflow: 'hidden' }}>
              {/* experimentalBlurMethod is required on Android.
                  It defaults to 'none', which means BlurView does not blur at
                  all there — it renders a flat semi-opaque fill, which is why
                  the bar looked like a black slab rather than glass. iOS blurs
                  natively and ignores this. */}
              <BlurView
                intensity={Platform.OS === 'ios' ? 100 : 80}
                tint="dark"
                experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
                style={StyleSheet.absoluteFillObject}
              />

              {/* Smoked, not frosted white. In the reference the panel is
                  darker than its backdrop and you read the background straight
                  through it — that is what makes light glyphs legible on glass
                  this transparent. Lowered to 0.34 now that Android actually
                  blurs: the tint was carrying the whole effect while the blur
                  was a no-op there. */}
              <View
                style={{
                  ...StyleSheet.absoluteFillObject,
                  backgroundColor: 'rgba(18, 16, 14, 0.34)',
                }}
              />

              {/* The rim is the whole effect. A crisp bright line following the
                  full curve is light refracting through a bevelled edge; it is
                  what separates a pane of glass from a translucent rectangle. */}
              <View
                style={{
                  ...StyleSheet.absoluteFillObject,
                  borderRadius: TAB_BAR_HEIGHT / 2,
                  borderWidth: 1.5,
                  borderColor: 'rgba(255, 255, 255, 0.42)',
                }}
              />

              {/* Brighter along the top, where a real bevel catches the most
                  light, fading before the corners so it reads as a highlight
                  rather than a second border. */}
              <View
                style={{
                  position: 'absolute',
                  top: 1.5,
                  left: TAB_BAR_HEIGHT * 0.55,
                  right: TAB_BAR_HEIGHT * 0.55,
                  height: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                }}
              />
            </View>
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

        <Tab.Screen name="Shorts" component={Shorts} options={{ tabBarAccessibilityLabel: "Shorts tab", tabBarIcon: ({ focused }) => <TabIcon name="play-outline" focused={focused} /> }} />

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
            tabBarIcon: ({ color, focused }) => (
              user?.avatar ? (
                <View style={{ 
                  width: 28, 
                  height: 28, 
                  borderRadius: 14, 
                  borderWidth: focused ? 1.5 : 0, 
                  borderColor: '#F97316',
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
