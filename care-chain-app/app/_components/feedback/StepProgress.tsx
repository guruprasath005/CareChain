// app/components/feedback/StepProgress.tsx
import React from 'react';
import { View, Text } from 'react-native';

interface StepProgressProps {
    currentStep: number;
    totalSteps: number;
}

const StepProgress: React.FC<StepProgressProps> = ({ currentStep, totalSteps }) => {
    return (
        <View className="flex-row items-center justify-between mb-6 px-1">
            {Array.from({ length: totalSteps }).map((_, index) => (
                <React.Fragment key={index}>
                    <View
                        className={`h-1.5 flex-1 rounded-full ${index < currentStep ? 'bg-indigo-900' : 'bg-gray-200'
                            }`}
                    />
                    {index < totalSteps - 1 && <View className="w-2" />}
                </React.Fragment>
            ))}
            <Text className="ml-4 text-xs font-bold text-indigo-900">
                {currentStep}/{totalSteps}
            </Text>
        </View>
    );
};

export default StepProgress;
