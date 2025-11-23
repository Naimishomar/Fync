import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './components/login-screen';
import SignUpScreen from './components/sign-up-screen';
import ProfileSetup1 from './components/profile-setup-1';
import ProfileSetup2 from './components/profile-setup-2';
import HomeScreen from './components/home-screen';
import { StatusBar } from 'expo-status-bar';
<<<<<<< HEAD
=======
import BackgroundWrapper from './components/background-wrapper';
>>>>>>> f18fca26f74403108d329667df4b1367558e8f2e
import './global.css';
import { Hello } from 'components/Hello';

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  ProfileSetup1: undefined;
  ProfileSetup2: undefined;
  Home1: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
<<<<<<< HEAD
    <>
    <Hello/>
    </>
=======
    <NavigationContainer>
      <StatusBar style="auto" />
      <BackgroundWrapper>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: {
              backgroundColor: 'transparent',
            },
          }}
          initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignUpScreen} />
          <Stack.Screen name="ProfileSetup1" component={ProfileSetup1} />
          <Stack.Screen name="ProfileSetup2" component={ProfileSetup2} />
          <Stack.Screen name="Home1" component={HomeScreen} />
        </Stack.Navigator>
      </BackgroundWrapper>
    </NavigationContainer>
>>>>>>> f18fca26f74403108d329667df4b1367558e8f2e
  );
}
