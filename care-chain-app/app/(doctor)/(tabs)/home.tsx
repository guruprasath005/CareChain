import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import JobCard from '../_components/JobCard';
import { useRouter } from 'expo-router';
import { useRecentJobs, useDoctorProfile, useApplications, useJobApplication, Job } from '../../../hooks';
import { useAuth } from '../../../contexts/AuthContext';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { useConversations } from '../../../hooks/useMessages';

// Type for MaterialIcons names
type MaterialIconName = keyof typeof MaterialIcons.glyphMap;

// Career health item type
interface CareerHealthItem {
  icon: MaterialIconName;
  value: number | string;
  label: string;
  bgColor: string;
  iconColor: string;
}

const INACTIVE_APPLICATION_STATUSES = new Set(['withdrawn', 'rejected']);

// Light muted color for text on gradient backgrounds (not in theme)
const GRADIENT_TEXT_MUTED = '#C7D2FE';

const HomePage: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { jobs: recentJobs, isLoading: jobsLoading, error: jobsError, refresh: refreshJobs } = useRecentJobs();
  const { profile, isLoading: profileLoading } = useDoctorProfile();
  const { counts: appCounts, refresh: refreshApplications, isLoading: appsLoading, applications } = useApplications();
  const { apply } = useJobApplication();
  const { unreadCount, refresh: refreshMessages } = useConversations();

  useFocusEffect(
    React.useCallback(() => {
      refreshJobs();
      refreshApplications();
      refreshMessages();
    }, [refreshJobs, refreshApplications, refreshMessages])
  );

  // Real-time polling for application updates (only when screen is focused and user is authenticated)
  useEffect(() => {
    if (!user) return; // Only poll if user is authenticated

    let pollInterval: ReturnType<typeof setInterval>;

    const startPolling = () => {
      pollInterval = setInterval(() => {
        refreshApplications();
      }, 120000); // Refresh every 2 minutes
    };

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };

    // Start polling immediately
    startPolling();

    // Clean up on unmount
    return stopPolling;
  }, [refreshApplications, user]);

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshJobs(), refreshApplications(), refreshMessages()]);
    setRefreshing(false);
  }, [refreshJobs, refreshApplications, refreshMessages]);

  const stats = {
    applied: appCounts['Applied'] || 0,
    interview: appCounts['Interview'] || 0,
    offers: (appCounts['Offers'] || 0) + (appCounts['Hired'] || 0),
  };

  // Check if there are any scheduled interviews
  const hasScheduledInterviews = applications.some(app =>
    app.status === 'interview_scheduled' || app.status === 'interviewed'
  );

  // Get the first scheduled interview for display
  const scheduledInterview = applications.find(app =>
    app.status === 'interview_scheduled' || app.status === 'interviewed'
  );

  // Define action-required statuses
  const ACTION_REQUIRED_STATUSES = ['shortlisted', 'interview_scheduled', 'rejected'];
  
  // Get all applications requiring action
  const actionRequiredApps = applications.filter(app => 
    ACTION_REQUIRED_STATUSES.includes(app.status)
  );
  
  // Check if there are unread messages
  const hasUnreadMessages = unreadCount > 0;
  
  // Get the most recent action-required application
  const latestActionApp = actionRequiredApps.length > 0 ? actionRequiredApps[0] : null;
  
  // Determine if we should show action alert
  const totalActions = actionRequiredApps.length + (hasUnreadMessages ? 1 : 0);
  const hasMultipleActions = totalActions > 1;
  const hasSingleAction = totalActions === 1;
  const hasAnyAction = totalActions > 0;

  // Helper function to get action title based on status
  const getActionTitle = (status: string) => {
    switch (status) {
      case 'interview_scheduled':
        return 'Interview Scheduled';
      case 'shortlisted':
        return 'Application Shortlisted';
      case 'rejected':
        return 'Application Update';
      case 'unread_messages':
        return 'New Messages';
      default:
        return 'Application Update';
    }
  };

  // Helper function to format date and time
  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Handler for viewing application details
  const handleViewApplicationDetails = (applicationId: string) => {
    // Navigate to application details or interview details
    router.push({
      pathname: '/(doctor)/(tabs)/applications',
      params: { highlightId: applicationId }
    });
  };

  // Handler for viewing all applications
  const handleViewAllApplications = () => {
    router.push('/(doctor)/(tabs)/applications');
  };

  // Handler for viewing messages
  const handleViewMessages = () => {
    router.push('/(doctor)/messages');
  };

  const careerHealth: CareerHealthItem[] = [
    {
      icon: 'check-circle',
      value: profile?.stats?.shiftsDone || 0,
      label: 'Shift Done',
      bgColor: Colors.ui.background,
      iconColor: Colors.semantic.success,
    },
    {
      icon: 'warning',
      value: profile?.stats?.noShows || 0,
      label: 'No Shows',
      bgColor: Colors.ui.background,
      iconColor: Colors.semantic.warning,
    },
  ];

  // Filter out jobs that the user has already applied for
  const appliedJobIds = new Set(applications.map(app => app.jobId));
  const recommendedJobs: Job[] = recentJobs
    .filter(job => !appliedJobIds.has(job.id))
    .slice(0, 4);


  // ================= Handlers =================
  const handleViewProfile = (jobId: string) => {
    router.push({ pathname: '/(doctor)/(tabs)/jobDetails', params: { id: jobId } });
  };

  const handleApply = (jobId: string, title?: string, hospital?: string) => {
    Alert.alert(
      'Apply for Job',
      `Apply for "${title || 'this job'}"${hospital ? ` at ${hospital}` : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            const result = await apply(jobId);
            if (result.success) {
              Alert.alert('Success', 'Your application has been submitted!');
              await refreshJobs();
            } else {
              Alert.alert('Error', result.error || 'Failed to apply');
            }
          },
        },
      ]
    );
  };

  const handleInterviewDetails = () => {
    // TODO: Implement interview details view
  };

  const handleSeeAll = () => {
    router.push('/(doctor)/(tabs)/allJobs');
  };

  // ================= Render =================
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.ui.backgroundGray} />

      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.ui.backgroundGray }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.primary]} />
        }
      >
        {/* ===== Stats Section ===== */}
        <View style={{ marginHorizontal: 20, marginTop: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, position: 'relative' }}>
            <Text style={{ fontSize: 18, color: Colors.ui.textPrimary, textAlign: 'center', fontFamily: 'DMSans-Bold' }}>
              Ready for your next shift?
            </Text>
            {appsLoading && (
              <ActivityIndicator size="small" color={Colors.brand.tertiary} style={{ position: 'absolute', right: 0 }} />
            )}
          </View>

          <View style={{ 
            backgroundColor: Colors.ui.background, 
            borderRadius: 16,
            paddingHorizontal: 20, 
            paddingVertical: 16,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              {['Applied', 'Interview', 'Offers'].map((label, index) => (
                <React.Fragment key={label}>
                  <View style={{ 
                    alignItems: 'center', 
                    flex: 1, 
                    flexDirection: 'row', 
                    justifyContent: 'center',
                    paddingHorizontal: label === 'Interview' ? 12 : 0
                  }}>
                    <Text style={{ fontSize: 20, color: Colors.ui.textPrimary, marginRight: 4, fontFamily: 'DMSans-Bold' }}>
                      {stats[label.toLowerCase() as keyof typeof stats]}
                    </Text>
                    <Text style={{ fontSize: 14, color: Colors.ui.textSecondary, fontFamily: 'DMSans-Bold' }}>
                      {label}
                    </Text>
                  </View>
                  {index < 2 && <View style={{ width: 1, height: 36, backgroundColor: Colors.ui.inputBorder }} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        </View>

        {/* ===== Gradient Header Card (Only shown when there are action-required notifications) ===== */}
        {hasAnyAction && (
          <View style={{ marginHorizontal: 20, marginVertical: 16 }}>
            <LinearGradient
            colors={[Colors.brand.primary, Colors.gradient.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 20,
              padding: 20,
              paddingVertical: 24,
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}
          >
            {/* User Profile and Action Alert Section */}
            <View style={{ flex: 1 }}>
              {/* Show Action Alert if there are pending actions */}
              {(hasSingleAction || hasMultipleActions) ? (
                <>
                  {/* Action Required Tag */}
                  <View style={{ 
                    backgroundColor: Colors.brand.secondary, 
                    alignSelf: 'flex-start', 
                    paddingHorizontal: 8, 
                    paddingVertical: 4, 
                    borderRadius: 12, 
                    marginBottom: 8,
                    flexDirection: 'row', 
                    alignItems: 'center' 
                  }}>
                    <View style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: 3, 
                      backgroundColor: Colors.semantic.success, 
                      marginRight: 6 
                    }} />
                    <Text style={{ 
                      color: Colors.ui.background, 
                      fontSize: 10, 
                      fontFamily: 'DMSans-SemiBold'
                    }}>
                      Action Required
                    </Text>
                  </View>

                  {/* Multiple Actions */}
                  {hasMultipleActions ? (
                    <>
                      <Text style={{ color: Colors.ui.background, fontSize: 18, fontFamily: 'DMSans-Bold', marginBottom: 4 }}>
                        {totalActions} pending updates
                      </Text>
                      <Text style={{ color: GRADIENT_TEXT_MUTED, fontSize: 13, fontFamily: 'DMSans-Regular', marginBottom: 16 }}>
                        {actionRequiredApps.length > 0 && hasUnreadMessages 
                          ? `${actionRequiredApps.length} application${actionRequiredApps.length > 1 ? 's' : ''} • ${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`
                          : actionRequiredApps.length > 0
                          ? `${actionRequiredApps.length} application update${actionRequiredApps.length > 1 ? 's' : ''}`
                          : `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`
                        }
                      </Text>
                    </>
                  ) : (
                    /* Single Action */
                    <>
                      {/* Show unread messages if that's the only action */}
                      {hasUnreadMessages && actionRequiredApps.length === 0 ? (
                        <>
                          <Text style={{ color: Colors.ui.background, fontSize: 18, fontFamily: 'DMSans-Bold', marginBottom: 4 }}>
                            {getActionTitle('unread_messages')}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                            <Ionicons name="mail-outline" size={13} color={GRADIENT_TEXT_MUTED} />
                            <Text style={{ color: GRADIENT_TEXT_MUTED, fontSize: 13, marginLeft: 6, fontFamily: 'DMSans-Regular' }}>
                              {unreadCount} unread message{unreadCount > 1 ? 's' : ''} from recruiters
                            </Text>
                          </View>
                        </>
                      ) : (
                        /* Show application action */
                        latestActionApp && (
                          <>
                            <Text style={{ color: Colors.ui.background, fontSize: 18, fontFamily: 'DMSans-Bold', marginBottom: 4 }}>
                              {getActionTitle(latestActionApp.status)}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                              {latestActionApp.status === 'interview_scheduled' && latestActionApp.interview?.scheduledAt && (
                                <>
                                  <Ionicons name="calendar-outline" size={13} color={GRADIENT_TEXT_MUTED} />
                                  <Text style={{ color: GRADIENT_TEXT_MUTED, fontSize: 13, marginLeft: 6, fontFamily: 'DMSans-Regular' }}>
                                    {formatDateTime(latestActionApp.interview.scheduledAt)}
                                  </Text>
                                  {latestActionApp.job?.hospital && (
                                    <>
                                      <Text style={{ color: GRADIENT_TEXT_MUTED, fontSize: 13, marginHorizontal: 6 }}>•</Text>
                                      <Text style={{ color: GRADIENT_TEXT_MUTED, fontSize: 13, fontFamily: 'DMSans-Regular' }}>
                                        {latestActionApp.job.hospital}
                                      </Text>
                                    </>
                                  )}
                                </>
                              )}
                              {latestActionApp.status === 'shortlisted' && latestActionApp.job?.hospital && (
                                <>
                                  <MaterialIcons name="location-on" size={13} color={GRADIENT_TEXT_MUTED} />
                                  <Text style={{ color: GRADIENT_TEXT_MUTED, fontSize: 13, marginLeft: 4, fontFamily: 'DMSans-Regular' }}>
                                    {latestActionApp.job.hospital}
                                  </Text>
                                </>
                              )}
                              {latestActionApp.status === 'rejected' && latestActionApp.job?.title && (
                                <Text style={{ color: GRADIENT_TEXT_MUTED, fontSize: 13, fontFamily: 'DMSans-Regular' }}>
                                  {latestActionApp.job.title}
                                </Text>
                              )}
                            </View>
                          </>
                        )
                      )}
                    </>
                  )}

                  {/* View Details Button (below the text) */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: Colors.ui.background,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      alignSelf: 'center',
                      width: '100%',
                    }}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (hasMultipleActions) {
                        // Navigate to applications if there are multiple actions
                        handleViewAllApplications();
                      } else if (hasUnreadMessages && actionRequiredApps.length === 0) {
                        // Navigate to messages if only unread messages
                        handleViewMessages();
                      } else if (latestActionApp) {
                        // Navigate to specific application
                        handleViewApplicationDetails(latestActionApp.id);
                      }
                    }}
                  >
                    <Text style={{ 
                      color: Colors.brand.primary, 
                      fontSize: 13,
                      fontFamily: 'DMSans-SemiBold',
                      marginRight: 6
                    }}>
                      {hasMultipleActions ? 'View All' : 'View Details'}
                    </Text>
                    <MaterialIcons name="arrow-forward" size={14} color={Colors.brand.primary} />
                  </TouchableOpacity>
                </>
              ) : (
                /* Default Greeting */
                <>
                  <Text style={{ color: Colors.ui.background, fontSize: 18, fontFamily: 'DMSans-Bold' }}>
                    Hi, {user?.fullName || 'Dr. User'}
                  </Text>
                  <Text style={{ color: GRADIENT_TEXT_MUTED, fontSize: 14, marginTop: 2, fontFamily: 'DMSans-Regular' }}>
                    Welcome Back
                  </Text>
                </>
              )}
            </View>
          </LinearGradient>
        </View>
        )}

        {/* ===== Interview Alert ===== */}
        {hasScheduledInterviews && (
          <View style={{ marginHorizontal: 20, marginVertical: 16 }}>
            <View style={{ 
              backgroundColor: Colors.brand.primary, 
              borderRadius: 16, 
              padding: 20,
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}>
              <View style={{ 
                backgroundColor: Colors.brand.secondary, 
                alignSelf: 'flex-start', 
                paddingHorizontal: 12, 
                paddingVertical: 6, 
                borderRadius: 16, 
                marginBottom: 12, 
                flexDirection: 'row', 
                alignItems: 'center' 
              }}>
                <View style={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: 4, 
                  backgroundColor: Colors.semantic.success, 
                  marginRight: 8 
                }} />
                <Text style={{ 
                  color: Colors.ui.background, 
                  fontSize: 12, 
                  fontFamily: 'DMSans-SemiBold'
                }}>
                  Action Required
                </Text>
              </View>

              <Text style={{ 
                color: Colors.ui.background, 
                fontSize: 24, 
                marginBottom: 8,
                fontFamily: 'DMSans-Bold'
              }}>
                Interview Scheduled
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="calendar-outline" size={16} color={GRADIENT_TEXT_MUTED} />
                <Text style={{ color: GRADIENT_TEXT_MUTED, fontSize: 14, marginLeft: 8, fontFamily: 'DMSans-Regular' }}>
                  {scheduledInterview?.interview?.scheduledAt 
                    ? new Date(scheduledInterview.interview.scheduledAt).toLocaleString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric', 
                        hour: 'numeric', 
                        minute: '2-digit', 
                        hour12: true 
                      })
                    : 'Date TBD'}
                </Text>

                <MaterialIcons
                  name="location-on"
                  size={16}
                  color={GRADIENT_TEXT_MUTED}
                  style={{ marginLeft: 12 }}
                />
                <Text style={{ color: GRADIENT_TEXT_MUTED, fontSize: 14, marginLeft: 4, fontFamily: 'DMSans-Regular' }}>
                  {scheduledInterview?.job?.hospital || 'Location TBD'}
                </Text>
              </View>

              <TouchableOpacity
                style={{ 
                  backgroundColor: Colors.ui.background, 
                  borderRadius: 12, 
                  paddingVertical: 12, 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
                activeOpacity={0.8}
                onPress={handleInterviewDetails}
              >
                <Text style={{ 
                  color: Colors.brand.primary, 
                  marginRight: 8,
                  fontFamily: 'DMSans-SemiBold'
                }}>
                  View Interview Details
                </Text>
                <MaterialIcons
                  name="arrow-forward"
                  size={18}
                  color={Colors.brand.primary}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ===== Career Health ===== */}
        <View style={{ marginHorizontal: 20, marginVertical: 16 }}>
          <Text style={{ fontSize: 18, color: Colors.ui.textPrimary, marginBottom: 12, fontFamily: 'DMSans-Bold' }}>
            Career Health
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {careerHealth.map((item, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: item.bgColor,
                  borderRadius: 16,
                  padding: 14,
                  flex: 1,
                  alignItems: 'center',
                  marginRight: index < careerHealth.length - 1 ? 10 : 0,
                  shadowColor: '#000',
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                  borderWidth: 1,
                  borderColor: Colors.ui.inputBorder,
                }}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: item.iconColor + '20',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 8,
                }}>
                  <MaterialIcons
                    name={item.icon}
                    size={20}
                    color={item.iconColor}
                  />
                </View>
                <Text style={{ fontSize: 20, color: Colors.ui.textPrimary, marginBottom: 2, fontFamily: 'DMSans-Bold' }}>
                  {item.value}
                </Text>
                <Text style={{ fontSize: 11, color: Colors.ui.textSecondary, textAlign: 'center', fontFamily: 'DMSans-Medium' }}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ===== Recommended Jobs ===== */}
        <View style={{ marginHorizontal: 20, marginVertical: 16, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="stars" size={22} color={Colors.brand.tertiary} />
              <Text style={{ fontSize: 18, color: Colors.ui.textPrimary, marginLeft: 8, fontFamily: 'DMSans-Bold' }}>
                Recommended Jobs
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleSeeAll}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Text style={{ color: Colors.brand.tertiary, fontFamily: 'DMSans-SemiBold' }}>
                See all
              </Text>
              <MaterialIcons
                name="arrow-forward"
                size={18}
                color={Colors.brand.tertiary}
              />
            </TouchableOpacity>
          </View>

          {/* Jobs List */}
          {jobsLoading && !refreshing ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={Colors.brand.primary} />
              <Text style={{ color: Colors.ui.textSecondary, marginTop: 8, fontFamily: 'DMSans-Regular' }}>Loading jobs...</Text>
            </View>
          ) : jobsError ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <MaterialIcons name="error-outline" size={48} color={Colors.semantic.error} />
              <Text style={{ color: Colors.ui.textSecondary, marginTop: 8, fontFamily: 'DMSans-Regular' }}>{jobsError}</Text>
              <TouchableOpacity
                style={{ marginTop: 16, backgroundColor: Colors.brand.tertiary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                onPress={refreshJobs}
              >
                <Text style={{ color: Colors.ui.background, fontFamily: 'DMSans-SemiBold' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : recommendedJobs.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <MaterialIcons name="work-outline" size={48} color={Colors.ui.placeholder} />
              <Text style={{ color: Colors.ui.textSecondary, marginTop: 8, fontFamily: 'DMSans-Regular' }}>No jobs available yet</Text>
            </View>
          ) : (
            recommendedJobs.map((job) => {
              const applicationForJob = applications.find(app => app.jobId === job.id);
              const applicationStatus = applicationForJob?.status || null;
              const shouldShowStatus = applicationStatus && !INACTIVE_APPLICATION_STATUSES.has(applicationStatus);
              return (
                <JobCard
                  key={job.id}
                  {...job}
                  applicationStatus={shouldShowStatus ? applicationStatus : null}
                  onViewProfile={() => handleViewProfile(job.id)}
                  onInvite={() => handleApply(job.id, job.title, job.hospital)}
                />
              );
            })
          )}
        </View>
      </ScrollView>
    </>
  );
};

export default HomePage;
