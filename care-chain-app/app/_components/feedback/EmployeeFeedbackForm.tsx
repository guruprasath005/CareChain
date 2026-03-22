// app/components/feedback/EmployeeFeedbackForm.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StepProgress from './StepProgress';
import { doctorApi } from '@/services/api';

interface EmployeeFeedbackFormProps {
    isVisible: boolean;
    onClose: () => void;
    onSubmitSuccess: () => void;
    assignmentId: string;
    hospitalName: string;
    jobTitle: string;
}

const EmployeeFeedbackForm: React.FC<EmployeeFeedbackFormProps> = ({
    isVisible,
    onClose,
    onSubmitSuccess,
    assignmentId,
    hospitalName,
    jobTitle
}) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        communication: 0,
        safety: 0,
        ethics: 0,
        collaboration: 0,
        testimonial: '',
        platformRating: 0,
        platformFeedback: '',
    });

    const totalSteps = 6;

    const handleRating = (field: keyof typeof formData, rating: number) => {
        setFormData(prev => ({ ...prev, [field]: rating }));
    };

    const nextStep = () => {
        if (currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const submitFeedback = async () => {
        setIsLoading(true);
        try {
            const overallRating = (formData.communication + formData.safety + formData.ethics + formData.collaboration) / 4;
            const response = await doctorApi.submitFeedback(assignmentId, {
                rating: overallRating,
                testimonial: formData.testimonial,
                comment: formData.testimonial,
                detailedRatings: {
                    communication: formData.communication,
                    safety: formData.safety,
                    ethics: formData.ethics,
                    collaboration: formData.collaboration,
                    platformRating: formData.platformRating,
                    platformFeedback: formData.platformFeedback,
                }
            });

            if (response.success) {
                setIsSubmitted(true);
            }
        } catch (error) {
            console.error('Failed to submit feedback:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isSubmitted) {
        return (
            <Modal visible={isVisible} animationType="fade" transparent={true}>
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-white rounded-t-3xl p-6 h-[85%] items-center">
                        <View className="w-16 h-1 w-12 bg-gray-200 rounded-full mb-8" />

                        <View className="w-24 h-24 rounded-full bg-green-50 items-center justify-center mb-6">
                            <View className="w-18 h-18 rounded-full bg-green-400 items-center justify-center">
                                <Ionicons name="checkmark" size={48} color="white" />
                            </View>
                        </View>

                        <Text className="text-2xl font-bold text-slate-800 text-center mb-2">Thank You For Your Feedback</Text>
                        <Text className="text-gray-400 text-center px-6 mb-10 text-sm">Your feedback has been successfully submitted and will help us improve CareChain.</Text>

                        <View className="w-full space-y-4 mb-10">
                            <View className="bg-blue-50/20 border border-blue-100/30 p-4 rounded-2xl">
                                <View className="flex-row items-center mb-2">
                                    <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center">
                                        <Ionicons name="information" size={20} color="#3B82F6" />
                                    </View>
                                    <View className="ml-3 flex-1">
                                        <Text className="font-bold text-slate-800">Making CareChain Better</Text>
                                        <Text className="text-gray-400 text-xs mt-1 leading-4">Your feedback helps us improve CareChain and create better experiences for healthcare professionals. Every insight you share contributes to a more effective platform for the healthcare community.</Text>
                                    </View>
                                </View>
                            </View>

                            <View className="bg-gray-50/50 border border-gray-100 p-3 rounded-2xl flex-row items-center">
                                <View className="w-6 h-6 rounded-full bg-green-100 items-center justify-center mr-3">
                                    <View className="w-4 h-4 rounded-full border-2 border-green-500 items-center justify-center">
                                        <View className="w-2 h-2 rounded-full bg-green-500" />
                                    </View>
                                </View>
                                <Text className="text-gray-400 text-[13px] font-medium">Feedback Submission Complete</Text>
                            </View>

                            <View className="bg-green-50/30 border border-green-100 p-4 rounded-2xl">
                                <View className="flex-row items-center mb-1">
                                    <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center">
                                        <Ionicons name="heart" size={20} color="#10B981" />
                                    </View>
                                    <View className="ml-3 flex-1">
                                        <Text className="font-bold text-green-700">We Truly Value Your Time</Text>
                                        <Text className="text-green-700/80 text-xs mt-1">Your insights help us serve the healthcare community better.</Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        <View className="w-full mt-auto space-y-3">
                            <TouchableOpacity
                                onPress={() => {
                                    setIsSubmitted(false);
                                    onClose();
                                    onSubmitSuccess();
                                }}
                                className="w-full bg-indigo-950 py-4 rounded-xl items-center"
                            >
                                <Text className="text-white font-bold text-lg">Done</Text>
                            </TouchableOpacity>
                            <Text className="text-center text-gray-400 text-[10px] mt-4">Thank You for helping us improve CareChain</Text>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <View className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <Text className="text-[17px] font-bold text-slate-800 leading-tight mb-2">How did the employer communicate and behave?</Text>
                        <Text className="text-gray-400 text-sm leading-5 mb-4 px-1">
                            Please indicate how clearly and professionally the employer communicated with you throughout the job.
                        </Text>

                        <View className="space-y-3">
                            {[
                                { val: 1, label: "Rarely provided clear communication or guidance" },
                                { val: 2, label: "Provided instructions but often unclear or delayed" },
                                { val: 3, label: "Usually gave clear communication with occasional gaps" },
                                { val: 4, label: "Consistently communicated clearly and respectfully" },
                                { val: 5, label: "Always proactive, clear, and respectful in all communication" }
                            ].map((option) => (
                                <TouchableOpacity
                                    key={option.val}
                                    onPress={() => handleRating('communication', option.val)}
                                    className={`flex-row items-center p-3 rounded-xl border ${formData.communication === option.val ? 'bg-indigo-50/30 border-indigo-900' : 'bg-white border-gray-100'}`}
                                >
                                    <View className={`w-5 h-5 rounded-full border items-center justify-center ${formData.communication === option.val ? 'border-indigo-900' : 'border-gray-300'}`}>
                                        {formData.communication === option.val && <View className="w-2.5 h-2.5 rounded-full bg-indigo-900" />}
                                    </View>
                                    <Text className={`ml-3 text-[13px] flex-1 ${formData.communication === option.val ? 'text-indigo-900 font-medium' : 'text-gray-600'}`}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            case 2:
                return (
                    <View className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <Text className="text-[17px] font-bold text-slate-800 leading-tight mb-2">How safe and supportive was the workplace?</Text>
                        <Text className="text-gray-400 text-sm leading-5 mb-4 px-1">
                            Please rate the level of safety and support you experienced at the workplace.
                        </Text>

                        <View className="space-y-3">
                            {[
                                { val: 1, label: "Unsafe or unsupportive environment" },
                                { val: 2, label: "Basic facilities available, limited support" },
                                { val: 3, label: "Adequate facilities and generally supportive" },
                                { val: 4, label: "Safe environment with reliable support systems" },
                                { val: 5, label: "Very safe environment with strong support and resources" }
                            ].map((option) => (
                                <TouchableOpacity
                                    key={option.val}
                                    onPress={() => handleRating('safety', option.val)}
                                    className={`flex-row items-center p-3 rounded-xl border ${formData.safety === option.val ? 'bg-indigo-50/30 border-indigo-900' : 'bg-white border-gray-100'}`}
                                >
                                    <View className={`w-5 h-5 rounded-full border items-center justify-center ${formData.safety === option.val ? 'border-indigo-900' : 'border-gray-300'}`}>
                                        {formData.safety === option.val && <View className="w-2.5 h-2.5 rounded-full bg-indigo-900" />}
                                    </View>
                                    <Text className={`ml-3 text-[13px] flex-1 ${formData.safety === option.val ? 'text-indigo-900 font-medium' : 'text-gray-600'}`}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            case 3:
                return (
                    <View className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <Text className="text-[17px] font-bold text-slate-800 leading-tight mb-2">How fair were the pay, policies, and ethics?</Text>
                        <Text className="text-gray-400 text-sm leading-5 mb-4 px-1">
                            Please indicate how fairly and transparently you were treated during this job.
                        </Text>

                        <View className="space-y-3">
                            {[
                                { val: 1, label: "Payment/policies often unfair or not transparent" },
                                { val: 2, label: "Payment/policies sometimes inconsistent" },
                                { val: 3, label: "Payment/policies usually fair with minor gaps" },
                                { val: 4, label: "Transparent and fair in most aspects" },
                                { val: 5, label: "Completely fair, transparent, and ethical in all dealings" }
                            ].map((option) => (
                                <TouchableOpacity
                                    key={option.val}
                                    onPress={() => handleRating('ethics', option.val)}
                                    className={`flex-row items-center p-3 rounded-xl border ${formData.ethics === option.val ? 'bg-indigo-50/30 border-indigo-900' : 'bg-white border-gray-100'}`}
                                >
                                    <View className={`w-5 h-5 rounded-full border items-center justify-center ${formData.ethics === option.val ? 'border-indigo-900' : 'border-gray-300'}`}>
                                        {formData.ethics === option.val && <View className="w-2.5 h-2.5 rounded-full bg-indigo-900" />}
                                    </View>
                                    <Text className={`ml-3 text-[13px] flex-1 ${formData.ethics === option.val ? 'text-indigo-900 font-medium' : 'text-gray-600'}`}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            case 4:
                return (
                    <View className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <Text className="text-[17px] font-bold text-slate-800 leading-tight mb-2">How was collaboration with colleagues and staff?</Text>
                        <Text className="text-gray-400 text-sm leading-5 mb-4 px-1">
                            Please indicate how cooperative and supportive the team was while you worked.
                        </Text>

                        <View className="space-y-3">
                            {[
                                { val: 1, label: "Team was uncooperative, difficult to work with" },
                                { val: 2, label: "Some cooperation, but frequent issues" },
                                { val: 3, label: "Generally cooperative, occasional difficulties" },
                                { val: 4, label: "Mostly collaborative and supportive" },
                                { val: 5, label: "Fully collaborative, highly supportive team" }
                            ].map((option) => (
                                <TouchableOpacity
                                    key={option.val}
                                    onPress={() => handleRating('collaboration', option.val)}
                                    className={`flex-row items-center p-3 rounded-xl border ${formData.collaboration === option.val ? 'bg-indigo-50/30 border-indigo-900' : 'bg-white border-gray-100'}`}
                                >
                                    <View className={`w-5 h-5 rounded-full border items-center justify-center ${formData.collaboration === option.val ? 'border-indigo-900' : 'border-gray-300'}`}>
                                        {formData.collaboration === option.val && <View className="w-2.5 h-2.5 rounded-full bg-indigo-900" />}
                                    </View>
                                    <Text className={`ml-3 text-[13px] flex-1 ${formData.collaboration === option.val ? 'text-indigo-900 font-medium' : 'text-gray-600'}`}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            case 5:
                return (
                    <View>
                        <View className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-6">
                            <Text className="text-lg font-bold text-gray-900 mb-1">Your Testimonial</Text>
                            <Text className="text-gray-500 mb-4 text-sm">Tell us about your experience with this Hospital.</Text>

                            <View className="border border-gray-100 rounded-xl p-3 min-h-[150px]">
                                <TextInput
                                    multiline
                                    numberOfLines={6}
                                    value={formData.testimonial}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, testimonial: text.slice(0, 300) }))}
                                    placeholder="Enter Your Testimonial"
                                    className="text-gray-900 text-sm"
                                    textAlignVertical="top"
                                />
                                <Text className="absolute bottom-2 right-2 text-[10px] text-gray-300">{formData.testimonial.length}/300</Text>
                            </View>
                            <View className="flex-row items-center mt-2 px-1">
                                <Ionicons name="bulb-outline" size={14} color="#9CA3AF" />
                                <Text className="ml-2 text-[10px] text-gray-400">This may be visible on the candidate's profile</Text>
                            </View>
                        </View>

                        <View className="bg-blue-50/20 rounded-2xl p-4 border border-blue-100/30">
                            <View className="flex-row items-center mb-3">
                                <Ionicons name="bulb" size={20} color="#1E3A8A" />
                                <Text className="ml-2 font-bold text-indigo-900">Helpful Tips</Text>
                            </View>
                            <View className="space-y-2 px-1">
                                <Text className="text-indigo-800/80 text-[13px]">• Share specific examples of positive experiences</Text>
                                <Text className="text-indigo-800/80 text-[13px]">• Mention aspects that stood out about the workplace culture</Text>
                                <Text className="text-indigo-800/80 text-[13px]">• Include details about professional growth opportunities</Text>
                                <Text className="text-indigo-800/80 text-[13px]">• Keep it honest and constructive</Text>
                            </View>
                        </View>
                    </View>
                );
            case 6:
                return (
                    <View>
                        <View className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-6">
                            <Text className="text-[17px] font-bold text-slate-800 mb-6">How was your experience with CareChain? (1–5)</Text>

                            <View className="flex-row justify-between mb-2">
                                {[1, 2, 3, 4, 5].map((val) => (
                                    <TouchableOpacity
                                        key={val}
                                        onPress={() => handleRating('platformRating', val)}
                                        className={`w-[58px] h-[58px] rounded-xl border items-center justify-center ${formData.platformRating === val ? 'bg-indigo-50/30 border-indigo-950' : 'bg-white border-gray-100'}`}
                                    >
                                        <Text className={`text-lg font-bold ${formData.platformRating === val ? 'text-indigo-950' : 'text-gray-400'}`}>{val}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View className="flex-row justify-between px-1 mb-8">
                                <Text className="text-[10px] text-gray-400">Poor</Text>
                                <Text className="text-[10px] text-gray-400">Excellent</Text>
                            </View>

                            <Text className="text-[13px] font-medium text-slate-600 mb-2">What did you like, and what can we do better? <Text className="text-gray-300">(Optional)</Text></Text>
                            <View className="border border-gray-100 rounded-xl p-3 min-h-[150px]">
                                <TextInput
                                    multiline
                                    numberOfLines={6}
                                    value={formData.platformFeedback}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, platformFeedback: text.slice(0, 300) }))}
                                    placeholder="Write your feedback"
                                    className="text-gray-900 text-sm"
                                    textAlignVertical="top"
                                />
                                <Text className="absolute bottom-2 right-2 text-[10px] text-gray-300">{formData.platformFeedback.length}/300</Text>
                            </View>
                        </View>

                        <View className="bg-blue-50/20 rounded-2xl p-4 border border-blue-100/30">
                            <View className="flex-row items-center mb-2">
                                <Ionicons name="heart-outline" size={24} color="#1E3A8A" />
                                <Text className="ml-3 font-bold text-indigo-900 text-[15px]">Thank you for your time!</Text>
                            </View>
                            <Text className="text-indigo-800/80 text-[13px] leading-5 px-9">
                                Your feedback helps us improve CareChain and create better experiences for healthcare professionals like you.
                            </Text>
                        </View>
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <Modal visible={isVisible} animationType="slide" transparent={true}>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-white rounded-t-3xl p-6 h-[85%]">
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-2">
                        <View>
                            <Text className="text-xl font-bold text-gray-900">
                                {currentStep <= 5 ? "Candidate Feedback Form" : "Your Platform Experience"}
                            </Text>
                            <Text className="text-gray-400 text-sm">
                                {currentStep <= 5 ? "Help us improve by sharing your experience with this hospital." : "Help us improve by sharing your experience with the platform."}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <Ionicons name="close" size={28} color="#111827" />
                        </TouchableOpacity>
                    </View>

                    <StepProgress currentStep={currentStep} totalSteps={totalSteps} />

                    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                        {renderStep()}
                    </ScrollView>

                    {/* Footer Controls */}
                    <View className="flex-row pt-6 pb-2 border-t border-gray-100" style={{ gap: 16 }}>
                        {currentStep > 1 ? (
                            <TouchableOpacity
                                onPress={prevStep}
                                className="flex-1 bg-white border border-gray-200 py-4 rounded-xl items-center justify-center"
                            >
                                <Text className="text-gray-900 font-bold text-lg">Previous</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={onClose}
                                className="flex-1 bg-white border border-gray-200 py-4 rounded-xl items-center justify-center"
                            >
                                <Text className="text-gray-900 font-bold text-lg">Cancel</Text>
                            </TouchableOpacity>
                        )}

                        {currentStep < totalSteps ? (
                            <TouchableOpacity
                                onPress={nextStep}
                                className="flex-1 bg-indigo-950 py-4 rounded-xl items-center justify-center"
                            >
                                <Text className="text-white font-bold text-lg">Next</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={submitFeedback}
                                disabled={isLoading || formData.communication === 0 || formData.safety === 0 || formData.ethics === 0 || formData.collaboration === 0 || formData.platformRating === 0}
                                className={`flex-1 py-4 rounded-xl items-center justify-center ${(isLoading || formData.communication === 0 || formData.safety === 0 || formData.ethics === 0 || formData.collaboration === 0 || formData.platformRating === 0) ? 'bg-indigo-300' : 'bg-indigo-950'}`}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-bold text-lg">Submit</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default EmployeeFeedbackForm;
