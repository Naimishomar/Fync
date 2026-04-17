import React from 'react';
import { View, Text, Pressable, Linking, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed:    { label: 'Completed',    color: '#059669', bg: '#ECFDF5' },
  'in-progress':{ label: 'In Progress',  color: '#D97706', bg: '#FFFBEB' },
  archived:     { label: 'Archived',     color: '#6B7280', bg: '#F3F4F6' },
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
  const status = STATUS_CONFIG[project.status || 'completed'];
  const isLiked = project.likes?.includes(currentUserId || '');
  const firstImage = project.images?.[0];

  return (
    <View className="mx-4 mb-4 bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Cover image */}
      {firstImage ? (
        <Image source={{ uri: firstImage }} className="w-full h-36" resizeMode="cover" />
      ) : (
        <View className="w-full h-20 bg-gradient-to-br from-indigo-50 to-purple-50 items-center justify-center">
          <MaterialCommunityIcons name="code-braces" size={32} color="#C4B5FD" />
        </View>
      )}

      <View className="p-4">
        {/* Title row */}
        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center gap-2 flex-1 mr-2">
            {project.isFeatured && (
              <Ionicons name="star" size={14} color="#F59E0B" />
            )}
            <Text className="text-gray-900 font-bold text-base flex-1" numberOfLines={1}>
              {project.title}
            </Text>
          </View>
          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: status.bg }}>
            <Text className="text-[10px] font-bold" style={{ color: status.color }}>{status.label}</Text>
          </View>
        </View>

        {/* Tagline */}
        {project.tagline && (
          <Text className="text-gray-500 text-xs mb-2" numberOfLines={1}>{project.tagline}</Text>
        )}

        {/* Description */}
        {project.description && (
          <Text className="text-gray-600 text-sm leading-5 mb-3" numberOfLines={2}>
            {project.description}
          </Text>
        )}

        {/* Tech Stack */}
        {project.techStack && project.techStack.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 mb-3">
            {project.techStack.slice(0, 5).map((tech, i) => (
              <View key={i} className="bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                <Text className="text-indigo-600 text-[10px] font-semibold">{tech}</Text>
              </View>
            ))}
            {project.techStack.length > 5 && (
              <View className="bg-gray-100 px-2 py-0.5 rounded-md">
                <Text className="text-gray-500 text-[10px] font-semibold">+{project.techStack.length - 5}</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer row */}
        <View className="flex-row items-center justify-between border-t border-gray-50 pt-3">
          {/* Links */}
          <View className="flex-row gap-2">
            {project.githubUrl && (
              <Pressable onPress={() => Linking.openURL(project.githubUrl!)}
                className="flex-row items-center gap-1 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                <Ionicons name="logo-github" size={14} color="#374151" />
                <Text className="text-gray-700 text-xs font-medium">Code</Text>
              </Pressable>
            )}
            {project.liveUrl && (
              <Pressable onPress={() => Linking.openURL(project.liveUrl!)}
                className="flex-row items-center gap-1 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                <Ionicons name="open-outline" size={14} color="#059669" />
                <Text className="text-emerald-700 text-xs font-medium">Live</Text>
              </Pressable>
            )}
          </View>

          {/* Actions */}
          <View className="flex-row items-center gap-2">
            {/* Like */}
            <Pressable onPress={() => onLike?.(project._id)} className="flex-row items-center gap-1">
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={16}
                color={isLiked ? '#EC4899' : '#9CA3AF'} />
              <Text className="text-gray-400 text-xs">{project.likes?.length || 0}</Text>
            </Pressable>

            {/* Views */}
            <View className="flex-row items-center gap-1">
              <Ionicons name="eye-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-400 text-xs">{project.views || 0}</Text>
            </View>

            {/* Owner actions */}
            {isOwner && (
              <>
                <Pressable onPress={() => onToggleFeatured?.(project._id)} className="p-1">
                  <Ionicons name={project.isFeatured ? 'star' : 'star-outline'} size={16}
                    color={project.isFeatured ? '#F59E0B' : '#9CA3AF'} />
                </Pressable>
                <Pressable onPress={() => onEdit?.(project)} className="p-1">
                  <Ionicons name="pencil-outline" size={16} color="#6366F1" />
                </Pressable>
                <Pressable onPress={() => onDelete?.(project._id)} className="p-1">
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
