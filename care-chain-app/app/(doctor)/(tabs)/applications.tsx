import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useApplications, useJobApplication, Application } from '../../../hooks';
import OfferDetailsModal from '../_components/OfferDetailsModal';
import { doctorApi } from '@/services/api';
import { Colors } from '@/constants/Colors';

type ApplicationJob = {
  id: string;
  applicationId: string;
  title: string;
  hospital: string;
  location: string;
  experience: string;
  salary: string;
  avatar?: string | null;
  status?: string | null;
  statusRaw?: string | null;
  hasOffer?: boolean;
  offer?: any;
};

// JobCard Component
const JobCard: React.FC<{
  job: ApplicationJob;
  onViewDetails: () => void;
  onWithdraw?: () => void;
  onViewOffer?: () => void;
}> = ({ job, onViewDetails, onWithdraw, onViewOffer }) => {
  const withdrawableStatuses = ['applied', 'under_review', 'shortlisted'] as const;
  const isWithdrawable = Boolean(job.statusRaw && withdrawableStatuses.includes(job.statusRaw as any));
  const hasOffer = job.statusRaw === 'offer_made' || job.statusRaw === 'hired';

  const getBadgeColors = () => {
    switch (job.status) {
      case 'Applied':
        return { bg: '#A1FF85', text: '#065F46' };
      case 'Under Review':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'Invited':
      case 'Shortlisted':
        return { bg: '#DBEAFE', text: '#1E40AF' };
      case 'Offer Made':
      case 'Offers':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'Hired':
        return { bg: '#D1FAE5', text: '#065F46' };
      case 'Offer Declined':
        return { bg: '#FED7AA', text: '#9A3412' };
      case 'Rejected':
        return { bg: '#FEE2E2', text: '#991B1B' };
      default:
        if (job.status?.startsWith('Interview')) {
          return { bg: '#E9D5FF', text: '#6B21A8' };
        }
        return { bg: Colors.ui.backgroundGray, text: Colors.ui.textPrimary };
    }
  };

  const badgeColors = getBadgeColors();

  return (
    <View style={{ 
      backgroundColor: Colors.ui.background, 
      borderRadius: 20, 
      padding: 16, 
      marginBottom: 12, 
      shadowColor: '#000', 
      shadowOpacity: 0.06, 
      shadowRadius: 6, 
      shadowOffset: { width: 0, height: 2 }, 
      elevation: 2, 
      borderWidth: 1, 
      borderColor: Colors.ui.inputBorder 
    }}>
      {/* Status Badge - Top Right */}
      {job.status && (
        <View style={{ 
          position: 'absolute', 
          top: 16, 
          right: 16, 
          paddingHorizontal: 14, 
          paddingVertical: 6, 
          borderRadius: 16, 
          backgroundColor: badgeColors.bg 
        }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: badgeColors.text }}>
            {job.status}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Avatar */}
        <View style={{ 
          width: 56, 
          height: 56, 
          borderRadius: 28, 
          backgroundColor: Colors.ui.backgroundGray, 
          overflow: 'hidden', 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginRight: 12 
        }}>
          <View style={{ 
            width: '100%', 
            height: '100%', 
            backgroundColor: '#DBEAFE', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Text style={{ color: Colors.brand.tertiary, fontWeight: '700', fontSize: 22 }}>
              {job.title?.charAt(0) || 'J'}
            </Text>
          </View>
        </View>

        {/* Content */}
        <View style={{ flex: 1, paddingRight: 70 }}>
          {/* Job Title */}
          <Text style={{ 
            fontSize: 20, 
            fontWeight: '700', 
            color: Colors.ui.textPrimary, 
            marginBottom: 2 
          }}>
            {job.title}
          </Text>

          {/* Hospital Name */}
          <Text style={{ 
            fontSize: 15, 
            color: Colors.ui.textSecondary, 
            marginBottom: 6,
            fontWeight: '500'
          }}>
            {job.hospital}
          </Text>

          {/* Location and Experience Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
              <MaterialIcons name="location-on" size={14} color={Colors.ui.placeholder} />
              <Text style={{ 
                fontSize: 13, 
                color: Colors.ui.placeholder, 
                marginLeft: 3,
                fontWeight: '500'
              }}>
                {job.location}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="briefcase-outline" size={14} color={Colors.ui.placeholder} />
              <Text style={{ 
                fontSize: 13, 
                color: Colors.ui.placeholder, 
                marginLeft: 3,
                fontWeight: '500'
              }}>
                {job.experience}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'flex-end', 
        marginTop: 14, 
        gap: 10 
      }}>
        {isWithdrawable && onWithdraw ? (
          <TouchableOpacity
            onPress={onWithdraw}
            style={{ 
              paddingHorizontal: 20, 
              paddingVertical: 10, 
              borderRadius: 20, 
              borderWidth: 1.5, 
              borderColor: Colors.ui.inputBorder, 
              backgroundColor: Colors.ui.background 
            }}
            activeOpacity={0.8}
          >
            <Text style={{ 
              fontSize: 13, 
              fontWeight: '700', 
              color: Colors.ui.textPrimary 
            }}>
              Withdraw
            </Text>
          </TouchableOpacity>
        ) : null}
        {hasOffer && onViewOffer ? (
          <TouchableOpacity
            onPress={onViewOffer}
            style={{ 
              paddingHorizontal: 20, 
              paddingVertical: 10, 
              borderRadius: 20, 
              backgroundColor: '#10B981' 
            }}
            activeOpacity={0.85}
          >
            <Text style={{ 
              fontSize: 13, 
              fontWeight: '700', 
              color: Colors.ui.background 
            }}>
              View Offer
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={onViewDetails}
          style={{ 
            paddingHorizontal: 20, 
            paddingVertical: 10, 
            borderRadius: 20, 
            backgroundColor: Colors.brand.primary 
          }}
          activeOpacity={0.85}
        >
          <Text style={{ 
            fontSize: 13, 
            fontWeight: '700', 
            color: Colors.ui.background 
          }}>
            View Details
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main Application Screen
const JobApplicationsScreen: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('Applied');
  const [refreshing, setRefreshing] = useState(false);
  const tabScrollViewRef = React.useRef<ScrollView>(null);

  // Offer modal state
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>('');
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>('');
  const [selectedHospitalName, setSelectedHospitalName] = useState<string>('');
  const [isLoadingOffer, setIsLoadingOffer] = useState(false);

  // Fetch applications from API
  const { applications, isLoading, error, counts, refresh } = useApplications();
  const { withdraw, isLoading: isWithdrawing } = useJobApplication();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleWithdraw = async (application: Application) => {
    Alert.alert(
      'Withdraw Application',
      `Are you sure you want to withdraw your application for "${application.job.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            const result = await withdraw(application.jobId);
            if (result.success) {
              refresh();
              Alert.alert('Success', 'Application withdrawn');
            } else {
              Alert.alert('Error', result.error || 'Failed to withdraw');
            }
          }
        },
      ]
    );
  };

  const handleViewOffer = async (application: Application) => {
    setSelectedApplicationId(application.id);
    setSelectedJobTitle(application.job.title);
    setSelectedHospitalName(application.job.hospital);
    setIsLoadingOffer(true);
    setOfferModalVisible(true);
    
    try {
      const response = await doctorApi.getOfferDetails(application.id);
      if (response.success && response.data) {
        setSelectedOffer(response.data.offer);
      } else {
        Alert.alert('Error', response.error || 'Failed to load offer details');
        setOfferModalVisible(false);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load offer details');
      setOfferModalVisible(false);
    } finally {
      setIsLoadingOffer(false);
    }
  };

  const handleOfferResponded = () => {
    refresh();
  };

  const tabs = [
    { id: 'Applied', label: 'Applied', count: counts['Applied'] || 0 },
    { id: 'Invited', label: 'Invited', count: counts['Invited'] || 0 },
    { id: 'Rejected', label: 'Rejected', count: counts['Rejected'] || 0 },
    { id: 'Shortlisted', label: 'Shortlisted', count: counts['Shortlisted'] || 0 },
    { id: 'Interview', label: 'Interview', count: counts['Interview'] || 0 },
  ] as const;

  const stats = [
    { label: 'Applied', value: counts['Applied'] || 0 },
    { label: 'Interviews', value: counts['Interview'] || 0 },
    { label: 'Offers', value: counts['Offers'] || 0 },
    { label: 'Rejected', value: counts['Rejected'] || 0 },
  ] as const;

  const sortOptions = [
    {
      id: 'job_type',
      title: 'Job Type',
      subtitle: 'Full-time, Part-time, etc.',
      icon: 'briefcase-outline' as const,
    },
    {
      id: 'date_application',
      title: 'Date of Application',
      subtitle: 'Newest to Oldest',
      icon: 'calendar-outline' as const,
    },
    {
      id: 'status',
      title: 'Application Status',
      subtitle: 'Applied, Invited, etc.',
      icon: 'list-outline' as const,
    },
    {
      id: 'distance',
      title: 'Distance',
      subtitle: 'Nearest to Farthest',
      icon: 'location-outline' as const,
    },
  ] as const;

  const [sortSheetVisible, setSortSheetVisible] = useState(false);
  const [selectedSort, setSelectedSort] = useState<(typeof sortOptions)[number]['id']>('date_application');
  const [pendingSort, setPendingSort] = useState<(typeof sortOptions)[number]['id']>('date_application');

  // Filter applications by active tab status
  const statusMap: { [key: string]: string[] } = {
    Applied: ['applied', 'under_review'],
    Invited: ['invited'],
    Rejected: ['rejected', 'withdrawn', 'offer_declined'],
    Shortlisted: ['shortlisted'],
    Interview: ['interview_scheduled', 'interviewed'],
  };

  const filteredApplications = applications.filter(app =>
    statusMap[activeTab]?.includes(app.status.toLowerCase())
  );

  // Convert to display format
  const currentJobs: ApplicationJob[] = filteredApplications.map(app => ({
    id: app.id,
    applicationId: app.id,
    title: app.job.title,
    hospital: app.job.hospital,
    location: app.job.location,
    experience: app.job.experience,
    salary: app.job.salary,
    avatar: app.job.avatar,
    statusRaw: app.status,
    status: app.statusLabel || app.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    hasOffer: ['offer_made', 'hired'].includes(app.status.toLowerCase()),
  })).sort((a, b) => {
    if (selectedSort === 'status') {
      return (a.status || '').localeCompare(b.status || '');
    }
    if (selectedSort === 'job_type') {
      return (a.experience || '').localeCompare(b.experience || '');
    }
    if (selectedSort === 'distance') {
      return (a.location || '').localeCompare(b.location || '');
    }
    // Default: date_application (newest first)
    return 0;
  });

  const openSortSheet = () => {
    setPendingSort(selectedSort);
    setSortSheetVisible(true);
  };

  const closeSortSheet = () => setSortSheetVisible(false);

  const applySortSheet = () => {
    setSelectedSort(pendingSort);
    closeSortSheet();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.ui.backgroundGray }}
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.primary]} />
      }
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <ScrollView
            ref={tabScrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 28, paddingRight: 16 }}
          >
            {tabs.map((tab, index) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => {
                  setActiveTab(tab.id);
                  // Scroll to make the selected tab visible
                  tabScrollViewRef.current?.scrollTo({ x: index * 100, animated: true });
                }}
                activeOpacity={0.9}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: '600', color: activeTab === tab.id ? Colors.ui.textPrimary : Colors.ui.textSecondary }}
                >
                  {tab.label}
                </Text>
                {activeTab === tab.id ? (
                  <View style={{ height: 2, backgroundColor: Colors.brand.primary, marginTop: 4, borderRadius: 2 }} />
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              const idx = tabs.findIndex((t) => t.id === activeTab);
              const nextIdx = (idx + 1) % tabs.length;
              const next = tabs[nextIdx]?.id;
              if (next) {
                setActiveTab(next);
                // Scroll to make the next tab visible
                tabScrollViewRef.current?.scrollTo({ x: nextIdx * 100, animated: true });
              }
            }}
          >
            <Text style={{ color: Colors.ui.textSecondary, fontSize: 16, fontWeight: '600' }}>&gt;&gt;</Text>
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: Colors.ui.background, borderRadius: 16, marginTop: 16, paddingVertical: 16, paddingHorizontal: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2, borderWidth: 1, borderColor: Colors.ui.inputBorder }}>
          <View style={{ flexDirection: 'row' }}>
            {stats.map((s, idx) => (
              <View
                key={s.label}
                style={{ flex: 1, alignItems: 'center', borderLeftWidth: idx !== 0 ? 1 : 0, borderLeftColor: Colors.ui.inputBorder }}
              >
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.ui.textPrimary }}>{s.value}</Text>
                <Text style={{ fontSize: 10, color: Colors.ui.placeholder, marginTop: 2 }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.ui.background, borderWidth: 1, borderColor: Colors.ui.inputBorder, borderRadius: 24, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 16 }}>
              <Ionicons name="search" size={18} color={Colors.ui.placeholder} />
              <TextInput
                placeholder="Search Jobs by job post title"
                style={{ flex: 1, marginLeft: 8, paddingVertical: 12, color: Colors.ui.textPrimary }}
                placeholderTextColor={Colors.ui.placeholder}
              />
            </View>
            <TouchableOpacity
              onPress={openSortSheet}
              activeOpacity={0.9}
              style={{ backgroundColor: Colors.brand.primary, paddingHorizontal: 20, paddingVertical: 12 }}
            >
              <Ionicons name="funnel-outline" size={20} color={Colors.ui.background} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          {isLoading && !refreshing ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={Colors.brand.primary} />
              <Text style={{ color: Colors.ui.textSecondary, marginTop: 8 }}>Loading applications...</Text>
            </View>
          ) : error ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <MaterialIcons name="error-outline" size={48} color="#EF4444" />
              <Text style={{ color: Colors.ui.textSecondary, marginTop: 8 }}>{error}</Text>
              <TouchableOpacity
                style={{ marginTop: 16, backgroundColor: Colors.brand.tertiary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                onPress={refresh}
              >
                <Text style={{ color: Colors.ui.background, fontWeight: '600' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : currentJobs.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <MaterialIcons name="folder-open" size={48} color={Colors.ui.placeholder} />
              <Text style={{ color: Colors.ui.textSecondary, marginTop: 8 }}>No applications in this category</Text>
            </View>
          ) : (
            currentJobs.map((job) => {
              const app = filteredApplications.find(a => a.id === job.id);
              return (
                <JobCard
                  key={`${activeTab}-${job.id}`}
                  job={job}
                  onViewDetails={() =>
                    router.push({
                      pathname: '/(doctor)/(tabs)/jobDetails',
                      params: { id: app?.jobId || job.id },
                    })
                  }
                  onWithdraw={
                    activeTab === 'Applied' && app
                      ? () => handleWithdraw(app)
                      : undefined
                  }
                  onViewOffer={
                    job.hasOffer && app
                      ? () => handleViewOffer(app)
                      : undefined
                  }
                />
              );
            })
          )}
        </View>
      </View>

      <Modal
        visible={sortSheetVisible}
        transparent
        animationType="fade"
        onRequestClose={closeSortSheet}
      >
        <Pressable style={{ flex: 1 }} onPress={closeSortSheet}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' }}>
            <Pressable onPress={() => { }}>
              <View style={{ backgroundColor: Colors.ui.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}>
                <View style={{ width: 48, height: 4, backgroundColor: Colors.ui.inputBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.ui.textPrimary }}>Sort By</Text>
                  <TouchableOpacity activeOpacity={0.8} onPress={closeSortSheet}>
                    <Ionicons name="close" size={22} color={Colors.ui.textPrimary} />
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 12 }}>
                  {sortOptions.map((opt) => {
                    const active = pendingSort === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        activeOpacity={0.9}
                        onPress={() => setPendingSort(opt.id)}
                        style={{ borderRadius: 16, borderWidth: 1, borderColor: active ? Colors.brand.primary : Colors.ui.inputBorder, paddingHorizontal: 16, paddingVertical: 16 }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View
                            style={{ height: 40, width: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: active ? '#EEF2FF' : Colors.ui.backgroundGray }}
                          >
                            <Ionicons
                              name={opt.icon}
                              size={18}
                              color={active ? Colors.brand.secondary : Colors.ui.placeholder}
                            />
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.brand.primary }}>
                              {opt.title}
                            </Text>
                            <Text style={{ fontSize: 12, color: Colors.ui.textSecondary, marginTop: 2 }}>{opt.subtitle}</Text>
                          </View>

                          <Ionicons
                            name={active ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={active ? Colors.brand.secondary : '#D1D5DB'}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', marginTop: 24, gap: 12 }}>
                  <TouchableOpacity
                    onPress={closeSortSheet}
                    activeOpacity={0.85}
                    style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: Colors.brand.primary, paddingVertical: 12, alignItems: 'center' }}
                  >
                    <Text style={{ fontWeight: '600', color: Colors.brand.primary }}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={applySortSheet}
                    activeOpacity={0.85}
                    style={{ flex: 1, borderRadius: 12, backgroundColor: Colors.brand.primary, paddingVertical: 12, alignItems: 'center' }}
                  >
                    <Text style={{ fontWeight: '600', color: Colors.ui.background }}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Offer Details Modal */}
      <OfferDetailsModal
        visible={offerModalVisible}
        onClose={() => {
          setOfferModalVisible(false);
          setSelectedOffer(null);
        }}
        offer={selectedOffer}
        applicationId={selectedApplicationId}
        jobTitle={selectedJobTitle}
        hospitalName={selectedHospitalName}
        onOfferResponded={handleOfferResponded}
      />

      {/* Loading Overlay for Offer */}
      {isLoadingOffer && (
        <Modal visible transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ backgroundColor: Colors.ui.background, borderRadius: 12, padding: 24, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={Colors.brand.primary} />
              <Text style={{ color: Colors.ui.textSecondary, marginTop: 12 }}>Loading offer details...</Text>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
};

export default JobApplicationsScreen;