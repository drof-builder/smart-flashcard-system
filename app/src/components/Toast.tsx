import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';

type Props = { message: string | null; onHide: () => void };

export default function Toast({ message, onHide }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onHide());
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 80,
    left: 24,
    right: 24,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 16,
    zIndex: 999,
  },
  text: { color: '#fff', textAlign: 'center', fontSize: 14 },
});
