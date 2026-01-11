import React, { useState, ReactNode } from "react";
import { ScrollView, RefreshControl, ViewStyle, StyleProp } from "react-native";

type Props = {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const RefreshableScreen = ({ onRefresh, children, style }: Props) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      style={style}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={["#ffffff"]}
          tintColor="#ffffff"
          progressBackgroundColor="#000"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
};

export default RefreshableScreen;