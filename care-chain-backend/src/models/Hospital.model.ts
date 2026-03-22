// src/models/Hospital.model.ts
// Hospital Profile Model - Hospital-specific information

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
  HospitalType,
  VerificationStatus,
  Address,
  HospitalLicense,
  NABHAccreditation,
  Representative,
  ContactPerson,
  Infrastructure,
  HospitalStats,
  HospitalProfileSections,
} from './types';

// Additional Hospital-specific interfaces
interface Facilities {
  parking?: boolean;
  ambulance?: boolean;
  pharmacy24x7?: boolean;
  bloodBank?: boolean;
  canteen?: boolean;
  wifi?: boolean;
  atm?: boolean;
  wheelchairAccess?: boolean;
  [key: string]: boolean | undefined;
}

interface Department {
  name: string;
  headName?: string;
  contactNumber?: string;
  isActive: boolean;
}

interface Staffing {
  totalDoctors?: number;
  totalNurses?: number;
  totalStaff?: number;
  [key: string]: number | undefined;
}

interface Credentials {
  [key: string]: unknown;
}

interface GalleryImage {
  url: string;
  caption?: string;
  uploadedAt: string;
}

interface WorkingHours {
  [day: string]: {
    isOpen: boolean;
    openTime?: string;
    closeTime?: string;
  };
}

interface GSTDetails {
  gstNumber?: string;
  isVerified: boolean;
  documentUrl?: string;
}

interface PANDetails {
  isVerified: boolean;
  documentUrl?: string;
}

interface HospitalImages {
  logo?: string;
  banner?: string;
  gallery?: string[];
}

interface HiringPreferences {
  preferredExperience?: number;
  preferredQualifications?: string[];
  autoShortlist?: boolean;
  [key: string]: unknown;
}

export class Hospital extends Model<
  InferAttributes<Hospital>,
  InferCreationAttributes<Hospital>
> {
  // Primary key
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User['id']>;

  // Basic Information
  declare hospitalName: CreationOptional<string | null>;
  declare hospitalType: CreationOptional<HospitalType>;
  declare hospitalTypeOther: CreationOptional<string | null>;
  declare website: CreationOptional<string | null>;

  // Registration & Licensing
  declare registrationNumber: CreationOptional<string | null>;
  declare establishedYear: CreationOptional<number | null>;
  declare hospitalLicense: CreationOptional<HospitalLicense>;
  declare nabhAccreditation: CreationOptional<NABHAccreditation>;

  // Representative
  declare representative: CreationOptional<Representative>;

  // Location
  declare address: CreationOptional<Address>;
  declare latitude: CreationOptional<number | null>;
  declare longitude: CreationOptional<number | null>;

  // Contact
  declare contactPersons: CreationOptional<ContactPerson[]>;

  // Details
  declare description: CreationOptional<string | null>;
  declare infrastructure: CreationOptional<Infrastructure>;
  declare facilities: CreationOptional<Facilities>;
  declare departments: CreationOptional<Department[]>;
  declare specialties: CreationOptional<string[]>;
  declare specialtiesOther: CreationOptional<string | null>;

  // Staffing
  declare staffing: CreationOptional<Staffing>;

  // Credentials
  declare credentials: CreationOptional<Credentials>;

  // Gallery
  declare facilityGallery: CreationOptional<GalleryImage[]>;

  // Operations
  declare workingHours: CreationOptional<WorkingHours>;

  // Tax Details
  declare gstDetails: CreationOptional<GSTDetails>;
  declare panDetails: CreationOptional<PANDetails>;
  declare panNumber: CreationOptional<string | null>; // Encrypted

  // Statistics
  declare hospitalStats: CreationOptional<HospitalStats>;

  // Images
  declare images: CreationOptional<HospitalImages>;

  // Hiring
  declare hiringPreferences: CreationOptional<HiringPreferences>;

  // Profile Sections
  declare profileSections: CreationOptional<HospitalProfileSections>;

  // Verification
  declare verificationStatus: CreationOptional<VerificationStatus>;
  declare verificationNotes: CreationOptional<string | null>;
  declare verifiedAt: CreationOptional<Date | null>;
  declare verifiedBy: CreationOptional<string | null>;

  // Payment & Credits
  /** Number of remaining job-post credits purchased via Razorpay */
  declare jobPostQuota: CreationOptional<number>;

  // Search & Discovery
  declare isSearchable: CreationOptional<boolean>;
  declare searchTags: CreationOptional<string[]>;

  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare user?: NonAttribute<User>;

  // Virtuals (excluded from model attributes)
  declare readonly fullAddress: NonAttribute<string | null>;

  // Get full address
  getFullAddress(): string | null {
    const addr = this.address;
    if (!addr) return null;
    return [addr.street, addr.area, addr.city, addr.state, addr.pincode]
      .filter(Boolean)
      .join(', ');
  }

  // Check if hospital is open now
  isOpenNow(): boolean {
    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[now.getDay()];
    const hours = this.workingHours?.[today];

    if (!hours?.isOpen) return false;

    const currentTime = now.toTimeString().slice(0, 5);
    return currentTime >= (hours.openTime || '00:00') && currentTime <= (hours.closeTime || '23:59');
  }

  // Calculate profile completion
  calculateProfileCompletion(): number {
    const sections = this.profileSections || {};
    const completedSections = Object.values(sections).filter(Boolean).length;
    const totalSections = Object.keys(sections).length || 5;
    return Math.round((completedSections / totalSections) * 100);
  }
}

