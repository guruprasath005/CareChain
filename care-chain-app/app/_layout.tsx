import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import '../global.css';

// Suppress specific warnings
LogBox.ignoreLogs([
	'Animated: `useNativeDriver` was not specified',
	'connectAnimatedNodes',
	'Animated.event now requires a second argument for options',
	'Unknown child element passed to Stack',
]);

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 60_000,      // 1 minute before data is considered stale
			gcTime: 5 * 60_000,     // 5 minutes before inactive queries are garbage collected
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
	const { isLoading, isAuthenticated, user } = useAuth();
	const [fontsLoaded, fontError] = useFonts({
		'DM Sans': require('../assets/fonts/DMSans-Regular.ttf'),
		'DM Sans_medium': require('../assets/fonts/DMSans-Medium.ttf'),
		'DM Sans_semibold': require('../assets/fonts/DMSans-SemiBold.ttf'),
		'DM Sans_bold': require('../assets/fonts/DMSans-Bold.ttf'),
		'DMSans-Regular': require('../assets/fonts/DMSans-Regular.ttf'),
		'DMSans-Medium': require('../assets/fonts/DMSans-Medium.ttf'),
		'DMSans-SemiBold': require('../assets/fonts/DMSans-SemiBold.ttf'),
		'DMSans-Bold': require('../assets/fonts/DMSans-Bold.ttf'),
	});

	useEffect(() => {
		if (fontError) {
			console.error('Font loading error:', fontError);
		}
		if (fontsLoaded) {
			console.log('Fonts loaded successfully!');
		}
	}, [fontsLoaded, fontError]);

	useEffect(() => {
		if (!isLoading && fontsLoaded) {
			SplashScreen.hideAsync();
		}
	}, [isLoading, fontsLoaded]);

	if (isLoading || !fontsLoaded) {
		return (
			<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
				<ActivityIndicator size="large" color="#1A1464" />
				<Text style={{ marginTop: 20, color: '#4b5563', textAlign: 'center' }}>
					{fontError ? 'Font Error!' : 'Loading...'}
				</Text>
				<Text style={{ marginTop: 8, fontSize: 12, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 32 }}>
					Connecting to server…
				</Text>
			</View>
		);
	}

	return (
		<View style={{ flex: 1, backgroundColor: '#ffffff' }}>
			<StatusBar style="light" backgroundColor="#1e3a8a" />
			{/* <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 999, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10 }}>
				<Text style={{ color: 'white' }}>IsLoading: {String(isLoading)}</Text>
				<Text style={{ color: 'white' }}>Auth: {String(isAuthenticated)}</Text>
				<Text style={{ color: 'white' }}>User: {user ? user.email : 'null'}</Text>
			</View> */}
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: { backgroundColor: '#ffffff' },
				}}
			/>
		</View>
	);
}

export default function RootLayout() {
	return (
		<SafeAreaProvider>
			<QueryClientProvider client={queryClient}>
				<AuthProvider>
					<RootLayoutNav />
				</AuthProvider>
			</QueryClientProvider>
		</SafeAreaProvider>
	);
}
