  import React, { useRef, useState, useCallback, useEffect } from "react";
  import {
    View,
    Text,
    FlatList,
    Dimensions,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ActivityIndicator,
  } from "react-native";
  import { Video } from "expo-av";
  import { Ionicons } from "@expo/vector-icons";

  const { height, width } = Dimensions.get("window");

  // Replace these with your API response
  const DATA = [
    {
      id: "1",
      uri: "https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny_720p_1mb.mp4",
      user: "creator_one",
      description: "A lovely bunny",
    },
    {
      id: "2",
      uri: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      user: "creator_two",
      description: "Flowers bloom beautifully",
    },
    {
      id: "3",
      uri: "https://www.w3schools.com/html/mov_bbb.mp4",
      user: "creator_three",
      description: "Big buck bunny meme",
    },
  ];

  export default function Shorts() {
    const [loadingMap, setLoadingMap] = useState({});
    const videoRefs = useRef(new Map());
    const viewableIndex = useRef(0);

    const viewConfigRef = useRef({
      viewAreaCoveragePercentThreshold: 80,
    });

    const togglePlayForId = async (id) => {
      try {
        const ref = videoRefs.current.get(id);
        if (!ref) return;
        const status = await ref.getStatusAsync();
        if (status?.isPlaying) {
          await ref.pauseAsync();
        } else {
          await ref.playAsync();
        }
      } catch (e) {
        console.warn("togglePlayForId error:", e);
      }
    };

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
      if (!viewableItems || viewableItems.length === 0) return;

      const visible = viewableItems[0];
      const id = visible.item.id;

      // play the visible video, pause others
      for (const [key, ref] of videoRefs.current) {
        if (!ref) continue;
        if (key === id) ref.playAsync?.().catch(() => {});
        else ref.pauseAsync?.().catch(() => {});
      }

      viewableIndex.current = visible.index;
    }).current;

    const setVideoRef = useCallback((id, ref) => {
      if (!id) return;
      if (ref) videoRefs.current.set(id, ref);
      else videoRefs.current.delete(id);
    }, []);

    useEffect(() => {
      setTimeout(() => {
        const firstId = DATA[0].id;
        const ref = videoRefs.current.get(firstId);
        ref?.playAsync?.().catch(() => {});
      }, 300);
    }, []);

    const renderItem = ({ item }) => {
      return (
        <View className="w-full h-screen bg-black">
          {/* VIDEO wrapped with TouchableWithoutFeedback to toggle on tap */}
          <TouchableWithoutFeedback onPress={() => togglePlayForId(item.id)}>
            <View>
              <Video
                ref={(ref) => setVideoRef(item.id, ref)}
                source={{ uri: item.uri }}
                style={{
                  width: width,
                  height: height,
                  backgroundColor: "black",
                }}
                resizeMode="cover"
                isLooping
                shouldPlay={false}
                onLoadStart={() => setLoadingMap((s) => ({ ...s, [item.id]: true }))}
                onLoad={() => setLoadingMap((s) => ({ ...s, [item.id]: false }))}
                useNativeControls={false}
              />
            </View>
          </TouchableWithoutFeedback>

          {/* LOADING SPINNER */}
          {loadingMap[item.id] && (
            <View className="absolute inset-0 flex items-center justify-center">
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {/* OVERLAY CONTENT (left side) */}
          <View className="absolute left-4 right-4 bottom-10 flex-row justify-between items-end">
            {/* LEFT: username + description */}
            <View className="flex-1">
              <Text className="font-semibold text-base mb-1 text-pink-300">
                @{item.user}
              </Text>

              <Text className="text-gray-300 text-sm max-w-[70%]">
                {item.description}
              </Text>
            </View>

            {/* RIGHT: Action buttons */}
            <View className="w-16 items-center justify-end">
              <TouchableOpacity className="mb-5">
                <Ionicons name="heart-outline" size={30} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity className="mb-5">
                <Ionicons name="chatbubble-outline" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity className="mb-1">
                <Ionicons name="share-social-outline" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    };

    return (
      <FlatList
        data={DATA}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        pagingEnabled
        horizontal={false}
        snapToInterval={height}
        decelerationRate="fast"
        snapToAlignment="start"
        showsVerticalScrollIndicator={false}
        viewabilityConfig={viewConfigRef.current}
        onViewableItemsChanged={onViewableItemsChanged}
        getItemLayout={(_, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
        initialNumToRender={2}
        windowSize={3}
        removeClippedSubviews
      />
    );
  }
