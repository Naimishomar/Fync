import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getFullUrl } from '../utils/imageUtils';

interface AvatarProps {
  user: {
    avatar?: string;
    username?: string;
    user_access?: 'admin' | 'user' | 'alumni' | 'recruiter';
  } | null | undefined;
  size?: number;
  showBadge?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ user, size = 36, showBadge = true }) => {
  const isAlumni = user?.user_access === 'alumni';
  const isRecruiter = user?.user_access === 'recruiter';
  
  const avatarUrl = getFullUrl(user?.avatar) || `https://ui-avatars.com/api/?name=${user?.username || 'U'}&background=random&color=fff`;

  return (
    <View style={{ width: size, height: size }}>
      <ExpoImage
        source={{ uri: avatarUrl }}
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          isAlumni && { borderWidth: 2, borderColor: '#F5B700' },
          isRecruiter && { borderWidth: 2, borderColor: '#4F46E5' }
        ]}
        className="rounded-full"
        cachePolicy="disk"
      />
      {isAlumni && showBadge && (
        <View 
          style={[
            styles.badge, 
            { 
              backgroundColor: '#F5B700',
              width: size * 0.4, 
              height: size * 0.4, 
              borderRadius: (size * 0.4) / 2,
              bottom: -2,
              right: -2,
            }
          ]}
        >
          <Ionicons name="school" size={size * 0.25} color="black" />
        </View>
      )}
      {isRecruiter && showBadge && (
        <View 
          style={[
            styles.badge, 
            { 
              backgroundColor: '#4F46E5',
              width: size * 0.4, 
              height: size * 0.4, 
              borderRadius: (size * 0.4) / 2,
              bottom: -2,
              right: -2,
            }
          ]}
        >
          <Ionicons name="briefcase" size={size * 0.25} color="#12100E" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    backgroundColor: '#F5B700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F5F2EC',
  },
});

export default memo(Avatar);
