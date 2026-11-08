import React from 'react';
import { View, StatusBar, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../constants/colors';
import { AppBar, Card, Divider, ListRow } from '../ui/kit';

const MODES = [
    { title: 'Create room', subtitle: 'Host a match', icon: 'add-circle-outline', route: 'CreateRoom' },
    { title: 'Join room', subtitle: 'Enter a room code', icon: 'key-outline', route: 'JoinRoomInput' },
    { title: '1v1 battle', subtitle: 'Find an opponent', icon: 'flash-outline', route: 'OneVsOneSetup' },
    { title: 'AI interview', subtitle: 'Practice mode', icon: 'mic-outline', route: 'InterviewSetup' },
] as const;

const ROW = { paddingHorizontal: 16, paddingVertical: 12 };

const QuizHome = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <SafeAreaView className="flex-1" edges={['bottom']}>
                <AppBar title="Quiz Arena" onBack={() => navigation.goBack()} />
                <ScrollView keyboardShouldPersistTaps="handled" className="flex-1 px-gutter" contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                    <Card>
                        {MODES.map((m, i) => (
                            <React.Fragment key={m.route}>
                                {i > 0 ? <Divider style={{ marginLeft: 72 }} /> : null}
                                <ListRow
                                    icon={m.icon}
                                    title={m.title}
                                    subtitle={m.subtitle}
                                    onPress={() => navigation.navigate(m.route as any)}
                                    style={ROW}
                                />
                            </React.Fragment>
                        ))}
                    </Card>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

export default QuizHome;
