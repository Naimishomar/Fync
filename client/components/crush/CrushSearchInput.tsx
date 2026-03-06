import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, Pressable, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';

interface User {
    _id: string;
    name: string;
    username: string;
    avatar?: string;
}

interface CrushSearchInputProps {
    onSelect: (user: User) => void;
}

const CrushSearchInput = ({ onSelect }: CrushSearchInputProps) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const search = async () => {
            if (query.length < 2) {
                setSuggestions([]);
                return;
            }
            setLoading(true);
            try {
                const res = await axios.post('/user/search', { name: query });
                if (res.data.success) {
                    setSuggestions(res.data.users);
                }
            } catch (err) {
                console.error("Search error:", err);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(search, 300);
        return () => clearTimeout(timer);
    }, [query]);

    return (
        <View className="relative z-50">
            <View className="flex-row items-center bg-gray-900 rounded-2xl px-4 py-2 border border-gray-800">
                <Ionicons name="search-outline" size={20} color="gray" />
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search by username or name..."
                    placeholderTextColor="#666"
                    className="flex-1 ml-2 text-white h-12"
                />
                {loading && <ActivityIndicator size="small" color="#ff3b82" />}
            </View>

            {suggestions.length > 0 && (
                <View className="absolute top-16 left-0 right-0 bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden max-h-60 z-50">
                    <FlatList
                        data={suggestions}
                        keyExtractor={item => item._id}
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() => {
                                    onSelect(item);
                                    setQuery('');
                                    setSuggestions([]);
                                }}
                                className="flex-row items-center p-4 border-b border-gray-800 active:bg-gray-800"
                            >
                                <Image
                                    source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.username}` }}
                                    className="w-10 h-10 rounded-full"
                                />
                                <View className="ml-3">
                                    <Text className="text-white font-bold">{item.name}</Text>
                                    <Text className="text-gray-500 text-sm">@{item.username}</Text>
                                </View>
                            </Pressable>
                        )}
                    />
                </View>
            )}
        </View>
    );
};

export default CrushSearchInput;
