import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/colors';
import { tick } from './motion';

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
  if (style === 'destructive') return { bg: 'bg-danger', text: 'text-paper' };
  if (style === 'cancel') return { bg: 'bg-paper-2', text: 'text-ink' };
  return { bg: 'bg-brand-500', text: 'text-on-brand' };
};

const iconFor = (buttons: AlertButton[]) =>
  buttons.some((b) => b.style === 'destructive')
    ? { name: 'warning-outline' as const, color: C.danger }
    : { name: 'information-circle-outline' as const, color: C.ink };

export const AlertHost = () => {
  const [request, setRequest] = useState<AlertRequest | null>(null);
  const queue = useRef<AlertRequest[]>([]);
  /** An alert is on screen or closing; new ones queue behind it. */
  const shown = useRef(false);
  /** Set on the first tap: a fast double tap used to run the button's handler
   *  twice (two deletes, two payments) and skip the next queued alert. */
  const closing = useRef(false);
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const showNext = useCallback(() => {
    const next = queue.current.shift() ?? null;
    shown.current = !!next;
    closing.current = false;
    setRequest(next);
  }, []);

  useEffect(() => {
    listener = (incoming) => {
      queue.current.push(incoming);
      // Only surface immediately when nothing is already on screen; two alerts
      // fired in the same tick must not replace one another silently.
      if (!shown.current) showNext();
    };
    // Drain anything raised before this mounted.
    if (pending.length > 0) {
      queue.current.push(...pending.splice(0, pending.length));
      if (!shown.current) showNext();
    }
    return () => {
      listener = null;
    };
  }, [showNext]);

  useEffect(() => {
    if (!request) return;
    scale.setValue(0.92);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      // Soft spring, minimal overshoot.
      Animated.spring(scale, { toValue: 1, damping: 16, stiffness: 260, mass: 0.7, useNativeDriver: true }),
    ]).start();
    // A tick so a destructive confirm is felt, not just seen.
    if (request.buttons.some((b) => b.style === 'destructive')) tick();
  }, [request, scale, opacity]);

  const close = useCallback(
    (button?: AlertButton) => {
      if (closing.current) return;
      closing.current = true;
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
    if (closing.current) return;
    closing.current = true;
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
        className="flex-1 items-center justify-center px-gutter"
        style={{ backgroundColor: C.scrim }}
        accessibilityLabel="Dismiss"
      >
        <Animated.View
          style={{ opacity, transform: [{ scale }], width: '100%', maxWidth: 400 }}
        >
          {/* Stops a tap inside the card from reaching the dismiss backdrop. */}
          <Pressable onPress={() => {}} className="bg-card rounded-3xl border border-line overflow-hidden" accessibilityViewIsModal>
            <View className="items-center pt-6 px-6" style={{ gap: 8 }}>
              <View className="w-14 h-14 rounded-full bg-paper-2 items-center justify-center mb-2">
                <Ionicons name={icon.name} size={26} color={icon.color} />
              </View>

              {!!request.title && (
                <Text className="text-ink font-semibold text-center" style={{ fontSize: 16, lineHeight: 22 }} accessibilityRole="header">
                  {request.title}
                </Text>
              )}

              {!!request.message && (
                <ScrollView keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 220 }}
                  showsVerticalScrollIndicator={false}
                  className="w-full"
                >
                  <Text className="text-ink-3 font-sans text-center" style={{ fontSize: 15, lineHeight: 22 }}>
                    {request.message}
                  </Text>
                </ScrollView>
              )}
            </View>

            <View className={`p-5 pt-6 ${stacked ? '' : 'flex-row'}`} style={{ gap: 8 }}>
              {request.buttons.map((button, index) => {
                const s = styleFor(button.style);
                return (
                  <Pressable
                    key={`${button.text ?? 'button'}-${index}`}
                    onPress={() => close(button)}
                    className={`${s.bg} rounded-full items-center justify-center px-4 active:opacity-85 ${stacked ? '' : 'flex-1'}`}
                    style={{ minHeight: 48 }}
                    accessibilityRole="button"
                  >
                    <Text className={`${s.text} font-semibold`} style={{ fontSize: 15 }} numberOfLines={1}>
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
