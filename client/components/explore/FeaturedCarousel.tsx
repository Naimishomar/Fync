import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, AppState, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { isFeatureOn } from '../../constants/features';
import Skeleton from '../Skeleton';
import { daysLeftLabel } from '../../utils/deadline';

type FeaturedType = 'hackathon' | 'internship' | 'job' | 'bootcamp' | 'speaker' | 'gig';
type FeaturedItem = {
  type: FeaturedType;
  id: string;
  title: string;
  org?: string;
  image?: string;
  logo?: string;
  /** Stipend / package / gig pay, already formatted. */
  pay?: string;
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
  gig: { feature: 'gigs', family: 'career', open: () => ['PaidGigs'] },
};

const GAP = 12;
const PAD = 20; // matches ExploreHub's ScrollView gutter, which this row bleeds through
const ADVANCE_MS = 3500;
const RESUME_MS = 5000;

// Company/event image fills the card; title sits on a dark scrim, so text is
// white in both themes. expo-image plays animated GIF/WebP banners as-is.
const Poster = ({ item, w, h }: { item: FeaturedItem; w: number; h: number }) => {
  const bg = item.image || item.logo;
  const tint = C.fam[META[item.type].family];
  return (
    <View style={{ width: w, height: h, backgroundColor: tint }}>
      {bg ? (
        <Image
          source={{ uri: bg }}
          recyclingKey={item.id}
          style={{ position: 'absolute', width: w, height: h }}
          contentFit="cover"
          // A square logo stretched to portrait looks mushy: blur it into a
          // colour wash and draw the sharp logo on top instead.
          blurRadius={item.image ? 0 : 18}
          cachePolicy="disk"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <LinearGradient colors={[tint, `${tint}99`]} style={{ position: 'absolute', width: w, height: h }} />
      )}
      {!item.image ? (
        <View className="items-center" style={{ paddingTop: h * 0.14 }}>
          {item.logo ? (
            <View className="rounded-full overflow-hidden" style={{ width: w * 0.5, height: w * 0.5, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' }}>
              <Image source={{ uri: item.logo }} recyclingKey={`${item.id}-logo`} style={{ width: '100%', height: '100%' }} contentFit={item.type === 'gig' ? 'cover' : 'contain'} cachePolicy="disk" />
            </View>
          ) : (
            <Text className="font-display" style={{ color: '#FFFFFF', fontSize: w * 0.34 }}>
              {(item.org || item.title).trim().charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      ) : null}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 8, paddingBottom: 8, paddingTop: 28 }}
      >
        <Text className="font-display" style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 16 }} numberOfLines={3}>
          {item.title}
        </Text>
        {item.org ? (
          <Text className="font-sans mt-0.5" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }} numberOfLines={1}>
            {item.org}
          </Text>
        ) : null}
      </LinearGradient>
    </View>
  );
};

const FeaturedCarousel = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  // Three cards across the gutter-to-gutter width.
  const cardW = Math.floor((width - PAD * 2 - GAP * 2) / 3);
  const cardH = Math.round(cardW * 1.45);
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
        const raw = Array.isArray(res.data?.items) ? res.data.items : [];
        // chips/title come straight from the API; one item missing them crashed the row.
        const list: FeaturedItem[] = raw
          .filter((i: FeaturedItem) => i?.id && i.title && META[i.type] && isFeatureOn(META[i.type].feature))
          .map((i: FeaturedItem) => ({ ...i, chips: Array.isArray(i.chips) ? i.chips : [] }));
        if (live) setItems(list);
      })
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, []);

  const count = items?.length ?? 0;
  // Last index whose card can still sit at the left edge with two after it.
  const last = Math.max(0, count - 3);

  // One timeout per state change; cleared on any change, blur, background or unmount.
  useEffect(() => {
    if (last === 0 || touching || !isFocused || !appActive) return;
    const delay = Math.max(ADVANCE_MS, holdUntil - Date.now());
    const t = setTimeout(() => {
      const next = index + 1 > last ? 0 : index + 1;
      listRef.current?.scrollToOffset({ offset: next * step, animated: true });
      setIndex(next);
    }, delay);
    return () => clearTimeout(t);
  }, [index, last, touching, isFocused, appActive, holdUntil, step]);

  const release = () => {
    setTouching(false);
    setHoldUntil(Date.now() + RESUME_MS);
  };

  if (items === null) {
    return (
      <View className="mt-6">
        <Header />
        <View className="flex-row" style={{ gap: GAP }}>
          <Skeleton width={cardW} height={cardH} borderRadius={14} lightMode />
          <Skeleton width={cardW} height={cardH} borderRadius={14} lightMode />
          <Skeleton width={cardW} height={cardH} borderRadius={14} lightMode />
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
          setIndex(Math.min(last, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step))));
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
            accessibilityLabel={[item.title, item.org, item.pay, due?.label, ...item.chips].filter(Boolean).join('. ')}
          >
            <View className="rounded-[14px] border border-line overflow-hidden bg-card">
              <Poster item={item} w={cardW} h={cardH} />
            </View>
            {item.pay ? (
              <Text className="font-display text-ink mt-1.5" style={{ fontSize: 13 }} numberOfLines={1}>
                💰 {item.pay}
              </Text>
            ) : null}
            {due || item.chips[0] ? (
              <View className={`self-start mt-1.5 rounded-full px-2 py-0.5 border ${due?.urgent ? 'bg-brand-50 border-brand-500/30' : 'border-line'}`}>
                <Text className={`font-sans text-[11px] ${due ? 'text-accent-text' : 'text-ink-2'}`} numberOfLines={1}>
                  {due ? `⏳ ${due.label}` : item.chips[0]}
                </Text>
              </View>
            ) : null}
          </Pressable>
          );
        }}
      />
      {last > 0 ? (
        <View className="flex-row justify-center mt-3" style={{ gap: 6 }}>
          {items.slice(0, last + 1).map((i, n) => (
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
