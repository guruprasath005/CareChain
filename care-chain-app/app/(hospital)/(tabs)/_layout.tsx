import { Slot, useRouter, usePathname } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Image,
  ImageBackground,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/hooks/useMessages';
import { useHospitalProfile } from '@/hooks';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { unreadCount } = useConversations();
  const { profile } = useHospitalProfile();
  const insets = useSafeAreaInsets();

  // Get display name - use fullName or first part of email
  const displayName = user?.fullName || user?.email?.split('@')[0] || 'Hospital';


  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* ================= Top Bar ================= */}
      <ImageBackground
        source={require('../../assets/images/top-bg_.png')}
        resizeMode="cover"
        className="rounded-b-3xl overflow-hidden"
        style={{ 
          paddingTop: insets.top,
          backgroundColor: '#1e3a8a'
        }}
      >
        <View className="px-4 pt-4 pb-8">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              activeOpacity={0.85}
              className="flex-row items-center rounded-full border border-white/60 bg-white/10 pl-2 pr-4 py-2"
              onPress={() => router.push('/(hospital)/(tabs)/home')}
            >
              <View className="h-10 w-10 rounded-full border-2 border-white/70 overflow-hidden bg-white/10">
                <Image
                  source={profile?.avatar ? { uri: profile.avatar } : require('../../assets/images/logo.png')}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              </View>
              <View className="ml-3">
                <Text className="text-white text-sm font-semibold">
                  Hi {displayName},
                </Text>
                <Text className="text-blue-200 text-[10px]">
                  Welcome Back
                </Text>
              </View>
            </TouchableOpacity>

            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                activeOpacity={0.85}
                className="h-12 w-12 rounded-full border border-white/60 bg-white/10 items-center justify-center"
                onPress={() => router.push({ pathname: '/(hospital)/messages', params: { tab: 'notifications' } })}
              >
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color="#ffffff"
                />
                {unreadCount > 0 && (
                  <View className="absolute top-2 right-2 h-4 min-w-[16px] px-1 rounded-full bg-red-500 items-center justify-center border border-blue-900">
                    <Text className="text-white text-[10px] font-bold">{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                className="h-12 w-12 rounded-full border border-white/60 bg-white/10 items-center justify-center"
                onPress={() => router.push('/(hospital)/settings')}
              >
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color="#ffffff"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ImageBackground>

      {/* ================= Main Content ================= */}
      <View className="flex-1">
        <Slot />
      </View>

      {/* ================= Bottom Navigation ================= */}
      <View
        className="bg-white border-t border-gray-200 flex-row justify-around pt-3 rounded-t-3xl"
        style={[
          { paddingBottom: Math.max(insets.bottom, 16) },
          Platform.OS === 'android'
            ? { elevation: 10 }
            : {
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: -4 },
            }
        ]}
      >
        {/* Home */}
        <Tab
          icon="home-outline"
          label="Home"
          active={pathname === '/' || pathname.endsWith('/home')}
          onPress={() => router.push('/(hospital)/(tabs)/home')}
        />

        {/* Job Posted */}
        <Tab
          icon="briefcase-outline"
          label="Job Posted"
          active={pathname.endsWith('/jobs')}
          onPress={() => router.push('/(hospital)/(tabs)/jobs')}
        />

        {/* Search */}
        <Tab
          icon="search-outline"
          label="Search"
          active={pathname.endsWith('/search')}
          onPress={() => router.push('/(hospital)/(tabs)/search')}
        />

        {/* Employee */}
        <Tab
          icon="people-outline"
          label="Employee"
          active={pathname.endsWith('/employees')}
          onPress={() => router.push('/(hospital)/(tabs)/employees')}
        />

        {/* Message */}
        <Tab
          icon="chatbubble-ellipses-outline"
          label="Message"
          active={pathname.endsWith('/messages')}
          onPress={() => router.push('/(hospital)/messages')}
        />
      </View>

    </View>
  );
}

/* ================= Tab Component ================= */

function Tab({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="items-center flex-1"
    >
      <View
        style={[
          {
            height: 52,
            width: 52,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ translateY: active ? 0 : 0 }],
          },
          active && {
            backgroundColor: '#1e3a8a', // blue-900
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={24}
          color={active ? '#ffffff' : '#6b7280'}
        />
      </View>

      <Text
        className={`text-xs mt-1 ${active ? 'text-blue-900 font-semibold' : 'text-gray-800'
          }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
