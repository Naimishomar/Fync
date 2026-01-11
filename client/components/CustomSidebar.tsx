import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  Pressable, 
  LayoutAnimation, 
  Platform, 
  UIManager 
} from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/auth.context';

// Enable LayoutAnimation for Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CustomSidebar(props: any) {
  const { user, logout } = useAuth();
  
  // State for dropdowns
  const [showOpportunities, setShowOpportunities] = useState(false);
  const [showQuizzes, setShowQuizzes] = useState(false);

  const toggleOpportunities = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowOpportunities(!showOpportunities);
  };

  const toggleQuizzes = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowQuizzes(!showQuizzes);
  };

  return (
    <View className="flex-1 bg-black">
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
        {/* Header Profile Section */}
        <View className="bg-gray-900 px-5 pt-12 pb-8 border-b border-gray-800">
          <Pressable onPress={() => props.navigation.navigate('Profile')}>
            <Image
              source={{ uri: user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || 'User'}` }}
              className="h-20 w-20 rounded-full border-2 border-pink-500 mb-4"
            />
          </Pressable>
          <Text className="text-white text-xl font-bold">{user?.fullName || user?.username || "Fync User"}</Text>
          <Text className="text-gray-400 text-sm">@{user?.username || "username"}</Text>
        </View>

        {/* Menu Items */}
        <View className="mt-4 px-2">
            
            {/* 1. My Profile */}
            <Pressable 
                onPress={() => props.navigation.navigate('Profile')}
                className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
            >
                <Ionicons name="person-outline" size={24} color="#f9a8d4" /> 
                <Text className="text-white text-lg ml-4 font-medium">My Profile</Text>
            </Pressable>

            {/* 2. QUIZZES DROPDOWN (Parent) */}
            <Pressable 
                onPress={toggleQuizzes}
                className="flex-row items-center justify-between px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
            >
                <View className="flex-row items-center">
                    <Ionicons name="game-controller-outline" size={24} color="#f9a8d4" /> 
                    <Text className="text-white text-lg ml-4 font-medium">Quizzes</Text>
                </View>
                <Ionicons 
                    name={showQuizzes ? "chevron-up-outline" : "chevron-down-outline"} 
                    size={20} 
                    color="#6b7280" 
                />
            </Pressable>

            {/* 2a. QUIZZES CHILDREN */}
            {showQuizzes && (
                <View className="ml-4 border-l-2 border-gray-800 pl-2">
                    {/* 1v1 Quiz */}
                    <Pressable 
                        onPress={() => props.navigation.navigate('OneVsOneSetup')}
                        className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="people-outline" size={20} color="#9ca3af" /> 
                        <Text className="text-gray-300 text-base ml-3 font-medium">1v1 Battle</Text>
                    </Pressable>

                    {/* Create Room */}
                    <Pressable 
                        onPress={() => props.navigation.navigate('CreateRoom')}
                        className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="add-circle-outline" size={20} color="#9ca3af" /> 
                        <Text className="text-gray-300 text-base ml-3 font-medium">Create Room</Text>
                    </Pressable>

                    {/* Join Room */}
                    <Pressable 
                        onPress={() => props.navigation.navigate('JoinRoomInput')}
                        className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="enter-outline" size={20} color="#9ca3af" /> 
                        <Text className="text-gray-300 text-base ml-3 font-medium">Join Room</Text>
                    </Pressable>
                </View>
            )}

            {/* 3. OPPORTUNITIES DROPDOWN (Parent) */}
            <Pressable 
                onPress={toggleOpportunities}
                className="flex-row items-center justify-between px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
            >
                <View className="flex-row items-center">
                    <Ionicons name="briefcase-outline" size={24} color="#f9a8d4" /> 
                    <Text className="text-white text-lg ml-4 font-medium">Opportunities</Text>
                </View>
                <Ionicons 
                    name={showOpportunities ? "chevron-up-outline" : "chevron-down-outline"} 
                    size={20} 
                    color="#6b7280" 
                />
            </Pressable>

            {/* 3a. OPPORTUNITIES CHILDREN */}
            {showOpportunities && (
                <View className="ml-4 border-l-2 border-gray-800 pl-2">
                    {/* Hackathon */}
                    <Pressable 
                        onPress={() => props.navigation.navigate('HackathonList')}
                        className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="code-slash-outline" size={20} color="#9ca3af" /> 
                        <Text className="text-gray-300 text-base ml-3 font-medium">Hackathons</Text>
                    </Pressable>

                    {/* Internship */}
                    <Pressable 
                        onPress={() => props.navigation.navigate('InternshipList')}
                        className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="school-outline" size={20} color="#9ca3af" /> 
                        <Text className="text-gray-300 text-base ml-3 font-medium">Internships</Text>
                    </Pressable>

                    {/* Jobs */}
                    <Pressable 
                        onPress={() => props.navigation.navigate('JobList')}
                        className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="business-outline" size={20} color="#9ca3af" /> 
                        <Text className="text-gray-300 text-base ml-3 font-medium">Jobs</Text>
                    </Pressable>

                    {/* Workshops */}
                    <Pressable 
                        onPress={() => props.navigation.navigate('WorkshopList')}
                        className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="book-outline" size={20} color="#9ca3af" /> 
                        <Text className="text-gray-300 text-base ml-3 font-medium">Workshops</Text>
                    </Pressable>
                </View>
            )}

            {/* 4. Messages */}
            <Pressable 
                onPress={() => props.navigation.navigate('ChatList')}
                className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
            >
                <Ionicons name="chatbubbles-outline" size={24} color="#f9a8d4" /> 
                <Text className="text-white text-lg ml-4 font-medium">Messages</Text>
            </Pressable>

            {/* 5. Video Calls */}
            <Pressable className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800">
                <Ionicons name="videocam-outline" size={24} color="#f9a8d4" /> 
                <Text className="text-white text-lg ml-4 font-medium">Video Calls</Text>
            </Pressable>
        </View>
      </DrawerContentScrollView>

      {/* Footer / Logout */}
      <View className="p-5 border-t border-gray-800 mb-5">
        <Pressable onPress={logout} className="flex-row items-center px-4 py-2">
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
          <Text className="text-red-500 ml-4 font-medium text-lg">Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}