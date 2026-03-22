import React, { useCallback, useState } from 'react';
import { ScrollView, View, Text, ActivityIndicator, RefreshControl, TouchableOpacity, Modal } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import CandidateCard from '../components/CandidateCard';
import { useSearchDoctors } from '@/hooks';
import { Colors } from '@/constants/Colors';

export default function AllCandidates() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const { doctors, isLoading, error, refresh, totalCount } = useSearchDoctors({ limit: 50 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleViewProfile = (candidateId: string) => {
    router.push({ pathname: '/(hospital)/candidateDetails/[id]', params: { id: candidateId, mode: 'search' } });
  };

  const handleInvite = (candidateId: string) => {
    router.push({
      pathname: '/(hospital)/candidateDetails/[id]',
      params: { id: candidateId, mode: 'search', initialAction: 'invite' }
    });
  };

  const handleMenuPress = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    setMenuVisible(true);
  };

  const handleNotInterested = () => {
    // TODO: Implement not interested functionality
    setMenuVisible(false);
  };

  const handleReport = () => {
    // TODO: Implement report functionality
    setMenuVisible(false);
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.ui.backgroundGray }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.primary]} />
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name="stars" size={22} color={Colors.brand.tertiary} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.ui.textPrimary, marginLeft: 8 }}>All Candidates</Text>
          </View>
          <Text style={{ fontSize: 14, color: Colors.ui.textSecondary }}>{totalCount} doctors</Text>
        </View>

        {isLoading && doctors.length === 0 ? (
          <View style={{ backgroundColor: Colors.ui.background, borderRadius: 16, borderWidth: 1, borderColor: Colors.ui.inputBorder, padding: 24, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.brand.primary} />
            <Text style={{ color: Colors.ui.textSecondary, fontSize: 14, marginTop: 12 }}>Loading candidates...</Text>
          </View>
        ) : error ? (
          <View style={{ backgroundColor: Colors.ui.background, borderRadius: 16, borderWidth: 1, borderColor: Colors.ui.inputBorder, padding: 24, alignItems: 'center' }}>
            <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
            <Text style={{ color: Colors.ui.textPrimary, fontWeight: '600', marginTop: 12 }}>Error</Text>
            <Text style={{ color: Colors.ui.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'center' }}>{error}</Text>
            <TouchableOpacity
              onPress={refresh}
              style={{ marginTop: 16, backgroundColor: Colors.brand.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
            >
              <Text style={{ color: Colors.ui.background, fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : doctors.length === 0 ? (
          <View style={{ backgroundColor: Colors.ui.background, borderRadius: 16, borderWidth: 1, borderColor: Colors.ui.inputBorder, padding: 24, alignItems: 'center' }}>
            <Ionicons name="people-outline" size={40} color={Colors.ui.placeholder} />
            <Text style={{ color: Colors.ui.textPrimary, fontWeight: '600', marginTop: 12 }}>No candidates found</Text>
            <Text style={{ color: Colors.ui.textSecondary, fontSize: 12, marginTop: 4 }}>No doctors are currently registered.</Text>
          </View>
        ) : (
          doctors.map((doctor) => (
            <CandidateCard
              key={doctor.id}
              candidate={{
                id: doctor.id,
                name: doctor.name,
                role: doctor.role,
                location: doctor.location,
                experienceYears: doctor.experienceYears,
                avatarUri: doctor.avatarUri || undefined,
                invitationStatus: doctor.invitationStatus,
                conversationId: doctor.conversationId,
              }}
              onViewProfile={handleViewProfile}
              onInvite={handleInvite}
              onMenuPress={handleMenuPress}
            />
          ))
        )}
      </ScrollView>

      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}
        >
          <View style={{ backgroundColor: Colors.ui.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 48, height: 4, backgroundColor: Colors.ui.inputBorder, borderRadius: 2 }} />
            </View>

            <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.ui.textPrimary, marginBottom: 16, paddingHorizontal: 8 }}>Options</Text>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12 }}
              onPress={handleNotInterested}
              activeOpacity={0.7}
            >
              <View style={{ height: 40, width: 40, borderRadius: 20, backgroundColor: Colors.ui.backgroundGray, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="eye-off-outline" size={20} color={Colors.ui.textSecondary} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.ui.textPrimary }}>Not Interested</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginTop: 8 }}
              onPress={handleReport}
              activeOpacity={0.7}
            >
              <View style={{ height: 40, width: 40, borderRadius: 20, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="flag-outline" size={20} color="#EF4444" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#EF4444' }}>Report Candidate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 16, padding: 16, alignItems: 'center' }}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={{ color: Colors.ui.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
