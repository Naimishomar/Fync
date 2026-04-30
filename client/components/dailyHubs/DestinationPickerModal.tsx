import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, Pressable, TextInput, 
  Dimensions, ActivityIndicator, Keyboard,
  ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

const { width, height: screenHeight } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (destination: { latitude: number, longitude: number, label: string }) => void;
}

const DestinationPickerModal = ({ visible, onClose, onSelect }: Props) => {
  const [region, setRegion] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const mapRef = React.useRef<MapView>(null);

  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
          setRegion({
            latitude: 28.6139,
            longitude: 77.2090,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          });
          return;
      }

      const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
      });
      
      const initialRegion = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(initialRegion);
      setSelectedLocation(loc.coords);
    } catch (e) {
      console.error(e);
      setRegion({
        latitude: 28.6139,
        longitude: 77.2090,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=5`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data.features) {
        const filtered = data.features.filter((f: any) => 
            f.properties.country === 'India' || f.properties.countrycode === 'IN' || 
            (f.properties.state && f.properties.state.includes("India"))
        );

        const formattedSuggestions = filtered.map((item: any) => ({
            properties: {
                name: item.properties.name || item.properties.city || "Unknown Place",
                city: item.properties.city || item.properties.state || "",
                state: item.properties.state || "",
                country: "India"
            },
            geometry: {
                coordinates: item.geometry.coordinates
            }
        }));
        setSuggestions(formattedSuggestions);
      }
    } catch (e) {
      console.log("Direct Photon fetch failed, trying Nominatim fallback...");
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&countrycodes=in`;
        const response = await fetch(url, { headers: { 'User-Agent': 'FyncApp/1.0' } });
        const data = await response.json();
        if (Array.isArray(data)) {
            const formatted = data.map((item: any) => ({
                properties: { name: item.display_name.split(',')[0], city: "", state: "", country: "India" },
                geometry: { coordinates: [parseFloat(item.lon), parseFloat(item.lat)] }
            }));
            setSuggestions(formatted);
        }
      } catch (err) {
        console.error("All city suggestion attempts failed:", err);
      }
    }
  };

  const selectSuggestion = (feature: any) => {
    const [lon, lat] = feature.geometry.coordinates;
    const name = feature.properties.name || feature.properties.city || feature.properties.state || "Location";
    
    const newLoc = { latitude: lat, longitude: lon };
    setSelectedLocation(newLoc);
    setLabel(name);
    setSearchQuery(name);
    setSuggestions([]);
    Keyboard.dismiss();

    // Automatically confirm and close on selection
    onSelect({
        latitude: lat,
        longitude: lon,
        label: name
    });
    onClose();
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    Keyboard.dismiss();
    setSuggestions([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&countrycodes=in`;
      const response = await fetch(url, { headers: { 'User-Agent': 'FyncApp/1.0' } });
      const data = await response.json();

      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        
        setSelectedLocation({ latitude: lat, longitude: lon });
        setLabel(item.display_name.split(',')[0]);

        if (mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: lat,
                longitude: lon,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 1000);
        }
      } else {
        Toast.show({ type: 'error', text1: 'Location Not Found', text2: 'Try a different search term within India.' });
      }
    } catch (e) {
      console.error("Direct manual search failed:", e);
      Toast.show({ type: 'error', text1: 'Search Error', text2: 'Please check your connection.' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelect({
        ...selectedLocation,
        label: label || searchQuery || "Destination"
      });
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View 
            className="bg-white rounded-t-[40px] overflow-hidden"
            style={{ height: screenHeight * 0.85 }}
          >
          {/* Header */}
          <View className="px-8 pt-8 pb-4 flex-row items-center justify-between border-b border-slate-50">
            <View>
              <Text className="text-zinc-900 font-black uppercase text-xl tracking-tighter">Commute <Text className="text-orange-500">Guard</Text></Text>
              <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-0.5">Target Destination Picker</Text>
            </View>
            <Pressable onPress={onClose} className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
              <Ionicons name="close" size={20} color="#18181b" />
            </Pressable>
          </View>

          {/* Search Bar & Suggestions */}
          <View className="px-6 py-4 bg-white z-20">
            <View className="flex-row items-center bg-slate-50 rounded-2xl border border-slate-100 px-4 py-1">
               <Feather name="search" size={18} color="#f97316" />
               <TextInput
                  value={searchQuery}
                  onChangeText={fetchSuggestions}
                  placeholder="Search destination (e.g. Noida City Center)"
                  placeholderTextColor="#94A3B8"
                  className="flex-1 px-3 py-3 text-sm font-semibold text-zinc-900"
                  onSubmitEditing={handleSearch}
               />
               {loading && <ActivityIndicator size="small" color="#f97316" />}
            </View>

            {suggestions.length > 0 && (
              <View 
                className="absolute top-20 left-6 right-6 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 z-30"
                style={{ maxHeight: 300 }}
              >
                 <ScrollView showsVerticalScrollIndicator={false}>
                    {suggestions.map((item, index) => {
                        const props = item.properties;
                        const mainName = props.name || props.city || props.street || "Unknown Place";
                        const subName = [props.city, props.state, props.country].filter(Boolean).join(", ");
                        
                        return (
                            <Pressable 
                                key={index} 
                                onPress={() => selectSuggestion(item)}
                                className="p-4 border-b border-slate-50 flex-row items-center"
                            >
                                <View className="w-8 h-8 bg-orange-50 rounded-xl items-center justify-center mr-3">
                                    <Ionicons name="location-outline" size={16} color="#f97316" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-zinc-900 font-bold text-xs" numberOfLines={1}>{mainName}</Text>
                                    <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-wider" numberOfLines={1}>{subName}</Text>
                                </View>
                            </Pressable>
                        );
                    })}
                 </ScrollView>
              </View>
            )}
          </View>

          {/* Map Section */}
          <View className="flex-1">
            {region ? (
              <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={region}
                onRegionChangeComplete={setRegion}
                onPress={(e) => {
                    setSelectedLocation(e.nativeEvent.coordinate);
                    setSuggestions([]);
                }}
              >
                {selectedLocation && (
                  <Marker coordinate={selectedLocation}>
                    <View className="items-center">
                       <View className="bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 mb-1">
                          <Text className="text-white font-black text-[8px] uppercase tracking-widest">Target</Text>
                       </View>
                       <Ionicons name="location" size={32} color="#f97316" />
                    </View>
                  </Marker>
                )}
              </MapView>
            ) : (
              <View className="flex-1 items-center justify-center bg-slate-50">
                 <ActivityIndicator size="large" color="#f97316" />
                 <Text className="text-slate-400 font-black uppercase text-[10px] tracking-widest mt-4">Initializing Neural Map...</Text>
              </View>
            )}

            {/* Float Action Button to Confirm */}
            <View className="absolute bottom-10 left-6 right-6">
                <View className="bg-white/90 p-5 rounded-[28px] border border-white/50 shadow-2xl mb-4 backdrop-blur-xl">
                   <View className="flex-row items-center mb-2">
                      <Ionicons name="navigate-circle" size={20} color="#f97316" />
                      <Text className="text-zinc-900 font-black uppercase text-[11px] tracking-widest ml-2">Selected Sector</Text>
                   </View>
                   <Text className="text-slate-500 text-xs font-bold" numberOfLines={1}>
                      {selectedLocation ? `LAT: ${selectedLocation.latitude.toFixed(4)} | LON: ${selectedLocation.longitude.toFixed(4)}` : 'Scanning for target...'}
                   </Text>
                </View>

                <Pressable
                  onPress={handleConfirm}
                  disabled={!selectedLocation}
                  className={`py-5 rounded-[24px] items-center justify-center shadow-xl ${selectedLocation ? 'bg-zinc-900 shadow-black/20' : 'bg-slate-200 shadow-none'}`}
                >
                    <Text className={`font-black uppercase text-xs tracking-[2px] ${selectedLocation ? 'text-white' : 'text-slate-400'}`}>
                       Set Destination
                    </Text>
                </Pressable>
            </View>
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default DestinationPickerModal;
