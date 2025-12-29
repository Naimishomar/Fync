import React, { useState } from "react";
import { ScrollView, RefreshControl } from "react-native";

type Props = {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
};

const RefreshableScreen = ({ onRefresh, children }: Props) => {
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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={["#000"]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
};

export default RefreshableScreen;
