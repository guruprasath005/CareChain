import React from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Candidate } from '@/data/candidates';
import { Colors } from '@/constants/Colors';

type Props = {
  candidate: Candidate;
  onViewProfile?: (candidateId: string) => void;
  onInvite?: (candidateId: string) => void;
  onMenuPress?: (candidateId: string) => void;
};

export default function CandidateCard({
  candidate,
  onViewProfile,
  onInvite,
  onMenuPress,
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 360;

  const avatar = (() => {
    if (candidate.avatarSource) return <Image source={candidate.avatarSource} style={{ height: 48, width: 48, borderRadius: 24 }} />;
    if (candidate.avatarUri) return <Image source={{ uri: candidate.avatarUri }} style={{ height: 48, width: 48, borderRadius: 24 }} />;
    return <Ionicons name="person-circle-outline" size={48} color={Colors.ui.placeholder} />;
  })();

  return (
    <View style={{ backgroundColor: Colors.ui.background, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.ui.inputBorder }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={{ marginRight: 10 }}>{avatar}</View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: Colors.ui.textPrimary, fontFamily: 'DMSans-Bold' }} numberOfLines={1}>
              {candidate.name}
            </Text>
            <Text style={{ fontSize: 13, color: Colors.ui.textSecondary, marginTop: 2, fontFamily: 'DMSans-Regular' }} numberOfLines={1}>
              {candidate.role}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Ionicons name="location-outline" size={12} color={Colors.ui.textSecondary} />
              <Text style={{ fontSize: 11, color: Colors.ui.textSecondary, marginLeft: 3, fontFamily: 'DMSans-Regular' }} numberOfLines={1}>
                {candidate.location}
              </Text>

              <View style={{ width: 10 }} />

              <Ionicons name="briefcase-outline" size={12} color={Colors.ui.textSecondary} />
              <Text style={{ fontSize: 11, color: Colors.ui.textSecondary, marginLeft: 3, fontFamily: 'DMSans-Regular' }}>
                {candidate.experienceYears} Years
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.75}
          style={{ height: 32, width: 32, alignItems: 'center', justifyContent: 'center' }}
          onPress={() => onMenuPress?.(candidate.id)}
          accessibilityRole="button"
          accessibilityLabel="Candidate options"
        >
          <Ionicons name="ellipsis-vertical" size={16} color={Colors.ui.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 12, flexDirection: isNarrow ? 'column' : 'row', justifyContent: 'flex-end' }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onViewProfile?.(candidate.id)}
          style={{ 
            width: isNarrow ? '100%' : undefined,
            borderWidth: 1, 
            borderColor: Colors.brand.primary, 
            borderRadius: 10, 
            paddingVertical: 8, 
            paddingHorizontal: 14, 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}
        >
          <Text style={{ color: Colors.brand.primary, fontWeight: '600', fontSize: 13, fontFamily: 'DMSans-SemiBold' }}>View Profile</Text>
        </TouchableOpacity>

        <View style={{ height: isNarrow ? 10 : 0, width: isNarrow ? 0 : 10 }} />

        {candidate.invitationStatus === 'accepted' ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (candidate.conversationId) {
                router.push({
                  pathname: '/(hospital)/messages',
                  params: { conversationId: candidate.conversationId }
                });
              }
            }}
            style={{ 
              width: isNarrow ? '100%' : 110,
              backgroundColor: Colors.brand.primary, 
              borderRadius: 10, 
              paddingVertical: 8, 
              paddingHorizontal: 16, 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <Text style={{ color: Colors.ui.background, fontWeight: '600', fontSize: 13, fontFamily: 'DMSans-SemiBold' }}>Message</Text>
          </TouchableOpacity>
        ) : candidate.invitationStatus === 'pending' ? (
          <View style={{ 
            width: isNarrow ? '100%' : 110,
            backgroundColor: '#FFF7ED', 
            borderRadius: 10, 
            paddingVertical: 8, 
            paddingHorizontal: 16, 
            alignItems: 'center', 
            justifyContent: 'center', 
            borderWidth: 1, 
            borderColor: '#FDBA74' 
          }}>
            <Text style={{ color: '#C2410C', fontWeight: '600', fontSize: 13, fontFamily: 'DMSans-SemiBold' }}>Invited</Text>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onInvite?.(candidate.id)}
            style={{ 
              width: isNarrow ? '100%' : 110,
              backgroundColor: Colors.brand.primary, 
              borderRadius: 10, 
              paddingVertical: 8, 
              paddingHorizontal: 16, 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <Text style={{ color: Colors.ui.background, fontWeight: '600', fontSize: 13, fontFamily: 'DMSans-SemiBold' }}>Invite</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
