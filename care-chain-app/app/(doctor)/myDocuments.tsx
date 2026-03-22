import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StatusBar,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useDoctorProfile } from '../../hooks';

export default function MyDocumentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useDoctorProfile();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserDocuments();
  }, []);

  const fetchUserDocuments = async () => {
    try {
      setLoading(true);
      
      // Extract documents from various sections of the profile
      const userDocuments = [];
      
      if (profile) {
        // Add license documents
        if (profile.licenses && profile.licenses.length > 0) {
          profile.licenses.forEach((license, index) => {
            if (license.documentUrl) {
              userDocuments.push({
                id: `license-${index}`,
                name: license.name || 'Medical License',
                type: 'License',
                status: license.isVerified ? 'Verified' : 'Pending Review',
                uploadDate: license.issueDate || new Date().toISOString().split('T')[0],
                expiryDate: license.expiryDate || license.validTill,
                fileSize: 'Unknown',
                fileType: 'PDF',
                url: license.documentUrl,
                registrationNumber: license.registrationNumber,
                issuingAuthority: license.issuingBody || license.issuingAuthority
              });
            }
          });
        }

        // Add education documents
        if (profile.education && profile.education.length > 0) {
          profile.education.forEach((edu, index) => {
            if (edu.documentUrl) {
              userDocuments.push({
                id: `education-${index}`,
                name: `${edu.degree} Certificate`,
                type: 'Certification',
                status: edu.isVerified ? 'Verified' : 'Pending Review',
                uploadDate: new Date().toISOString().split('T')[0],
                expiryDate: null,
                fileSize: 'Unknown',
                fileType: 'PDF',
                url: edu.documentUrl,
                institution: edu.institution,
                specialization: edu.specialization
              });
            }
          });
        }

        // Add experience documents
        if (profile.experience && profile.experience.length > 0) {
          profile.experience.forEach((exp, expIndex) => {
            if (exp.documents && exp.documents.length > 0) {
              exp.documents.forEach((doc, docIndex) => {
                userDocuments.push({
                  id: `experience-${expIndex}-${docIndex}`,
                  name: doc.title || 'Experience Document',
                  type: 'Resume',
                  status: exp.isVerified ? 'Verified' : 'Pending Review',
                  uploadDate: doc.uploadedAt || new Date().toISOString().split('T')[0],
                  expiryDate: null,
                  fileSize: doc.size || 'Unknown',
                  fileType: 'PDF',
                  url: doc.url,
                  fileName: doc.fileName,
                  institution: exp.institution
                });
              });
            }
          });
        }

        // Add any other documents from profile.documents if it exists
        if (profile.documents && Array.isArray(profile.documents)) {
          profile.documents.forEach((doc, index) => {
            userDocuments.push({
              id: `document-${index}`,
              name: doc.name || doc.title || 'Document',
              type: doc.type || 'Other',
              status: doc.isVerified ? 'Verified' : doc.status || 'Pending Review',
              uploadDate: doc.uploadedAt || doc.uploadDate || new Date().toISOString().split('T')[0],
              expiryDate: doc.expiryDate,
              fileSize: doc.size || doc.fileSize || 'Unknown',
              fileType: doc.fileType || 'PDF',
              url: doc.url,
              fileName: doc.fileName
            });
          });
        }
      }
      
      setDocuments(userDocuments);
    } catch (error) {
      console.error('Error fetching documents:', error);
      Alert.alert('Error', 'Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Verified':
        return 'text-green-600';
      case 'Pending Review':
        return 'text-yellow-600';
      case 'Expired':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Verified':
        return 'checkmark-circle';
      case 'Pending Review':
        return 'time';
      case 'Expired':
        return 'alert-circle';
      default:
        return 'document';
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'License':
        return 'card';
      case 'Certification':
        return 'ribbon';
      case 'Resume':
        return 'person';
      case 'Insurance':
        return 'shield-checkmark';
      case 'Certificate':
        return 'medal';
      default:
        return 'document-text';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleDocumentPress = (document: any) => {
    const details = [
      `Type: ${document.type}`,
      `Status: ${document.status}`,
      `Uploaded: ${formatDate(document.uploadDate)}`,
      `Size: ${document.fileSize}`
    ];

    if (document.expiryDate) {
      details.push(`Expires: ${formatDate(document.expiryDate)}`);
    }

    if (document.registrationNumber) {
      details.push(`Registration: ${document.registrationNumber}`);
    }

    if (document.issuingAuthority) {
      details.push(`Issued by: ${document.issuingAuthority}`);
    }

    if (document.institution) {
      details.push(`Institution: ${document.institution}`);
    }

    Alert.alert(
      document.name,
      details.join('\n'),
      [
        { text: 'View', onPress: () => viewDocument(document) },
        { text: 'Download', onPress: () => downloadDocument(document) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const viewDocument = (document: any) => {
    if (document.url) {
      // TODO: Implement document viewer or open in browser
      Alert.alert('View Document', `Opening ${document.name}...`);
      // You could use Linking.openURL(document.url) or implement an in-app viewer
    } else {
      Alert.alert('Error', 'Document URL not available');
    }
  };

  const downloadDocument = (document: any) => {
    if (document.url) {
      // TODO: Implement document download functionality
      Alert.alert('Download Document', `Downloading ${document.name}...`);
      // You could use FileSystem.downloadAsync or similar
    } else {
      Alert.alert('Error', 'Document URL not available');
    }
  };

  const handleUploadDocument = () => {
    Alert.alert(
      'Upload Document',
      'Choose document type to upload',
      [
        { text: 'Medical License', onPress: () => uploadDocument('License') },
        { text: 'Certification', onPress: () => uploadDocument('Certification') },
        { text: 'Resume/CV', onPress: () => uploadDocument('Resume') },
        { text: 'Insurance', onPress: () => uploadDocument('Insurance') },
        { text: 'Other', onPress: () => uploadDocument('Other') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const uploadDocument = async (type: string) => {
    try {
      // TODO: Implement actual document upload functionality
      // This would typically involve:
      // 1. Opening document picker
      // 2. Uploading file to server
      // 3. Updating user's document list
      
      Alert.alert(
        'Upload Document',
        `Document upload for ${type} will be implemented with file picker and API integration.`,
        [{ text: 'OK' }]
      );
      
      // After successful upload, refresh the documents list
      // await fetchUserDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'Failed to upload document. Please try again.');
    }
  };

  const EmptyDocumentsState = () => (
    <View className="flex-1 items-center justify-center py-12">
      <View className="h-20 w-20 rounded-full bg-gray-100 items-center justify-center mb-6">
        <Ionicons name="document-text-outline" size={40} color="#9ca3af" />
      </View>
      <Text className="text-gray-900 text-lg font-semibold mb-2">No Documents Yet</Text>
      <Text className="text-gray-500 text-sm text-center mb-8 px-8 leading-6">
        Upload your medical license, certifications, and other required documents to get started.
      </Text>
      <Pressable
        className="rounded-xl bg-blue-900 px-6 py-3"
        onPress={handleUploadDocument}
      >
        <Text className="text-white font-semibold">Upload First Document</Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
        
        {/* Header */}
        <View className="bg-blue-900 px-4 pt-4 pb-6 rounded-b-3xl">
          <View className="flex-row items-center justify-between">
            <Pressable 
              className="h-11 w-11 rounded-full bg-white/10 border border-white/20 items-center justify-center"
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </Pressable>

            <Text className="text-white text-lg font-semibold">My Documents</Text>

            <View className="h-11 w-11" />
          </View>
        </View>

        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text className="text-gray-500 mt-4">Loading documents...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />

      {/* Header */}
      <View className="bg-blue-900 px-4 pt-4 pb-6 rounded-b-3xl">
        <View className="flex-row items-center justify-between">
          <Pressable 
            className="h-11 w-11 rounded-full bg-white/10 border border-white/20 items-center justify-center"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>

          <Text className="text-white text-lg font-semibold">My Documents</Text>

          <Pressable 
            className="h-11 w-11 rounded-full bg-white/10 border border-white/20 items-center justify-center"
            onPress={handleUploadDocument}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
        {documents.length === 0 ? (
          <EmptyDocumentsState />
        ) : (
          <>
            {/* Summary Stats */}
            <View className="flex-row gap-3 mb-6">
              <View className="flex-1 rounded-2xl bg-white border border-gray-100 p-4">
                <Text className="text-2xl font-bold text-gray-900 mb-1">
                  {documents.filter(doc => doc.status === 'Verified').length}
                </Text>
                <Text className="text-gray-500 text-xs">Verified</Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white border border-gray-100 p-4">
                <Text className="text-2xl font-bold text-yellow-600 mb-1">
                  {documents.filter(doc => doc.status === 'Pending Review').length}
                </Text>
                <Text className="text-gray-500 text-xs">Pending</Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white border border-gray-100 p-4">
                <Text className="text-2xl font-bold text-red-600 mb-1">
                  {documents.filter(doc => doc.status === 'Expired').length}
                </Text>
                <Text className="text-gray-500 text-xs">Expired</Text>
              </View>
            </View>

            {/* Documents List */}
            <View className="rounded-2xl bg-white border border-gray-100 overflow-hidden mb-6">
              <View className="px-4 py-3 border-b border-gray-100">
                <Text className="text-gray-900 font-semibold">All Documents</Text>
              </View>

              {documents.map((document, index) => (
                <Pressable
                  key={document.id}
                  className={`px-4 py-4 flex-row items-center ${
                    index < documents.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                  onPress={() => handleDocumentPress(document)}
                >
                  {/* Document Icon */}
                  <View className="h-12 w-12 rounded-xl bg-blue-50 items-center justify-center mr-3">
                    <Ionicons 
                      name={getDocumentIcon(document.type)} 
                      size={20} 
                      color="#1e3a8a" 
                    />
                  </View>

                  {/* Document Info */}
                  <View className="flex-1">
                    <Text className="text-gray-900 font-semibold text-sm mb-1">
                      {document.name}
                    </Text>
                    <Text className="text-gray-500 text-xs mb-1">
                      {document.type} • {document.fileSize} • {formatDate(document.uploadDate)}
                    </Text>
                    {document.expiryDate && (
                      <Text className="text-gray-400 text-xs">
                        Expires: {formatDate(document.expiryDate)}
                      </Text>
                    )}
                  </View>

                  {/* Status */}
                  <View className="items-end">
                    <View className="flex-row items-center mb-1">
                      <Ionicons 
                        name={getStatusIcon(document.status)} 
                        size={16} 
                        color={getStatusColor(document.status).replace('text-', '#')} 
                      />
                      <Text className={`ml-1 text-xs font-medium ${getStatusColor(document.status)}`}>
                        {document.status}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Upload New Document Button - Always show */}
        <Pressable
          className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 py-8 items-center mb-6"
          onPress={handleUploadDocument}
        >
          <View className="h-12 w-12 rounded-full bg-blue-100 items-center justify-center mb-3">
            <Ionicons name="cloud-upload" size={24} color="#1e3a8a" />
          </View>
          <Text className="text-gray-900 font-semibold mb-1">
            {documents.length === 0 ? 'Upload Your First Document' : 'Upload New Document'}
          </Text>
          <Text className="text-gray-500 text-xs text-center px-4">
            Add licenses, certifications, insurance, or other required documents
          </Text>
        </Pressable>

        {/* Help Section */}
        <View className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
          <View className="flex-row items-center mb-2">
            <Ionicons name="information-circle" size={18} color="#1e3a8a" />
            <Text className="ml-2 text-blue-900 font-semibold">Document Requirements</Text>
          </View>
          <Text className="text-blue-800 text-xs leading-5">
            • All documents must be in PDF format{'\n'}
            • Maximum file size: 10MB{'\n'}
            • Keep documents up to date to maintain verification status{'\n'}
            • Contact support if you need help with document verification
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}