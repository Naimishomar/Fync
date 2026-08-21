import { TouchableOpacity, View, Dimensions, Text } from "react-native";
import { Image as ExpoImage } from 'expo-image';
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from '@react-navigation/native';
import RecruiterPortal from "./opportunity/RecruiterPortal";
import RecruiterProfile from "./RecruiterProfile";
import SearchScreen from "./SearchScreen";
import ChatList from "./ChatList";
import { useAuth } from "context/auth.context";

const { width } = Dimensions.get('window');
const Tab = createBottomTabNavigator();

// Pill bar: the radius is always half the height (mockup .tabbar, 64/32).
const TAB_BAR_HEIGHT = 64;

// Custom center button for "Post Opportunity"
const PostOpportunityButton = ({ children, onPress }: any) => {
  const navigation = useNavigation<any>();

  return (
    <View className="flex-1 items-center justify-center">
      <View
        style={{
          shadowColor: '#F97316', shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.4, shadowRadius: 10, elevation: 10
        }}
        className="w-[72px] h-[72px] rounded-full bg-ink items-center justify-center"
      >
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateOpportunity', { type: 'internship' })}
          activeOpacity={0.9}
          className="w-[60px] h-[60px] rounded-full overflow-hidden"
        >
          <View
            className="flex-1 items-center justify-center"
           style={{ backgroundColor: '#F97316' }}>
            <Ionicons name="add" size={32} color="#12100E" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Placeholder component for the center tab (never rendered)
const PlaceholderScreen = () => <View />;

export default function RecruiterTabLayout() {
  const { user } = useAuth();
  return (
    <View className="flex-1 bg-paper justify-center">
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: "#F97316",
          tabBarInactiveTintColor: "rgba(245,242,236,0.55)",
          tabBarStyle: {
            position: "absolute",
            bottom: 40,
            marginHorizontal: width * 0.05,
            backgroundColor: "rgba(18, 16, 14, 0.94)",
            borderRadius: TAB_BAR_HEIGHT / 2,
            height: TAB_BAR_HEIGHT,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.12)",
            elevation: 10,
            shadowColor: "#12100E",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.28,
            shadowRadius: 30,
            paddingTop: 0,
            paddingBottom: 0,
          },
        }}
      >
        {/* Dashboard / Recruiter Portal */}
        <Tab.Screen
          name="Dashboard"
          component={RecruiterPortal}
          options={{
            tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={25} color={color} />,
          }}
        />

        {/* Find Talent */}
        <Tab.Screen
          name="FindTalent"
          component={SearchScreen}
          options={{
            tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={25} color={color} />,
          }}
        />

        {/* Center - Post Opportunity */}
        <Tab.Screen
          name="PostOpportunity"
          component={PlaceholderScreen}
          options={{
            tabBarButton: (props) => <PostOpportunityButton {...props} />,
          }}
        />

        {/* Messages */}
        <Tab.Screen
          name="Messages"
          component={ChatList}
          options={{
            tabBarIcon: ({ color }) => <Ionicons name="chatbubble-outline" size={25} color={color} />,
          }}
        />

        {/* Profile */}
        <Tab.Screen
          name="Profile"
          component={RecruiterProfile}
          options={{
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
                <Ionicons name="person-outline" size={25} color={color} />
              )
            )
          }}
        />
      </Tab.Navigator>
    </View>
  );
}
