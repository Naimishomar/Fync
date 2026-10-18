import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, AppState, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { FEATURES, artUrl, isFeatureOn } from '../../constants/features';
import Skeleton from '../Skeleton';
import { daysLeftLabel } from '../../utils/deadline';

type FeaturedType = 'hackathon' | 'internship' | 'job' | 'bootcamp' | 'speaker';
type FeaturedItem = {
  type: FeaturedType;
  id: string;
  title: string;
  org?: string;
  image?: string;
  logo?: string;
  chips: string[];
  deadline?: string;
};

// type -> feature id (for gating + art) and the screen its list opens.
const META: Record<FeaturedType, { feature: string; family: 'career' | 'events'; open: (id: string) => [string, object?] }> = {
  hackathon: { feature: 'hackathons', family: 'events', open: (id) => ['HackathonDetail', { hackathonId: id }] },
  // These lists show items inline (no detail screen), so tapping lands on the list.
  internship: { feature: 'internships', family: 'career', open: () => ['InternshipList'] },
  job: { feature: 'jobs', family: 'career', open: () => ['JobList'] },
  bootcamp: { feature: 'bootcamps', family: 'events', open: () => ['BootcampScreen'] },
  speaker: { feature: 'speakers', family: 'events', open: () => ['SpeakerSessionScreen'] },
};

const GAP = 12;
const PAD = 20; // matches ExploreHub's ScrollView gutter, which this row bleeds through
const ADVANCE_MS = 3500;
const RESUME_MS = 5000;

const Poster = ({ item, w, h }: { item: FeaturedItem; w: number; h: number }) => {
  const meta = META[item.type];
  if (item.image) {
    return (
      <Image
        source={{ uri: item.image }}
        recyclingKey={item.id}
        style={{ width: w, height: h }}
        contentFit="cover"
        cachePolicy="disk"
        accessibilityIgnoresInvertColors
      />
    );
  }
  const tint = C.fam[meta.family];
  const art = artUrl(FEATURES.find((f) => f.id === meta.feature)?.art);
  return (
    <LinearGradient colors={[tint, `${tint}B3`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: w, height: h, padding: 16 }}>
      {item.logo ? (
        <View className="rounded-lg overflow-hidden mb-3" style={{ width: 40, height: 40, backgroundColor: '#FFFFFF' }}>
          <Image source={{ uri: item.logo }} recyclingKey={`${item.id}-logo`} style={{ width: 40, height: 40 }} contentFit="contain" cachePolicy="disk" />
        </View>
      ) : null}
      {/* Always-dark coloured surface: white text in both themes. */}
      <Text className="font-display" style={{ color: '#FFFFFF', fontSize: 22, lineHeight: 26 }} numberOfLines={4}>
        {item.title}
      </Text>
      {item.org ? (
        <Text className="font-sans mt-2" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }} numberOfLines={1}>
          {item.org}
        </Text>
      ) : null}
      {art ? (
        <Image source={{ uri: art }} style={{ position: 'absolute', right: 8, bottom: 8, width: w * 0.5, height: w * 0.5 }} contentFit="contain" cachePolicy="disk" />
      ) : null}
    </LinearGradient>
  );
};

