import React from 'react';
import { View, Text, Pressable, Linking, Image, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed:    { label: 'Completed',    color: '#12100E', bg: '#F5F2EC' },
  'in-progress':{ label: 'In Progress',  color: '#F97316', bg: '#EDE8E0' },
  archived:     { label: 'Archived',     color: '#8B857E', bg: '#F5F2EC' },
};

interface Project {
  _id: string;
  title: string;
  tagline?: string;
  description?: string;
  techStack?: string[];
  githubUrl?: string;
  liveUrl?: string;
  images?: string[];
  status?: string;
  likes?: string[];
  views?: number;
  isFeatured?: boolean;
  collaborators?: any[];
}

interface Props {
  project: Project;
  isOwner?: boolean;
  onEdit?: (p: Project) => void;
  onDelete?: (id: string) => void;
  onToggleFeatured?: (id: string) => void;
  onLike?: (id: string) => void;
  currentUserId?: string;
}

export default function ProjectCard({
  project, isOwner, onEdit, onDelete, onToggleFeatured, onLike, currentUserId
}: Props) {
  const status = STATUS_CONFIG[project.status || 'completed'] || STATUS_CONFIG.completed;
  const isLiked = project.likes?.includes(currentUserId || '');

  return (
    <View className="mx-4 mb-6 bg-card rounded-card border border-line overflow-hidden shadow-hair">
      {/* Images Slider */}
      {project.images && project.images.length > 0 ? (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          className="bg-paper-2"
          contentContainerStyle={{ padding: 12 }}
        >
           {project.images.map((img, i) => (
             <Image 
                key={i} 
                source={{ uri: img }} 
                className="w-72 h-44 rounded-card mr-4 border border-line" 
                resizeMode="cover" 
             />
           ))}
        </ScrollView>
      ) : (
        <View className="w-full h-32 bg-paper-2 items-center justify-center border-b border-line">
          <View className="w-12 h-12 bg-card rounded-card items-center justify-center shadow-hair">
            <Feather name="box" size={24} color="#F97316" />
          </View>
          <Text className="text-label text-ink-3 font-display uppercase mt-3">No Screenshots Added</Text>
        </View>
      )}

      <View className="p-6">
        {/* Title row */}
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-4">
            <View className="flex-row items-center gap-2 mb-1">
              {project.isFeatured && (
                <View className="bg-brand-500 w-2 h-2 rounded-full shadow-hair" />
              )}
              <Text className="text-ink font-display uppercase text-sm leading-tight" numberOfLines={1}>
                {project.title}
              </Text>
            </View>
            {project.tagline && (
              <Text className="text-ink-3 font-semibold text-label uppercase" numberOfLines={1}>{project.tagline}</Text>
            )}
          </View>
          <View className="border border-line px-2.5 py-1 rounded-full" style={{ backgroundColor: status.bg }}>
            <Text className="text-label font-display uppercase" style={{ color: status.color }}>{status.label}</Text>
          </View>
        </View>

        {/* Description */}
        {project.description && (
          <Text className="text-ink-2 text-xs leading-[20px] font-medium mb-4" numberOfLines={3}>
            {project.description}
          </Text>
        )}

        {/* Tech Stack */}
        {project.techStack && project.techStack.length > 0 && (
          <View className="flex-row flex-wrap gap-2 mb-6">
            {project.techStack.slice(0, 5).map((tech, i) => (
              <View key={i} className="bg-ink px-2.5 py-1 rounded-full">
                <Text className="text-white text-label font-display uppercase">{tech}</Text>
              </View>
            ))}
            {project.techStack.length > 5 && (
              <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                <Text className="text-ink-3 text-label font-display">+{project.techStack.length - 5}</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer row */}
        <View className="flex-row items-center justify-between border-t border-line pt-5">
          {/* Links */}
          <View className="flex-row gap-3">
            {project.githubUrl && (
              <Pressable onPress={() => Linking.openURL(project.githubUrl!)}
                className="w-10 h-10 bg-card items-center justify-center rounded-card border border-line shadow-hair">
                <Ionicons name="logo-github" size={18} color="#12100E" />
              </Pressable>
            )}
            {project.liveUrl && (
              <Pressable onPress={() => Linking.openURL(project.liveUrl!)}
                className="w-10 h-10 bg-card items-center justify-center rounded-card border border-line shadow-hair">
                <Feather name="external-link" size={16} color="#F97316" />
              </Pressable>
            )}
          </View>

          {/* Actions */}
          <View className="flex-row items-center gap-4">
            <Pressable onPress={() => onLike?.(project._id)} className="flex-row items-center gap-1.5 bg-paper-2 px-3 py-2 rounded-xl">
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={14}
                color={isLiked ? '#DC2626' : '#8B857E'} />
              <Text className="text-ink-3 font-display text-label">{project.likes?.length || 0}</Text>
            </Pressable>

            {/* Owner actions */}
            {isOwner && (
              <View className="flex-row items-center gap-2 border-l border-line pl-4">
                <Pressable onPress={() => onToggleFeatured?.(project._id)} className="w-8 h-8 items-center justify-center bg-paper-2 rounded-xl">
                  <Ionicons name={project.isFeatured ? 'star' : 'star-outline'} size={14}
                    color={project.isFeatured ? '#F97316' : '#8B857E'} />
                </Pressable>
                <Pressable onPress={() => onEdit?.(project)} className="w-8 h-8 items-center justify-center bg-ink rounded-xl">
                  <Feather name="edit-3" size={12} color="white" />
                </Pressable>
                <Pressable onPress={() => onDelete?.(project._id)} className="w-8 h-8 items-center justify-center bg-danger/10 rounded-xl">
                  <Ionicons name="trash-outline" size={14} color="#DC2626" />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
