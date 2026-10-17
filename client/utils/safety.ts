import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { Alert } from '../components/ui/AlertModal';

/** Report and block, shared by every surface that offers them (/safety routes). */

export const REPORT_REASONS = ['Harassment or bullying', 'Sexual content', 'Hate or violence', 'Spam or scam', 'Something else'];

/** The reason pick-list. Calls onPick with the chosen reason; Cancel does nothing. */
export const pickReportReason = (onPick: (reason: string) => void, title = 'Report') =>
  Alert.alert(title, 'Why are you reporting this?', [
    ...REPORT_REASONS.map((r) => ({ text: r, onPress: () => onPick(r) })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);

export const reportError = (e: any) =>
  e?.response?.status === 429 ? 'Too many reports. Try again later.' : e?.response?.data?.message || "Couldn't send report";

export type ReportBody = {
  targetType: 'night_message' | 'night_user' | 'confession' | 'confession_comment' | 'user' | 'chat_message';
  targetId?: string; targetUserId?: string; snapshot?: string;
};

/** Pick a reason, POST it, toast the result; onDone runs only on success. */
export const report = (body: ReportBody, onDone?: () => void, title?: string) =>
  pickReportReason(async (reason) => {
    try {
      await axios.post('/safety/report', { ...body, reason });
      Toast.show({ type: 'success', text1: 'Reported', text2: "Thanks. We'll review it." });
      onDone?.();
    } catch (e) {
      Toast.show({ type: 'error', text1: reportError(e) });
    }
  }, title);

/** Confirm, then block. onDone runs only on success. */
export const confirmBlock = (userId: string, name: string | undefined, onDone?: () => void) =>
  Alert.alert(`Block ${name || 'this user'}?`, "They won't be able to message you, and you won't see each other.", [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Block', style: 'destructive', onPress: async () => {
        try {
          await axios.post('/safety/block', { userId });
          Toast.show({ type: 'success', text1: 'User blocked' });
          onDone?.();
        } catch (e: any) {
          Toast.show({ type: 'error', text1: e?.response?.data?.message || "Couldn't block user" });
        }
      },
    },
  ]);