const FeaturedCarousel = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const cardW = Math.round(width * 0.62);
  const cardH = Math.round(cardW * 1.25);
  const step = cardW + GAP;

  const [items, setItems] = useState<FeaturedItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [touching, setTouching] = useState(false);
  const [holdUntil, setHoldUntil] = useState(0);
  const userScroll = useRef(false);
  const listRef = useRef<FlatList<FeaturedItem>>(null);

  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let live = true;
    axios
      .get('/explore/featured')
      .then((res) => {
        const list: FeaturedItem[] = (res.data?.items ?? []).filter(
          (i: FeaturedItem) => META[i.type] && isFeatureOn(META[i.type].feature)
        );
        if (live) setItems(list);
      })
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, []);

  const count = items?.length ?? 0;

  // One timeout per state change; cleared on any change, blur, background or unmount.
  useEffect(() => {
    if (count <= 1 || touching || !isFocused || !appActive) return;
    const delay = Math.max(ADVANCE_MS, holdUntil - Date.now());
    const t = setTimeout(() => {
      const next = index + 1 >= count ? 0 : index + 1;
      listRef.current?.scrollToOffset({ offset: next * step, animated: true });
      setIndex(next);
    }, delay);
    return () => clearTimeout(t);
  }, [index, count, touching, isFocused, appActive, holdUntil, step]);

  const release = () => {
    setTouching(false);
    setHoldUntil(Date.now() + RESUME_MS);
  };

  if (items === null) {
    return (
      <View className="mt-6">
        <Header />
        <View className="flex-row" style={{ gap: GAP }}>
          <Skeleton width={cardW} height={cardH} borderRadius={16} />
          <Skeleton width={cardW} height={cardH} borderRadius={16} />
        </View>
      </View>
    );
  }
  if (count === 0) return null;

  return (
    <View className="mt-6">
      <Header />
      <FlatList
        ref={listRef}
        data={items}
        horizontal
        keyExtractor={(i) => `${i.type}:${i.id}`}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        style={{ marginHorizontal: -PAD }}
        contentContainerStyle={{ paddingHorizontal: PAD, gap: GAP }}
        getItemLayout={(_, i) => ({ length: step, offset: step * i, index: i })}
        onTouchStart={() => setTouching(true)}
        onTouchEnd={release}
        onTouchCancel={release}
        onScrollBeginDrag={() => {
          userScroll.current = true;
          setTouching(true);
        }}
        onScrollEndDrag={release}
        onMomentumScrollEnd={(e) => {
          // Only trust the offset after a user swipe: the last card can't snap to
          // the left edge, so a programmatic scroll there reads back one short.
          if (!userScroll.current) return;
          userScroll.current = false;
          setIndex(Math.min(count - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step))));
          release();
        }}
        renderItem={({ item }) => {
          const due = daysLeftLabel(item.deadline);
          return (
          <Pressable
            onPress={() => {
              const [route, params] = META[item.type].open(item.id);
              navigation.navigate(route, params);
            }}
            style={{ width: cardW }}
            className="active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel={[item.title, item.org, due?.label, ...item.chips].filter(Boolean).join('. ')}
          >
            <View className="rounded-2xl border border-line overflow-hidden bg-card">
              <Poster item={item} w={cardW} h={cardH} />
            </View>
            {item.chips.length > 0 || due ? (
              <View className="flex-row flex-wrap mt-2.5" style={{ gap: 6 }}>
                {due ? (
                  <View className={`flex-row items-center rounded-full px-2 py-0.5 border ${due.urgent ? 'bg-brand-50 border-brand-500/30' : 'border-line'}`}>
                    <Text className="font-sans text-xs text-accent-text">⏳ {due.label}</Text>
                  </View>
                ) : null}
                {item.chips.map((c) => (
                  <View key={c} className="rounded-full border border-line px-2 py-0.5">
                    <Text className="font-sans text-xs text-ink-2">{c}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text className="font-display text-ink mt-2" style={{ fontSize: 15, lineHeight: 19 }} numberOfLines={2}>
              {item.title}
            </Text>
            {item.org ? (
              <Text className="font-sans text-sm text-ink-3 mt-0.5" numberOfLines={1}>
                {item.org}
              </Text>
            ) : null}
          </Pressable>
          );
        }}
      />
      {count > 1 ? (
        <View className="flex-row justify-center mt-3" style={{ gap: 6 }}>
          {items.map((i, n) => (
            <View key={`${i.type}:${i.id}`} className={`h-1.5 rounded-full ${n === index ? 'w-4 bg-brand-500' : 'w-1.5 bg-ink/20'}`} />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const Header = () => (
  <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
    <View className="bg-brand-500 rounded-full" style={{ width: 4, height: 16 }} />
    <Text className="font-display text-label text-ink uppercase" style={{ letterSpacing: 1.4 }}>Featured</Text>
  </View>
);

export default FeaturedCarousel;
