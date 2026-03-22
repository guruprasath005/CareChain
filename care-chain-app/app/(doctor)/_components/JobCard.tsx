

import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

export type JobCardProps = {
  title: string;
  hospital: string;
  location: string;
  experience: string;
  salary: string;
  avatar?: string | null;
  onViewProfile: () => void;
  onInvite: () => void;
  applicationStatus?: 'applied' | 'under_review' | 'shortlisted' | 'interview_scheduled' | 'interviewed' | 'offer_made' | 'hired' | 'rejected' | 'withdrawn' | null;
  [key: string]: unknown; // allow extra data without type errors
};

const JobCard: React.FC<JobCardProps> = ({
  title,
  hospital,
  location,
  experience,
  salary,
  avatar = null,
  onViewProfile,
  onInvite,
  applicationStatus = null,
}) => {
  return (
    <View style={{ backgroundColor: Colors.ui.background, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Avatar */}
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.ui.backgroundGray, marginRight: 12, overflow: 'hidden' }}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <View style={{ width: '100%', height: '100%', backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: Colors.brand.tertiary, fontWeight: '600', fontSize: 18 }}>
                {title?.charAt(0) || 'J'}
              </Text>
            </View>
          )}
        </View>
        
        {/* Job Details */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.ui.textPrimary, marginBottom: 4 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 14, color: Colors.ui.textSecondary, marginBottom: 8 }}>{hospital}</Text>
          
          {/* Location & Experience */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
              <MaterialIcons name="location-on" size={14} color={Colors.ui.textSecondary} />
              <Text style={{ fontSize: 12, color: Colors.ui.textSecondary, marginLeft: 4 }}>{location}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="time-outline" size={14} color={Colors.ui.textSecondary} />
              <Text style={{ fontSize: 12, color: Colors.ui.textSecondary, marginLeft: 4 }}>{experience}</Text>
            </View>
          </View>
          
          {/* Salary */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <FontAwesome name="rupee" size={14} color={Colors.ui.textPrimary} />
            <Text style={{ fontSize: 14, color: Colors.ui.textPrimary, fontWeight: '500', marginLeft: 4 }}>
              {salary.replace('₹', '').trim()}
            </Text>
          </View>
          
          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              onPress={onViewProfile}
              style={{ flex: 1, backgroundColor: Colors.ui.background, borderWidth: 1, borderColor: Colors.brand.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.brand.primary }}>
                Details
              </Text>
            </TouchableOpacity>
            
            {applicationStatus === 'hired' ? null : (
              <TouchableOpacity 
                onPress={onInvite}
                style={{ 
                  flex: 1, 
                  borderRadius: 8, 
                  paddingVertical: 10, 
                  alignItems: 'center',
                  backgroundColor: applicationStatus ? Colors.ui.disabled : Colors.brand.primary
                }}
                activeOpacity={applicationStatus ? 1 : 0.8}
                disabled={!!applicationStatus}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.ui.background }}>
                  {applicationStatus ? 'Applied' : 'Apply'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

export default JobCard;
