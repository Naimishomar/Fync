import React from 'react';
import CallLobby from '../call/CallLobby';
import ActiveVideoCall from './ActiveVideoCall';

export default function VideoCallLobby({ navigation }: any) {
  return (
    <CallLobby
      mode="video"
      navigation={navigation}
      renderActiveCall={(props) => <ActiveVideoCall {...props} />}
    />
  );
}
