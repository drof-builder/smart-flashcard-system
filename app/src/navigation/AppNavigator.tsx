import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { AuthStackParamList, MainStackParamList } from '../types';

import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import DeckListScreen from '../screens/DeckListScreen';
import DeckDetailScreen from '../screens/DeckDetailScreen';
import StudyModePickerScreen from '../screens/StudyModePickerScreen';
import FlipCardScreen from '../screens/FlipCardScreen';
import MultipleChoiceScreen from '../screens/MultipleChoiceScreen';
import TypeAnswerScreen from '../screens/TypeAnswerScreen';
import SessionSummaryScreen from '../screens/SessionSummaryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PracticeModePickerScreen from '../screens/PracticeModePickerScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerTintColor: '#6366f1' }}>
      <MainStack.Screen name="DeckList" component={DeckListScreen} options={{ title: 'My Decks' }} />
      <MainStack.Screen name="DeckDetail" component={DeckDetailScreen} />
      <MainStack.Screen name="StudyModePicker" component={StudyModePickerScreen} options={{ title: 'Study Mode' }} />
      <MainStack.Screen name="PracticeModePicker" component={PracticeModePickerScreen} options={{ title: 'Practice Mode' }} />
      <MainStack.Screen name="FlipCards" component={FlipCardScreen} options={{ title: 'Flip Cards' }} />
      <MainStack.Screen name="MultipleChoice" component={MultipleChoiceScreen} options={{ title: 'Multiple Choice' }} />
      <MainStack.Screen name="TypeAnswer" component={TypeAnswerScreen} options={{ title: 'Type Answer' }} />
      <MainStack.Screen name="SessionSummary" component={SessionSummaryScreen} options={{ title: 'Session Complete', headerLeft: () => null }} />
      <MainStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </MainStack.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
