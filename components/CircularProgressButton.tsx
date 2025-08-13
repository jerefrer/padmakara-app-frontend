import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

const colors = {
  burgundy: {
    500: '#b91c1c',
    600: '#991b1b',
  },
  saffron: {
    500: '#f59e0b',
  },
  gray: {
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
  },
};

interface CircularProgressButtonProps {
  progress: number; // 0-100
  isActive: boolean;
  onPress: () => void;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  icon?: string;
  style?: any;
}

export function CircularProgressButton({
  progress,
  isActive,
  onPress,
  size = 32,
  strokeWidth = 3,
  showPercentage = false,
  icon = 'download-outline',
  style
}: CircularProgressButtonProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <TouchableOpacity onPress={onPress} style={[styles.container, style]}>
      <View style={[styles.buttonContainer, { width: size, height: size }]}>
        {isActive ? (
          // Show progress ring when downloading
          <View style={styles.progressContainer}>
            <Svg width={size} height={size} style={styles.progressSvg}>
              {/* Background circle */}
              <Circle
                stroke={colors.gray[400]}
                fill="none"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={strokeWidth}
                opacity={0.3}
              />
              {/* Progress circle */}
              <Circle
                stroke={colors.saffron[500]}
                fill="none"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            </Svg>
            <View style={styles.centerContent}>
              {showPercentage ? (
                <Text style={[styles.percentageText, { fontSize: size * 0.25 }]}>
                  {Math.round(progress)}%
                </Text>
              ) : (
                <Ionicons 
                  name="close" 
                  size={size * 0.4} 
                  color={colors.gray[600]} 
                />
              )}
            </View>
          </View>
        ) : (
          // Show download icon when not active
          <Ionicons 
            name={icon as any} 
            size={size * 0.5} 
            color={colors.gray[600]} 
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  percentageText: {
    fontWeight: 'bold',
    color: colors.gray[600],
  },
});