/**
 * In-app reader. The article arrives from /tech-news/article as plain blocks and
 * is rendered with native Text and Image — no WebView, and the user never leaves
 * the app. The original is always one tap away for attribution.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Linking, StatusBar, useWindowDimensions, Share,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from 'axios';
import { C } from '../../constants/colors';
import { AppBar, IconBtn } from '../ui/kit';

type Block =
  | { type: 'paragraph' | 'heading' | 'quote' | 'bullet' | 'code'; text: string }
  | { type: 'image'; src: string };

type Article = {
  title: string; byline: string | null; siteName: string;
  leadImage: string | null; readingMinutes: number; blocks: Block[]; url: string;
};

const ArticleImage = ({ src, width }: { src: string; width: number }) => {
  const [ratio, setRatio] = useState(16 / 9);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // Height is unknown until the image is measured; without this every picture
  // would be letterboxed. onLoad carries the intrinsic size, so the image is
  // fetched once instead of a separate getSize download that could also land
  // after unmount.
  return (
    <Image
      source={{ uri: src }}
      style={{ width, height: width / ratio, borderRadius: 12, marginVertical: 14, backgroundColor: '#EDE8E0' }}
      contentFit="cover"
      cachePolicy="memory-disk"
      onLoad={(e) => { const { width: w, height: h } = e.source; if (w && h) setRatio(w / h); }}
      onError={() => setFailed(true)}
    />
  );
};

export default function ArticleScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { url, title: fallbackTitle, source } = route.params ?? {};
  const { width } = useWindowDimensions();
  const contentWidth = width - 40;

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await axios.get('/tech-news/article', { params: { url } });
      setArticle(res.data.article);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'This article could not be opened.');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  const openOriginal = () => Linking.openURL(article?.url ?? url).catch(() => {});

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />
      <View className="flex-1">
          <AppBar
            title={article?.siteName ?? source ?? 'Article'}
            onBack={() => navigation.goBack()}
            right={
              <IconBtn
                name="share-outline"
                onPress={() => Share.share({ message: `${article?.title ?? fallbackTitle}\n\n${article?.url ?? url}` })}
              />
            }
          />

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={C.brand[500]} />
            <Text className="text-ink-3 text-sm mt-3">Fetching the article…</Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-4">
              <Ionicons name="document-outline" size={32} color={C.ink2} />
            </View>
            <Text className="text-ink font-display uppercase text-h2 text-center">Cannot show this one</Text>
            <Text className="text-ink-2 text-sm text-center mt-2">{error}</Text>
            <TouchableOpacity
              onPress={openOriginal}
              className="mt-6 px-6 py-4 rounded-md items-center justify-center border-2 border-ink bg-brand-500"
              accessibilityRole="button"
            >
              <Text className="font-display uppercase text-ink text-label">Open the original</Text>
            </TouchableOpacity>
          </View>
        ) : article ? (
          <ScrollView keyboardShouldPersistTaps="handled" className="flex-1 px-gutter" showsVerticalScrollIndicator={false}>
            <Text className="font-display text-ink uppercase mt-5" style={{ fontSize: 26, lineHeight: 30, letterSpacing: -0.8 }}>
              {article.title}
            </Text>

            <View className="flex-row items-center flex-wrap mt-3 mb-1" style={{ gap: 8 }}>
              <View className="bg-paper-2 px-2.5 py-1 rounded-full">
                <Text className="text-ink-2 text-label font-display uppercase">{article.siteName}</Text>
              </View>
              {!!article.byline && (
                <Text className="text-ink-3 text-sm" numberOfLines={1}>{article.byline}</Text>
              )}
              <Text className="text-ink-3 text-sm">{article.readingMinutes} min read</Text>
            </View>

            <View className="bg-ink mt-3" style={{ height: 2, opacity: 0.82 }} />

            {!!article.leadImage && <ArticleImage src={article.leadImage} width={contentWidth} />}

            {(article.blocks ?? []).map((b, i) => {
              if (b.type === 'image') return <ArticleImage key={`i${i}`} src={b.src} width={contentWidth} />;
              if (b.type === 'heading')
                return (
                  <Text key={i} className="font-display text-ink uppercase mt-6 mb-1" style={{ fontSize: 17, letterSpacing: -0.3 }}>
                    {b.text}
                  </Text>
                );
              if (b.type === 'quote')
                return (
                  <View key={i} className="border-l-4 border-brand-500 pl-4 my-4">
                    <Text className="text-ink-2 text-base" style={{ lineHeight: 26, fontStyle: 'italic' }}>{b.text}</Text>
                  </View>
                );
              if (b.type === 'bullet')
                return (
                  <View key={i} className="flex-row mt-2">
                    <Text className="text-accent-text mr-2">•</Text>
                    <Text className="text-ink-2 flex-1 text-base" style={{ lineHeight: 26 }}>{b.text}</Text>
                  </View>
                );
              if (b.type === 'code')
                return (
                  <View key={i} className="bg-paper-2 rounded-card p-4 my-3 border border-line">
                    <Text className="font-mono text-ink-2 text-sm">{b.text}</Text>
                  </View>
                );
              return (
                <Text key={i} className="text-ink-2 text-base mt-4" style={{ lineHeight: 27 }}>
                  {b.text}
                </Text>
              );
            })}

            {/* Attribution is not optional: the text belongs to the publisher. */}
            <TouchableOpacity
              onPress={openOriginal}
              className="mt-8 mb-12 py-4 rounded-md items-center justify-center border-2 border-ink bg-card flex-row"
              accessibilityRole="button"
              accessibilityLabel={`Read the original on ${article.siteName}`}
            >
              <Ionicons name="open-outline" size={16} color={C.ink} style={{ marginRight: 8 }} />
              <Text className="font-display uppercase text-ink text-label">Read on {article.siteName}</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}
