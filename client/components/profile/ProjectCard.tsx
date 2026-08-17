import React from 'react';
import { View, Text, Pressable, Linking, Image, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed:    { label: 'Completed',    color: '#18181b', bg: '#f8fafc' },
  'in-progress':{ label: 'In Progress',  color: '#f97316', bg: '#fff7ed' },
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
  const status = STATUS_CONFIG[project.status || 'completed'] || STATUS_CONFIG.completed;
  const isLiked = project.likes?.includes(currentUserId || '');

  return (
    <View className="mx-4 mb-6 bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm shadow-black/5">
      {/* Images Slider */}
      {project.images && project.images.length > 0 ? (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          className="bg-slate-50"
          contentContainerStyle={{ padding: 12 }}
        >
           {project.images.map((img, i) => (
             <Image 
                key={i} 
                source={{ uri: img }} 
                className="w-72 h-44 rounded-2xl mr-4 border border-slate-200" 
                resizeMode="cover" 
             />
           ))}
        </ScrollView>
      ) : (
        <View className="w-full h-32 bg-slate-50 items-center justify-center border-b border-slate-100">
          <View className="w-12 h-12 bg-white rounded-2xl items-center justify-center shadow-sm">
            <Feather name="box" size={24} color="#f97316" />
          </View>
          <Text className="text-2xs text-slate-500 font-black uppercase mt-3 tracking-wide">No Screenshots Added</Text>
        </View>
      )}

      <View className="p-6">
        {/* Title row */}
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-4">
            <View className="flex-row items-center gap-2 mb-1">
              {project.isFeatured && (
                <View className="bg-orange-500 w-2 h-2 rounded-full shadow-sm shadow-orange-500/50" />
              )}
              <Text className="text-slate-900 font-black uppercase text-sm tracking-tight leading-tight" numberOfLines={1}>
                {project.title}
              </Text>
            </View>
            {project.tagline && (
              <Text className="text-slate-500 font-bold text-2xs uppercase tracking-wider" numberOfLines={1}>{project.tagline}</Text>
            )}
          </View>
          <View className="px-3 py-1.5 rounded-xl border border-slate-100" style={{ backgroundColor: status.bg }}>
            <Text className="text-2xs font-black uppercase tracking-wide" style={{ color: status.color }}>{status.label}</Text>
          </View>
        </View>

        {/* Description */}
        {project.description && (
          <Text className="text-slate-600 text-xs leading-[20px] font-medium mb-4" numberOfLines={3}>
            {project.description}
          </Text>
        )}

        {/* Tech Stack */}
        {project.techStack && project.techStack.length > 0 && (
          <View className="flex-row flex-wrap gap-2 mb-6">
            {project.techStack.slice(0, 5).map((tech, i) => (
              <View key={i} className="bg-slate-900 px-3 py-1.5 rounded-xl">
                <Text className="text-white text-2xs font-black uppercase tracking-wide">{tech}</Text>
              </View>
            ))}
            {project.techStack.length > 5 && (
              <View className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                <Text className="text-slate-500 text-2xs font-black">+{project.techStack.length - 5}</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer row */}
        <View className="flex-row items-center justify-between border-t border-slate-50 pt-5">
          {/* Links */}
          <View className="flex-row gap-3">
            {project.githubUrl && (
              <Pressable onPress={() => Linking.openURL(project.githubUrl!)}
                className="w-10 h-10 bg-white items-center justify-center rounded-2xl border border-slate-100 shadow-sm">
                <Ionicons name="logo-github" size={18} color="#18181b" />
              </Pressable>
            )}
            {project.liveUrl && (
              <Pressable onPress={() => Linking.openURL(project.liveUrl!)}
                className="w-10 h-10 bg-white items-center justify-center rounded-2xl border border-slate-100 shadow-sm">
                <Feather name="external-link" size={16} color="#f97316" />
              </Pressable>
            )}
          </View>

          {/* Actions */}
          <View className="flex-row items-center gap-4">
            <Pressable onPress={() => onLike?.(project._id)} className="flex-row items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl">
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={14}
                color={isLiked ? '#ef4444' : '#64748b'} />
              <Text className="text-slate-500 font-black text-2xs">{project.likes?.length || 0}</Text>
            </Pressable>

            {/* Owner actions */}
            {isOwner && (
              <View className="flex-row items-center gap-2 border-l border-slate-100 pl-4">
                <Pressable onPress={() => onToggleFeatured?.(project._id)} className="w-8 h-8 items-center justify-center bg-slate-50 rounded-xl">
                  <Ionicons name={project.isFeatured ? 'star' : 'star-outline'} size={14}
                    color={project.isFeatured ? '#f97316' : '#94a3b8'} />
                </Pressable>
                <Pressable onPress={() => onEdit?.(project)} className="w-8 h-8 items-center justify-center bg-slate-900 rounded-xl">
                  <Feather name="edit-3" size={12} color="white" />
                </Pressable>
                <Pressable onPress={() => onDelete?.(project._id)} className="w-8 h-8 items-center justify-center bg-rose-50 rounded-xl">
                  <Ionicons name="trash-outline" size={14} color="#ef4444" />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
