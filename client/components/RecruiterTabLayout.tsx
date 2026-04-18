import { TouchableOpacity, View, Dimensions, Text } from "react-native";
import { Image as ExpoImage } from 'expo-image';
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import RecruiterPortal from "./opportunity/RecruiterPortal";
import RecruiterProfile from "./RecruiterProfile";
import RecruiterFeed from "./RecruiterFeed";
import ChatList from "./ChatList";
import { useAuth } from "context/auth.context";

const { width } = Dimensions.get('window');
const Tab = createBottomTabNavigator();

// Custom center button for "Post Opportunity"
const PostOpportunityButton = ({ children, onPress }: any) => {
  const navigation = useNavigation<any>();

  return (
    <View className="flex-1 items-center justify-center">
      <View
        style={{
          shadowColor: '#ec4899', shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.4, shadowRadius: 10, elevation: 10
        }}
        className="w-[72px] h-[72px] rounded-full bg-black items-center justify-center"
      >
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateOpportunity', { type: 'internship' })}
          activeOpacity={0.9}
          className="w-[60px] h-[60px] rounded-full overflow-hidden"
        >
          <LinearGradient
            colors={['#ec4899', '#8f358aff']}
            className="flex-1 items-center justify-center"
          >
            <Ionicons name="add" size={32} color="#fff" />
          </LinearGradient>
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
    <View className="flex-1 bg-black justify-center">
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '700',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginTop: -2,
          },
          tabBarActiveTintColor: "#ec4899",
          tabBarInactiveTintColor: "#ffffffff",
          tabBarStyle: {
            position: "absolute",
            bottom: 40,
            marginHorizontal: width * 0.05,
            backgroundColor: "rgba(20, 20, 20, 0.86)",
            borderRadius: 40,
            height: 65,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.12)",
            elevation: 5,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 15,
            paddingTop: 8,
            paddingBottom: 56,
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

        {/* Global Campus Feed */}
        <Tab.Screen
          name="Feed"
          component={RecruiterFeed}
          options={{
            tabBarIcon: ({ color }) => <Ionicons name="albums-outline" size={25} color={color} />,
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
                <Ionicons name="person-outline" size={25} color={color} />
              )
            )
          }}
        />
      </Tab.Navigator>
    </View>
  );
}
