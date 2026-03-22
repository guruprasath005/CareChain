import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doctorApi } from '@/services/api';

interface Offer {
  madeAt?: string;
  amount?: number;
  currency?: string;
  salaryType?: string;
  startDate?: string;
  reportingDate?: string;
  notes?: string;
  terms?: string;
  expiresAt?: string;
  status?: 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

interface OfferDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  offer: Offer | null;
  applicationId: string;
  jobTitle: string;
  hospitalName: string;
  onOfferResponded: () => void;
}

export default function OfferDetailsModal({
  visible,
  onClose,
  offer,
  applicationId,
  jobTitle,
  hospitalName,
  onOfferResponded,
}: OfferDetailsModalProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  if (!offer) return null;

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: offer.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = offer.expiresAt && new Date(offer.expiresAt) < new Date();
  const isPending = offer.status === 'pending' || !offer.status;
  const isAccepted = offer.status === 'accepted';
  const isDeclined = offer.status === 'declined';
  const canRespond = isPending && !isExpired;

  const getDaysUntilExpiry = () => {
    if (!offer.expiresAt) return null;
    const diff = new Date(offer.expiresAt).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const daysLeft = getDaysUntilExpiry();

  const handleAcceptOffer = async () => {
    Alert.alert(
      'Accept Offer',
      `Are you sure you want to accept this offer for ${jobTitle} at ${hospitalName}?\n\nOnce accepted, you will be hired and this job will appear in your Active Jobs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setIsAccepting(true);
            try {
              const response = await doctorApi.acceptOffer(applicationId);
              if (response.success) {
                Alert.alert(
                  'Congratulations! 🎉',
                  'You have successfully accepted the offer and are now hired!\n\nThis job will now appear in your Active Jobs section.',
                  [
                    {
                      text: 'View Active Jobs',
                      onPress: () => {
                        onOfferResponded();
                        onClose();
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Error', response.error || 'Failed to accept offer');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to accept offer');
            } finally {
              setIsAccepting(false);
            }
          },
        },
      ]
    );
  };

  const handleDeclineOffer = async () => {
    setIsDeclining(true);
    try {
      const response = await doctorApi.declineOffer(applicationId, declineReason);
      if (response.success) {
        Alert.alert(
          'Offer Declined',
          'You have declined this offer. The hospital has been notified.',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowDeclineModal(false);
                onOfferResponded();
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to decline offer');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to decline offer');
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[90%]">
            {/* Header */}
            <View className="px-6 py-4 border-b border-gray-100">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-xl font-bold text-gray-900">Job Offer</Text>
                  <Text className="text-sm text-gray-500">{hospitalName}</Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  className="h-10 w-10 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView className="px-6 py-4" showsVerticalScrollIndicator={false}>
              {/* Status Banner */}
              {isExpired && (
                <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={24} color="#dc2626" />
                    <View className="ml-3">
                      <Text className="text-red-700 font-bold">Offer Expired</Text>
                      <Text className="text-red-600 text-sm">This offer is no longer available</Text>
                    </View>
                  </View>
                </View>
              )}

              {isAccepted && (
                <View className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                    <View className="ml-3">
                      <Text className="text-green-700 font-bold">Offer Accepted</Text>
                      <Text className="text-green-600 text-sm">
                        Accepted on {formatDate(offer.acceptedAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {isDeclined && (
                <View className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                  <View className="flex-row items-center">
                    <Ionicons name="close-circle" size={24} color="#6b7280" />
                    <View className="ml-3">
                      <Text className="text-gray-700 font-bold">Offer Declined</Text>
                      <Text className="text-gray-600 text-sm">
                        Declined on {formatDate(offer.rejectedAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {canRespond && daysLeft !== null && (
                <View className={`rounded-xl p-4 mb-4 ${daysLeft <= 2 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <View className="flex-row items-center">
                    <Ionicons name="hourglass-outline" size={24} color={daysLeft <= 2 ? '#dc2626' : '#f59e0b'} />
                    <View className="ml-3">
                      <Text className={`font-bold ${daysLeft <= 2 ? 'text-red-700' : 'text-amber-700'}`}>
                        {daysLeft <= 0 ? 'Expires today!' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left to respond`}
                      </Text>
                      <Text className={`text-sm ${daysLeft <= 2 ? 'text-red-600' : 'text-amber-600'}`}>
                        Deadline: {formatDate(offer.expiresAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Position */}
              <View className="bg-blue-50 rounded-xl p-4 mb-4">
                <Text className="text-blue-600 text-sm font-medium">Position</Text>
                <Text className="text-blue-900 text-xl font-bold mt-1">{jobTitle}</Text>
              </View>

              {/* Offer Details Card */}
              <View className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                <Text className="text-gray-700 font-bold mb-4">📋 Offer Details</Text>

                <View className="space-y-3">
                  <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
                    <Text className="text-gray-500">Salary</Text>
                    <Text className="text-green-600 font-bold text-lg">
                      {formatCurrency(offer.amount)}
                      <Text className="text-gray-400 text-sm font-normal"> /{offer.salaryType || 'month'}</Text>
                    </Text>
                  </View>

                  <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
                    <Text className="text-gray-500">Joining Date</Text>
                    <Text className="text-gray-900 font-semibold">{formatDate(offer.startDate)}</Text>
                  </View>

                  <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
                    <Text className="text-gray-500">Reporting Date</Text>
                    <Text className="text-gray-900 font-semibold">{formatDate(offer.reportingDate)}</Text>
                  </View>

                  <View className="flex-row justify-between items-center py-2">
                    <Text className="text-gray-500">Offer Made On</Text>
                    <Text className="text-gray-900 font-semibold">{formatDate(offer.madeAt)}</Text>
                  </View>
                </View>
              </View>

              {/* Notes */}
              {offer.notes && (
                <View className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4">
                  <View className="flex-row items-start">
                    <Ionicons name="document-text-outline" size={20} color="#f59e0b" />
                    <View className="ml-3 flex-1">
                      <Text className="text-amber-800 font-semibold mb-1">Notes from Hospital</Text>
                      <Text className="text-amber-700 text-sm leading-5">{offer.notes}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Terms */}
              {offer.terms && (
                <View className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                  <View className="flex-row items-start">
                    <Ionicons name="shield-checkmark-outline" size={20} color="#6b7280" />
                    <View className="ml-3 flex-1">
                      <Text className="text-gray-700 font-semibold mb-1">Terms & Conditions</Text>
                      <Text className="text-gray-600 text-sm leading-5">{offer.terms}</Text>
                    </View>
                  </View>
                </View>
              )}

              <View className="h-4" />
            </ScrollView>

            {/* Action Buttons */}
            {canRespond && (
              <View className="px-6 py-4 border-t border-gray-100 bg-white">
                <View className="flex-row">
                  <TouchableOpacity
                    onPress={() => setShowDeclineModal(true)}
                    disabled={isAccepting}
                    className={`flex-1 border border-gray-300 rounded-xl py-4 mr-3 ${isAccepting ? 'opacity-50' : ''}`}
                  >
                    <Text className="text-gray-700 font-semibold text-center">Decline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleAcceptOffer}
                    disabled={isAccepting}
                    className={`flex-1 bg-green-600 rounded-xl py-4 flex-row items-center justify-center ${isAccepting ? 'opacity-50' : ''}`}
                  >
                    {isAccepting ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="white" />
                        <Text className="text-white font-bold ml-2">Accept Offer</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Decline Reason Modal */}
      <Modal
        visible={showDeclineModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeclineModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center px-5">
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-xl font-bold text-gray-900 mb-2">Decline Offer</Text>
            <Text className="text-gray-500 mb-4">
              Please let the hospital know why you're declining this offer (optional).
            </Text>

            <TextInput
              placeholder="Your reason for declining..."
              value={declineReason}
              onChangeText={setDeclineReason}
              className="border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-900"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholderTextColor="#9ca3af"
              style={{ minHeight: 80 }}
            />

            <View className="flex-row">
              <TouchableOpacity
                onPress={() => {
                  setShowDeclineModal(false);
                  setDeclineReason('');
                }}
                className="flex-1 border border-gray-300 rounded-xl py-3 mr-3"
                disabled={isDeclining}
              >
                <Text className="text-gray-700 font-semibold text-center">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDeclineOffer}
                disabled={isDeclining}
                className={`flex-1 bg-red-500 rounded-xl py-3 ${isDeclining ? 'opacity-50' : ''}`}
              >
                {isDeclining ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-center">Decline Offer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
