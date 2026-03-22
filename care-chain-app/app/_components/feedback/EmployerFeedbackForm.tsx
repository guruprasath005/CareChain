// app/components/feedback/EmployerFeedbackForm.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StepProgress from './StepProgress';
import { hospitalApi } from '@/services/api';

interface EmployerFeedbackFormProps {
    isVisible: boolean;
    onClose: () => void;
    onSubmitSuccess: () => void;
    assignmentId: string;
    doctorName: string;
    doctorRole: string;
    completionType: 'completed' | 'terminated';
    onPressProfile?: () => void;
}

const EmployerFeedbackForm: React.FC<EmployerFeedbackFormProps> = ({
    isVisible,
    onClose,
    onSubmitSuccess,
    assignmentId,
    doctorName,
    doctorRole,
    completionType,
    onPressProfile
}) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        attendanceCheck: null as boolean | null,
        attendanceDetails: '',
        performance: 0,
        ethics: 0,
        teamwork: 0,
        comment: '',
        testimonial: '',
        platformRating: 0,
        platformFeedback: '',
    });
    const [isSubmitted, setIsSubmitted] = useState(false);

    const totalSteps = 7;

    const handleRating = (field: 'performance' | 'ethics' | 'teamwork', rating: number) => {
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
            const overallRating = (formData.performance + formData.ethics + formData.teamwork) / 3;
            const response = await hospitalApi.submitFeedback(assignmentId, {
                rating: overallRating,
                comment: formData.comment,
                testimonial: formData.testimonial,
                detailedRatings: {
                    attendanceCheck: formData.attendanceCheck,
                    attendanceDetails: formData.attendanceDetails,
                    performance: formData.performance,
                    ethics: formData.ethics,
                    teamwork: formData.teamwork,
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

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <View>
                        <Text className="text-lg font-bold text-gray-900 mb-2">Attendance Check</Text>
                        <Text className="text-gray-600 mb-6">Did the doctor maintain consistent attendance throughout the assignment?</Text>

                        <TouchableOpacity
                            onPress={() => setFormData(prev => ({ ...prev, attendanceCheck: true }))}
                            className={`flex-row items-center p-4 mb-3 rounded-xl border-2 ${formData.attendanceCheck === true ? 'border-indigo-900 bg-indigo-50' : 'border-gray-200 bg-white'}`}
                        >
                            <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${formData.attendanceCheck === true ? 'border-indigo-900 bg-indigo-900' : 'border-gray-300'}`}>
                                {formData.attendanceCheck === true && <Ionicons name="checkmark" size={16} color="white" />}
                            </View>
                            <Text className={`ml-3 font-semibold ${formData.attendanceCheck === true ? 'text-indigo-900' : 'text-gray-700'}`}>Consistent Attendance</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setFormData(prev => ({ ...prev, attendanceCheck: false }))}
                            className={`flex-row items-center p-4 rounded-xl border-2 ${formData.attendanceCheck === false ? 'border-indigo-900 bg-indigo-50' : 'border-gray-200 bg-white'}`}
                        >
                            <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${formData.attendanceCheck === false ? 'border-indigo-900 bg-indigo-900' : 'border-gray-300'}`}>
                                {formData.attendanceCheck === false && <Ionicons name="checkmark" size={16} color="white" />}
                            </View>
                            <Text className={`ml-3 font-semibold ${formData.attendanceCheck === false ? 'text-indigo-900' : 'text-gray-700'}`}>Inconsistent Attendance</Text>
                        </TouchableOpacity>
                    </View>
                );
            case 2:
                return (
                    <View>
                        <Text className="text-lg font-bold text-gray-900 mb-2">Attendance Details</Text>
                        <Text className="text-gray-600 mb-4">Any specific observations regarding punctuality or attendance?</Text>
                        <TextInput
                            multiline
                            numberOfLines={4}
                            value={formData.attendanceDetails}
                            onChangeText={(text) => setFormData(prev => ({ ...prev, attendanceDetails: text }))}
                            placeholder="e.g. Always punctual, rare absences..."
                            className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 h-32"
                            textAlignVertical="top"
                        />
                    </View>
                );
            case 3:
                return (
                    <View>
                        <Text className="text-lg font-bold text-gray-900 mb-1">Performance & Skills</Text>
                        <Text className="text-gray-600 mb-6">How would you rate the doctor's clinical skills and performance?</Text>

                        <View className="flex-row justify-between mb-8 px-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => handleRating('performance', star)}>
                                    <Ionicons
                                        name={star <= formData.performance ? "star" : "star-outline"}
                                        size={48}
                                        color={star <= formData.performance ? "#FFB800" : "#D1D5DB"}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            multiline
                            value={formData.comment}
                            onChangeText={(text) => setFormData(prev => ({ ...prev, comment: text }))}
                            placeholder="Additional comments on performance..."
                            className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 h-24"
                            textAlignVertical="top"
                        />
                    </View>
                );
            case 4:
                return (
                    <View>
                        <Text className="text-lg font-bold text-gray-900 mb-1">Professional Ethics</Text>
                        <Text className="text-gray-600 mb-6">Ethical conduct and patient interaction.</Text>

                        <View className="flex-row justify-between mb-8 px-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => handleRating('ethics', star)}>
                                    <Ionicons
                                        name={star <= formData.ethics ? "star" : "star-outline"}
                                        size={48}
                                        color={star <= formData.ethics ? "#FFB800" : "#D1D5DB"}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            case 5:
                return (
                    <View>
                        <Text className="text-lg font-bold text-gray-900 mb-1">Teamwork & Collaboration</Text>
                        <Text className="text-gray-600 mb-6">Collaboration with other medical staff and hospital administration.</Text>

                        <View className="flex-row justify-between mb-8 px-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => handleRating('teamwork', star)}>
                                    <Ionicons
                                        name={star <= formData.teamwork ? "star" : "star-outline"}
                                        size={48}
                                        color={star <= formData.teamwork ? "#FFB800" : "#D1D5DB"}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text className="font-bold text-gray-900 mb-2">Testimonial</Text>
                        <TextInput
                            multiline
                            value={formData.testimonial}
                            onChangeText={(text) => setFormData(prev => ({ ...prev, testimonial: text }))}
                            placeholder="e.g. A dedicated professional who exceeded expectations..."
                            className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 h-24"
                            textAlignVertical="top"
                        />
                    </View>
                );
            case 6:
                return (
                    <View>
                        <Text className="text-xl font-bold text-gray-900 mb-1">Your Testimonial</Text>
                        <Text className="text-gray-500 mb-6">Tell us about your experience with this employer.</Text>

                        <View className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 shadow-sm">
                            <TextInput
                                multiline
                                numberOfLines={6}
                                value={formData.testimonial}
                                onChangeText={(text) => setFormData(prev => ({ ...prev, testimonial: text }))}
                                placeholder="Enter Your Testimonial"
                                className="text-gray-900 min-h-[150px]"
                                textAlignVertical="top"
                            />
                            <View className="flex-row items-center mt-2">
                                <Ionicons name="bulb-outline" size={14} color="#9CA3AF" />
                                <Text className="ml-1 text-xs text-gray-400">This may be visible on the candidate's profile</Text>
                            </View>
                        </View>

                        <View className="bg-blue-50/30 rounded-2xl p-4 border border-blue-100/50">
                            <View className="flex-row items-center mb-3">
                                <Ionicons name="bulb" size={20} color="#1E3A8A" />
                                <Text className="ml-2 font-bold text-blue-900">Helpful Tips</Text>
                            </View>
                            <Text className="text-blue-800 text-sm mb-2">• Share specific examples of positive experiences</Text>
                            <Text className="text-blue-800 text-sm mb-2">• Mention aspects that stood out about the workplace culture</Text>
                            <Text className="text-blue-800 text-sm mb-2">• Include details about professional growth opportunities</Text>
                            <Text className="text-blue-800 text-sm">• Keep it honest and constructive</Text>
                        </View>
                    </View>
                );
            case 7:
                return (
                    <View>
                        <Text className="text-xl font-bold text-gray-900 mb-1">Your Platform Experience</Text>
                        <Text className="text-gray-500 mb-6">Help us improve by sharing your experience with the platform.</Text>

                        <View className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 shadow-sm">
                            <Text className="text-blue-900/70 font-medium mb-4">How was your experience with CareChain? (1–5)</Text>
                            <View className="flex-row justify-between mb-2">
                                {[1, 2, 3, 4, 5].map((num) => (
                                    <TouchableOpacity
                                        key={num}
                                        onPress={() => setFormData(prev => ({ ...prev, platformRating: num }))}
                                        className={`w-[58px] h-[58px] rounded-xl border items-center justify-center ${formData.platformRating === num ? 'bg-indigo-50/30 border-indigo-950' : 'bg-white border-gray-100'}`}
                                    >
                                        <Text className={`text-lg font-bold ${formData.platformRating === num ? 'text-indigo-950' : 'text-gray-400'}`}>{num}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View className="flex-row justify-between px-1">
                                <Text className="text-[10px] text-gray-400">Poor</Text>
                                <Text className="text-[10px] text-gray-400">Excellent</Text>
                            </View>

                            <Text className="text-blue-900/70 font-medium mt-8 mb-4">What did you like, and what can we do better? (Optional)</Text>
                            <View className="border border-gray-100 rounded-xl p-3 min-h-[120px]">
                                <TextInput
                                    multiline
                                    value={formData.platformFeedback}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, platformFeedback: text.slice(0, 300) }))}
                                    placeholder="Write your feedback"
                                    className="text-gray-900"
                                    textAlignVertical="top"
                                />
                                <Text className="absolute bottom-2 right-2 text-[10px] text-gray-300">{formData.platformFeedback.length}/300</Text>
                            </View>
                        </View>

                        <View className="bg-blue-50/30 rounded-2xl p-4 border border-blue-100/50 flex-row items-center">
                            <Ionicons name="heart-outline" size={24} color="#1E3A8A" />
                            <View className="ml-3 flex-1">
                                <Text className="font-bold text-blue-900">Thank you for your time!</Text>
                                <Text className="text-blue-800 text-xs mt-1">Your feedback helps us improve CareChain and create better experiences for healthcare professionals like you.</Text>
                            </View>
                        </View>
                    </View>
                );
            default:
                return null;
        }
    };

    if (isSubmitted) {
        return (
            <Modal visible={isVisible} animationType="fade" transparent={true}>
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-white rounded-t-3xl p-6 h-[85%] items-center">
                        <View className="w-16 h-1 w-12 bg-gray-200 rounded-full mb-8" />

                        <View className="w-24 h-24 rounded-full bg-green-50 items-center justify-center mb-6">
                            <View className="w-18 h-18 rounded-full bg-[#10B981] items-center justify-center">
                                <Ionicons name="checkmark" size={48} color="white" />
                            </View>
                        </View>

                        <Text className="text-2xl font-bold text-slate-800 text-center mb-2">Feedback Submitted Successfully</Text>
                        <Text className="text-gray-400 text-center px-6 mb-10 text-sm">Your feedback has been saved and contributes to a more transparent hiring ecosystem.</Text>

                        <View className="w-full space-y-4 mb-10">
                            <View className="bg-blue-50/20 border border-blue-100/30 p-4 rounded-2xl">
                                <View className="flex-row items-center mb-2">
                                    <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center">
                                        <Ionicons name="information" size={20} color="#3B82F6" />
                                    </View>
                                    <View className="ml-3 flex-1">
                                        <Text className="font-bold text-slate-800">What Happens Next</Text>
                                        <Text className="text-gray-400 text-xs mt-1 leading-4">Your feedback will be reviewed and may appear on the candidate's profile to help future employers make informed decisions. This helps maintain quality and transparency across CareChain.</Text>
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
                                        <Text className="font-bold text-green-700">Thank You for Your Contribution</Text>
                                        <Text className="text-green-700/80 text-xs mt-1">Your feedback helps improve hiring transparency and supports better matches between healthcare professionals and organizations.</Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        <View className="w-full mt-auto space-y-3">
                            <TouchableOpacity
                                onPress={() => {
                                    setIsSubmitted(false);
                                    onClose(); // Close modal on Done
                                    onSubmitSuccess();
                                }}
                                className="w-full bg-indigo-950 py-4 rounded-xl items-center"
                            >
                                <Text className="text-white font-bold text-lg">Done</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    setIsSubmitted(false);
                                    onClose();
                                    if (onPressProfile) onPressProfile();
                                }}
                                className="w-full py-4 items-center bg-white border border-gray-100 rounded-xl"
                            >
                                <Text className="text-gray-500 font-medium">View Candidate Profile</Text>
                            </TouchableOpacity>
                            <Text className="text-center text-gray-400 text-[10px] mt-4">Your Feedback is valuable to our Community</Text>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={isVisible} animationType="slide" transparent={true}>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-white rounded-t-3xl p-6 h-[85%]">
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-2">
                        <View>
                            <Text className="text-xl font-bold text-gray-900">
                                {currentStep <= 6 ? "Employer Feedback Form" : "Your Platform Experience"}
                            </Text>
                            <Text className="text-gray-400 text-sm">
                                {currentStep <= 6 ? "Help us improve by sharing your feedback on the candidate." : "Help us improve by sharing your experience with the platform."}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <Ionicons name="close" size={28} color="#111827" />
                        </TouchableOpacity>
                    </View>

                    <StepProgress currentStep={currentStep} totalSteps={totalSteps} />

                    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 mt-4">
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
                                disabled={currentStep === 1 && formData.attendanceCheck === null}
                                className={`flex-1 py-4 rounded-xl items-center justify-center ${(currentStep === 1 && formData.attendanceCheck === null) ? 'bg-indigo-300' : 'bg-indigo-950'
                                    }`}
                            >
                                <Text className="text-white font-bold text-lg">Next</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={submitFeedback}
                                disabled={isLoading || formData.performance === 0 || formData.ethics === 0 || formData.teamwork === 0 || formData.platformRating === 0}
                                className={`flex-1 py-4 rounded-xl items-center justify-center ${(isLoading || formData.performance === 0 || formData.ethics === 0 || formData.teamwork === 0 || formData.platformRating === 0) ? 'bg-indigo-300' : 'bg-indigo-900'
                                    }`}
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

export default EmployerFeedbackForm;
