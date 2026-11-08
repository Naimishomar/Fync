import React from 'react';
import { View, Text, Pressable, Linking, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/colors';
import { Card, IconTile, IconBtn, Tag, TagRow } from '../ui/kit';
import { OwnerActions } from './ProfileBits';

const STATUS_CONFIG = (): Record<string, { label: string; color: string }> => ({
  completed:    { label: 'Completed',   color: C.ink2 },
  'in-progress':{ label: 'In progress', color: C.accentText },
  archived:     { label: 'Archived',    color: C.ink3 },
});

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
  const status = STATUS_CONFIG()[project.status || 'completed'] || STATUS_CONFIG().completed;
  const isLiked = project.likes?.includes(currentUserId || '');

  return (
    <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 0, overflow: 'hidden' }}>
      {project.images && project.images.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="bg-paper-2"
          contentContainerStyle={{ padding: 12, gap: 12 }}
        >
          {project.images.map((img, i) => (
            <Image
              key={i}
              source={{ uri: img }}
              style={{ width: 288, height: 176, borderRadius: 12 }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ))}
        </ScrollView>
      ) : (
        <View className="w-full h-28 bg-paper-2 items-center justify-center">
          <IconTile icon="cube-outline" size={44} color={C.ink3} bg={C.card} />
          <Text className="text-xs text-ink-3 font-sans mt-2">No screenshots added</Text>
        </View>
      )}

      <View className="p-4">
        <View className="flex-row items-start" style={{ gap: 12 }}>
          <View className="flex-1" style={{ minWidth: 0 }}>
            <View className="flex-row items-center" style={{ gap: 6 }}>
              {project.isFeatured ? <Ionicons name="star" size={14} color={C.accentText} accessibilityLabel="Featured" /> : null}
              <Text className="text-ink font-semibold text-base flex-1" numberOfLines={1}>{project.title}</Text>
            </View>
            {!!project.tagline && (
              <Text className="text-ink-2 text-sm font-sans mt-0.5" numberOfLines={1}>{project.tagline}</Text>
            )}
          </View>
          <Tag label={status.label} tone={{ fg: status.color }} />
        </View>

        {!!project.description && (
          <Text className="text-ink-2 text-sm leading-5 font-sans mt-2" numberOfLines={3}>{project.description}</Text>
        )}

        {project.techStack && project.techStack.length > 0 ? (
          <TagRow style={{ marginTop: 12 }}>
            {project.techStack.slice(0, 5).map((tech, i) => <Tag key={i} label={tech} />)}
            {project.techStack.length > 5 ? <Tag label={`+${project.techStack.length - 5}`} /> : null}
          </TagRow>
        ) : null}

        <View className="flex-row items-center border-t border-line pt-2 mt-4">
          {project.githubUrl ? (
            <IconBtn name="logo-github" size={20} onPress={() => Linking.openURL(project.githubUrl!).catch(() => {})} accessibilityLabel="Open GitHub repository" />
          ) : null}
          {project.liveUrl ? (
            <IconBtn name="open-outline" size={20} color={C.ink2} onPress={() => Linking.openURL(project.liveUrl!).catch(() => {})} accessibilityLabel="Open live link" />
          ) : null}
          <View className="flex-1" />
          <Pressable
            onPress={() => onLike?.(project._id)}
            accessibilityRole="button"
            accessibilityLabel={isLiked ? 'Unlike project' : 'Like project'}
            accessibilityState={{ selected: !!isLiked }}
            className="flex-row items-center px-3 rounded-full active:opacity-85"
            style={{ minHeight: 44, gap: 6 }}
          >
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={18} color={isLiked ? C.danger : C.ink3} />
            <Text className="text-ink-2 font-semibold text-sm">{project.likes?.length || 0}</Text>
          </Pressable>
          {isOwner ? (
            <>
              <IconBtn
                name={project.isFeatured ? 'star' : 'star-outline'}
                size={18}
                color={project.isFeatured ? C.accentText : C.ink3}
                onPress={() => onToggleFeatured?.(project._id)}
                accessibilityLabel={project.isFeatured ? 'Unfeature project' : 'Feature project'}
              />
              <OwnerActions what="project" onEdit={() => onEdit?.(project)} onDelete={() => onDelete?.(project._id)} />
            </>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
