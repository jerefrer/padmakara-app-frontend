import React from 'react';
import { View, Text } from 'react-native';
import { cn } from '@/utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <View className={cn('bg-white rounded-2xl p-6 shadow-sm', className)}>
      {children}
    </View>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function CardHeader({ title, subtitle, className }: CardHeaderProps) {
  return (
    <View className={cn('mb-4', className)}>
      <Text className="text-xl font-semibold text-burgundy-500 mb-1">
        {title}
      </Text>
      {subtitle && (
        <Text className="text-base text-gray-600">
          {subtitle}
        </Text>
      )}
    </View>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <View className={cn('', className)}>
      {children}
    </View>
  );
}