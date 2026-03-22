import React from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useEffect, useRef } from 'react';

interface SkeletonLoaderProps {
  variant?: 'card' | 'list' | 'text';
  count?: number;
}

/**
 * Skeleton loader component for displaying loading placeholders
 * Provides a shimmer effect while content is loading
 */
export function SkeletonLoader({ variant = 'card', count = 3 }: SkeletonLoaderProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  if (variant === 'card') {
    return (
      <>
        {Array.from({ length: count }).map((_, index) => (
          <View key={index} className="bg-white rounded-2xl p-4 mb-3 border border-gray-200">
            <View className="flex-row items-start mb-3">
              <Animated.View
                style={[{ opacity }, styles.avatar]}
                className="w-12 h-12 rounded-full bg-gray-200"
              />
              <View className="ml-3 flex-1">
                <Animated.View
                  style={[{ opacity }, styles.line]}
                  className="h-4 bg-gray-200 rounded mb-2"
                />
                <Animated.View
                  style={[{ opacity }, styles.line]}
                  className="h-3 bg-gray-200 rounded w-2/3"
                />
              </View>
            </View>
            <Animated.View
              style={[{ opacity }, styles.line]}
              className="h-3 bg-gray-200 rounded mb-2"
            />
            <Animated.View
              style={[{ opacity }, styles.line]}
              className="h-3 bg-gray-200 rounded w-3/4 mb-3"
            />
            <View className="flex-row gap-2">
              <Animated.View
                style={[{ opacity }, styles.button]}
                className="flex-1 h-10 bg-gray-200 rounded-xl"
              />
              <Animated.View
                style={[{ opacity }, styles.button]}
                className="flex-1 h-10 bg-gray-200 rounded-xl"
              />
            </View>
          </View>
        ))}
      </>
    );
  }

  if (variant === 'list') {
    return (
      <>
        {Array.from({ length: count }).map((_, index) => (
          <View key={index} className="bg-white rounded-xl p-4 mb-2 border border-gray-200">
            <View className="flex-row items-center">
              <Animated.View
                style={[{ opacity }, styles.avatar]}
                className="w-10 h-10 rounded-full bg-gray-200"
              />
              <View className="ml-3 flex-1">
                <Animated.View
                  style={[{ opacity }, styles.line]}
                  className="h-4 bg-gray-200 rounded mb-2"
                />
                <Animated.View
                  style={[{ opacity }, styles.line]}
                  className="h-3 bg-gray-200 rounded w-1/2"
                />
              </View>
            </View>
          </View>
        ))}
      </>
    );
  }

  // text variant
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Animated.View
          key={index}
          style={[{ opacity }, styles.line]}
          className="h-4 bg-gray-200 rounded mb-2"
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {},
  line: {},
  button: {},
});
