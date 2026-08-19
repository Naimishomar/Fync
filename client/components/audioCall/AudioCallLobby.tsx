import React from 'react';
import CallLobby from '../call/CallLobby';
import ActiveAudioCall from './ActiveAudioCall';

export default function AudioCallLobby({ navigation }: any) {
  return (
    <CallLobby
      mode="audio"
      navigation={navigation}
      renderActiveCall={(props) => <ActiveAudioCall {...props} />}
    />
  );
}
