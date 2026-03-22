// src/models/Doctor.model.ts
// Doctor Profile Model - Doctor-specific information

import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './User.model';
import {
  Gender,
  Address,
  AadhaarInfo,
  Education,
  License,
  Skill,
  WorkExperience,
  PlatformStats,
  CareerPreferences,
  EmergencyContact,
  BankDetails,
  ProfileSections,
} from './types';

export class Doctor extends Model<
  InferAttributes<Doctor>,
  InferCreationAttributes<Doctor>
> {
  // Primary key
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User['id']>;

  // Personal Information
  declare firstName: CreationOptional<string | null>;
  declare lastName: CreationOptional<string | null>;
  declare gender: CreationOptional<Gender | null>;
  declare dateOfBirth: CreationOptional<string | null>;

  // Address
  declare address: CreationOptional<Address>;

  // Aadhaar Verification
  declare aadhaar: CreationOptional<AadhaarInfo>;
  declare aadhaarNumber: CreationOptional<string | null>; // Encrypted

  // Professional Information
  declare specialization: CreationOptional<string | null>;
  declare subSpecializations: CreationOptional<string[]>;
  declare designation: CreationOptional<string | null>;
  declare currentHospital: CreationOptional<string | null>;

  // Education & Training
  declare education: CreationOptional<Education[]>;

  // Licenses & Certifications
  declare licenses: CreationOptional<License[]>;

  // Skills
  declare skills: CreationOptional<Skill[]>;

  // Work Experience
  declare workExperience: CreationOptional<WorkExperience[]>;

  // Platform Statistics
  declare platformStats: CreationOptional<PlatformStats>;

  // Bio
  declare bio: CreationOptional<string | null>;

  // Career Preferences
  declare careerPreferences: CreationOptional<CareerPreferences>;

  // Emergency Contact
  declare emergencyContact: CreationOptional<EmergencyContact>;

  // Bank Details
  declare bankDetails: CreationOptional<BankDetails>;
  declare bankAccountNumber: CreationOptional<string | null>; // Encrypted

  // Profile Sections Completion
  declare profileSections: CreationOptional<ProfileSections>;

  // Geolocation (for geodesic distance matching — mirrors CareChainX CandidateProfile)
  declare latitude: CreationOptional<number | null>;
  declare longitude: CreationOptional<number | null>;

  // Search & Discovery
  declare isSearchable: CreationOptional<boolean>;
  declare yearsOfExperience: CreationOptional<number>;
  declare searchTags: CreationOptional<string[]>;

  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare user?: NonAttribute<User>;

  // Virtuals (excluded from model attributes)
  declare readonly fullAddress: NonAttribute<string | null>;
  declare readonly displayName: NonAttribute<string>;

  // Get full address
  getFullAddress(): string | null {
    const addr = this.address;
    if (!addr) return null;
    return [addr.street, addr.city, addr.state, addr.pincode]
      .filter(Boolean)
      .join(', ');
  }

  // Get display name with title
  getDisplayName(): string {
    return `Dr. ${this.firstName || ''} ${this.lastName || ''}`.trim();
  }

  // Calculate profile completion
  calculateProfileCompletion(): number {
    const sections = this.profileSections || {};
    const completedSections = Object.values(sections).filter(Boolean).length;
    const totalSections = Object.keys(sections).length || 7;
    return Math.round((completedSections / totalSections) * 100);
  }
}

Doctor.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other', 'prefer_not_to_say'),
      allowNull: true,
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    address: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    aadhaar: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    aadhaarNumber: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    specialization: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    subSpecializations: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    designation: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    currentHospital: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    education: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    licenses: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    skills: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    workExperience: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    platformStats: {
      type: DataTypes.JSONB,
      defaultValue: {
        jobsCompleted: 0,
        totalShifts: 0,
        noShows: 0,
        attendanceRate: 100,
        rating: 0,
        totalReviews: 0,
        performanceScore: 0,
      },
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: { len: [0, 500] },
    },
    careerPreferences: {
      type: DataTypes.JSONB,
      defaultValue: {
        shortTermJobs: true,
        longTermJobs: true,
        paymentPreference: 'per_hour',
        expectedHourlyRate: null,
        expectedDailyRate: null,
        expectedMonthlyRate: null,
        expectedPerPatientRate: null,
        mealsIncluded: false,
        transportIncluded: false,
        accommodationIncluded: false,
        experienceYears: null,
        availability: {
          isAvailable: true,
          availableFrom: null,
          availableUntil: null,
          weeklyHours: null,
          preferredDays: [],
          preferredShifts: [],
          noticePeriod: null,
        },
        preferredLocations: [],
        willingToRelocate: false,
        willingToTravel: false,
        jobStatus: 'available',
      },
    },
    emergencyContact: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    bankDetails: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    bankAccountNumber: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    profileSections: {
      type: DataTypes.JSONB,
      defaultValue: {
        personal: false,
        education: false,
        licensure: false,
        skills: false,
        experience: false,
        preferences: false,
        documents: false,
      },
    },
    latitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
    },
    isSearchable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    yearsOfExperience: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    searchTags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Doctor',
    tableName: 'doctors',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'], unique: true },
      { fields: ['specialization'] },
      { fields: ['years_of_experience'] },
      { fields: ['is_searchable'] },
      { fields: ['latitude', 'longitude'] },
      { fields: ['specialization', 'is_searchable'] }, // composite for recommendation queries
      {
        name: 'doctors_address_city_idx',
        fields: [sequelize.literal("(address->>'city')")],
      },
      {
        name: 'doctors_address_state_idx',
        fields: [sequelize.literal("(address->>'state')")],
      },
      {
        name: 'doctors_search_tags_gin_idx',
        fields: [sequelize.literal('search_tags')],
        using: 'gin',
      },
      {
        name: 'doctors_skills_gin_idx',
        fields: [sequelize.literal('skills')],
        using: 'gin',
      },
    ],
    hooks: {
      beforeSave: (doctor: Doctor) => {
        // Sync lat/lng from address.coordinates when present
        if (doctor.address?.coordinates) {
          doctor.latitude = doctor.address.coordinates.lat;
          doctor.longitude = doctor.address.coordinates.lng;
        }
      },
    },
  }
);

export default Doctor;