Hospital.init(
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
    hospitalName: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    hospitalType: {
      type: DataTypes.ENUM(...Object.values(HospitalType)),
      defaultValue: HospitalType.PRIVATE,
    },
    hospitalTypeOther: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    registrationNumber: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: true,
    },
    establishedYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    hospitalLicense: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    nabhAccreditation: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    representative: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    address: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
    contactPersons: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: { len: [0, 2000] },
    },
    infrastructure: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    facilities: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    departments: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    specialties: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    specialtiesOther: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    staffing: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    credentials: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    facilityGallery: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    workingHours: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    gstDetails: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    panDetails: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    panNumber: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    hospitalStats: {
      type: DataTypes.JSONB,
      defaultValue: {
        totalEmployees: 0,
        activeJobs: 0,
        totalJobsPosted: 0,
        totalHires: 0,
        rating: 0,
        totalReviews: 0,
      },
    },
    images: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    hiringPreferences: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    profileSections: {
      type: DataTypes.JSONB,
      defaultValue: {
        generalInfo: false,
        representativeDetails: false,
        staffingDetails: false,
        infrastructureDetails: false,
        trustVerification: false,
      },
    },
    verificationStatus: {
      type: DataTypes.ENUM(...Object.values(VerificationStatus)),
      defaultValue: VerificationStatus.PENDING,
    },
    verificationNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verifiedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    jobPostQuota: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    isSearchable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    modelName: 'Hospital',
    tableName: 'hospitals',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'], unique: true },
      { fields: ['hospital_name'] },
      { fields: ['hospital_type'] },
      { fields: ['verification_status'] },
      { fields: ['is_searchable'] },
      { fields: ['latitude', 'longitude'] },
      {
        name: 'hospitals_address_city_idx',
        fields: [sequelize.literal("(address->>'city')")],
      },
      {
        name: 'hospitals_address_state_idx',
        fields: [sequelize.literal("(address->>'state')")],
      },
    ],
    hooks: {
      beforeSave: (hospital: Hospital) => {
        // Extract coordinates if present in address
        if (hospital.address?.coordinates) {
          hospital.latitude = hospital.address.coordinates.lat;
          hospital.longitude = hospital.address.coordinates.lng;
        }
      },
    },
  }
);

export default Hospital;
