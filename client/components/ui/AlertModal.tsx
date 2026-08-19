import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

/**
 * In-app replacement for React Native's `Alert`.
 *
 * The app had 432 `Alert.alert` calls, which render the raw OS dialog: grey on
 * Android, blue-tinted on iOS, no relation to anything else on screen. This
 * keeps the exact same call signature so every one of those sites is a one-line
 * import swap rather than a rewrite, but paints our own modal.
 *
 * `Alert.alert(title, message?, buttons?, options?)` behaves as documented:
 *   - no buttons        -> a single "OK"
 *   - style 'cancel'    -> muted, and used for the dismiss action
 *   - style 'destructive' -> red
 *   - options.cancelable === false -> backdrop and hardware back do nothing
 */

export type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

type AlertRequest = {
  title?: string;
  message?: string;
  buttons: AlertButton[];
  options: AlertOptions;
};

// ── Module-level bridge ─────────────────────────────────────────────────────
// `Alert.alert` is called from plain functions, event handlers and catch blocks
// all over the app, most of which are not React components and cannot use a
// hook. A single subscriber set keeps the API callable from anywhere.

type Listener = (request: AlertRequest) => void;
let listener: Listener | null = null;
const pending: AlertRequest[] = [];

const emit = (request: AlertRequest) => {
  if (listener) listener(request);
  // Fired before the host mounted (an error during startup, say). Hold it.
  else pending.push(request);
};

const DEFAULT_BUTTONS: AlertButton[] = [{ text: 'OK', style: 'default' }];

export const Alert = {
  alert(
    title?: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) {
    emit({
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : DEFAULT_BUTTONS,
      options: options || {},
    });
  },
};

// ── Host ────────────────────────────────────────────────────────────────────

const styleFor = (style: AlertButton['style']) => {
  if (style === 'destructive') {
    return { bg: 'bg-red-500', text: 'text-white', border: 'border-red-500' };
  }
  if (style === 'cancel') {
    return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
  }
  return { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500' };
};

const iconFor = (buttons: AlertButton[]) => {
  if (buttons.some((b) => b.style === 'destructive')) {
    return { name: 'warning' as const, color: '#ef4444', bg: 'bg-red-50', border: 'border-red-100' };
  }
  return { name: 'information-circle' as const, color: '#f97316', bg: 'bg-orange-50', border: 'border-orange-100' };
};

export const AlertHost = () => {
  const [request, setRequest] = useState<AlertRequest | null>(null);
  const queue = useRef<AlertRequest[]>([]);
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const showNext = useCallback(() => {
    const next = queue.current.shift();
    setRequest(next ?? null);
  }, []);

  useEffect(() => {
    listener = (incoming) => {
      queue.current.push(incoming);
      // Only surface immediately when nothing is already on screen; two alerts
      // fired in the same tick must not replace one another silently.
      setRequest((current) => (current ? current : (queue.current.shift() ?? null)));
    };
    // Drain anything raised before this mounted.
    if (pending.length > 0) {
      queue.current.push(...pending.splice(0, pending.length));
      setRequest(queue.current.shift() ?? null);
    }
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!request) return;
    scale.setValue(0.92);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [request, scale, opacity]);

  const close = useCallback(
    (button?: AlertButton) => {
      setRequest(null);
      // Run the handler after the modal is gone, so a handler that opens
      // another alert (a common pattern here) is not swallowed by the close.
      requestAnimationFrame(() => {
        button?.onPress?.();
        showNext();
      });
    },
    [showNext]
  );

  const dismiss = useCallback(() => {
    if (!request) return;
    if (request.options.cancelable === false) return;
    const cancelButton = request.buttons.find((b) => b.style === 'cancel');
    setRequest(null);
    requestAnimationFrame(() => {
      cancelButton?.onPress?.();
      request.options.onDismiss?.();
      showNext();
    });
  }, [request, showNext]);

  if (!request) return null;

  const icon = iconFor(request.buttons);
  // Two buttons sit side by side; three or more stack, matching the OS dialog.
  const stacked = request.buttons.length > 2;

  return (
    <Modal transparent visible animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable
        onPress={dismiss}
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}
      >
        <Animated.View
          style={{ opacity, transform: [{ scale }], width: '100%', maxWidth: 400 }}
        >
          {/* Stops a tap inside the card from reaching the dismiss backdrop. */}
          <Pressable onPress={() => {}} className="bg-white rounded-3xl overflow-hidden">
            <View className="items-center pt-7 px-6">
              <View
                className={`w-14 h-14 rounded-2xl items-center justify-center border mb-4 ${icon.bg} ${icon.border}`}
              >
                <Ionicons name={icon.name} size={28} color={icon.color} />
              </View>

              {!!request.title && (
                <Text className="text-slate-900 text-base font-black uppercase tracking-tight text-center">
                  {request.title}
                </Text>
              )}

              {!!request.message && (
                <ScrollView
                  style={{ maxHeight: 220 }}
                  showsVerticalScrollIndicator={false}
                  className="mt-2 w-full"
                >
                  <Text className="text-slate-500 text-sm font-semibold leading-5 text-center">
                    {request.message}
                  </Text>
                </ScrollView>
              )}
            </View>

            <View className={`p-5 pt-6 ${stacked ? '' : 'flex-row'}`} style={{ gap: 10 }}>
              {request.buttons.map((button, index) => {
                const s = styleFor(button.style);
                return (
                  <Pressable
                    key={`${button.text ?? 'button'}-${index}`}
                    onPress={() => close(button)}
                    className={`${s.bg} border ${s.border} rounded-2xl py-3.5 items-center justify-center active:opacity-70 ${stacked ? '' : 'flex-1'}`}
                    accessibilityRole="button"
                  >
                    <Text className={`${s.text} text-xs font-black uppercase tracking-wide`}>
                      {button.text ?? 'OK'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

export default Alert;
