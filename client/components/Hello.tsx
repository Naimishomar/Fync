import { Text, View } from 'react-native';

export function Hello() {
  return (
    <View className='w-full h-screen bg-black'>
      <Text className='text-2xl bg-red-500'>Hello World!</Text>
    </View>
  );
}