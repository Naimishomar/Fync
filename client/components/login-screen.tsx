import React, { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import Checkbox from "expo-checkbox";
import { Ionicons, AntDesign } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import Toast from "react-native-toast-message";

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Login"
>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const togglePassword = useCallback(
    () => setPasswordVisible((prev) => !prev),
    []
  );

  const handleSubmit = async () => {
    const res = await fetch("http://192.168.29.104:3000/user/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });
    const data = await res.json();
    if (data.success) {
      alert(data.success);
      Toast.show({
        type: "success",
        text1: "Logged in successfully!",
        text2: "Home"
      });
      navigation.navigate("Home1");
    } else {
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: data.message
      });
    }
  };

  return (
    <View className="flex-1 px-8 justify-center bg-transparent">
      <View className="h-20" />
      <Image
        source={require("../assets/logo.png")}
        className="w-28 h-14 mb-5 self-center"
        resizeMode="contain"
      />
      <View className="flex-col gap-3">
        <TextInput
          className="w-full px-3 py-4 text-base text-pink-300 border border-white rounded-lg"
          placeholder="Username, phone number or email"
          placeholderTextColor="#A1A1A1"
          value={email}
          onChangeText={setEmail}
        />
        <View className="w-full mb-2 flex-row items-center px-3 py-1 border border-white rounded-lg">
          <TextInput
            className="flex-1 text-pink-300"
            placeholder="Password"
            placeholderTextColor="#A1A1A1"
            secureTextEntry={!passwordVisible}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={togglePassword}>
            <Ionicons
              name={passwordVisible ? "eye-off" : "eye"}
              size={22}
              color="#A1A1A1"
            />
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-row items-center justify-between mb-5">
        <View className="flex-row items-center">
          <Checkbox
            value={rememberMe}
            onValueChange={setRememberMe}
            color={rememberMe ? "#fbb6ce" : undefined}
          />
          <Text className="ml-2 text-white">Remember Me</Text>
        </View>

        <TouchableOpacity>
          <Text className="text-white font-medium">Forgot Password?</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity className="bg-pink-300 py-4 rounded-lg items-center mt-2" onPress={handleSubmit}>
        <Text className="text-white font-semibold text-base">Log in</Text>
      </TouchableOpacity>

      <View className="flex-row items-center justify-center my-7">
        <View className="flex-1 h-px bg-white" />
        <Text className="mx-3 text-white text-center">OR</Text>
        <View className="flex-1 h-px bg-white" />
      </View>

      <TouchableOpacity className="flex-row items-center justify-center border border-white py-3 rounded-full">
        <AntDesign name="google" size={20} color="white" />
        <Text className="ml-3 text-white font-medium text-base">
          Log in with Google
        </Text>
      </TouchableOpacity>

      <View className="flex-row justify-center mt-6">
        <Text className="text-white">Don’t have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
          <Text className="text-white font-semibold underline">SignUp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
