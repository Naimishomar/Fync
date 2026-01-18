declare module 'react-native-jitsi-meet' {
  interface JitsiUserInfo {
    displayName?: string;
    email?: string;
    avatar?: string;
  }

  interface MeetOptions {
    videoMuted?: boolean;
    audioMuted?: boolean;
  }

  export function call(
    url: string,
    userInfo?: JitsiUserInfo,
    meetOptions?: MeetOptions
  ): void;

  export function endCall(): void;

  export const JitsiMeetEvents: {
    addListener: (
      event: string,
      callback: (...args: any[]) => void
    ) => { remove: () => void };
  };
}
