// src/models/Job.model.ts
// Job Posting Model

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
  JobType,
  JobStatus,
  Duration,
  Shift,
  WorkSchedule,
  Address,
  Compensation,
  Facilities,
  Requirements,
  ApplicationSettings,
  JobStats,
} from './types';

export class Job extends Model<
  InferAttributes<Job>,
  InferCreationAttributes<Job>
> {
  // Primary key
  declare id: CreationOptional<string>;
  declare hospitalId: ForeignKey<User['id']>;

  // Basic Information
  declare title: string;
  declare description: string;
  declare jobCode: CreationOptional<string | null>;

  // Specialization
  declare specialization: string;
  declare department: CreationOptional<string | null>;

  // Type & Duration
  declare jobType: JobType;
  declare duration: Duration;

  // Shift
  declare shift: Shift;
  declare workSchedule: CreationOptional<WorkSchedule>;

  // Location
  declare location: Address;
  declare latitude: CreationOptional<number | null>;
  declare longitude: CreationOptional<number | null>;

  // Compensation
  declare compensation: Compensation;
  declare facilities: CreationOptional<Facilities>;

  // Requirements
  declare requirements: Requirements;

  // Status
  declare status: CreationOptional<JobStatus>;

  // Settings
  declare applicationSettings: CreationOptional<ApplicationSettings>;

  // Statistics
  declare stats: CreationOptional<JobStats>;

  // Priority
  declare isUrgent: CreationOptional<boolean>;
  declare isFeatured: CreationOptional<boolean>;

  /**
   * 7×24 binary availability matrix (CareChainX matching).
   * matrix[dayIndex][hourIndex] = 1 means the shift requires coverage that hour.
   * dayIndex 0 = Monday … 6 = Sunday.
   * Used as a hard filter (≥1 overlap required) and for soft availability scoring.
   */
  declare weeklyAvailabilityMatrix: CreationOptional<number[][]>;

  // Search
  declare searchTags: CreationOptional<string[]>;

  // Admin
  declare postedBy: CreationOptional<string | null>;
  declare publishedAt: CreationOptional<Date | null>;
  declare expiresAt: CreationOptional<Date | null>;
  declare closedAt: CreationOptional<Date | null>;
  declare closedReason: CreationOptional<string | null>;

  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare hospital?: NonAttribute<User>;
  declare applications?: NonAttribute<any[]>;
  declare assignments?: NonAttribute<any[]>;

  // Virtuals (excluded from model attributes)
  declare readonly salaryDisplay: NonAttribute<string | null>;
  declare readonly shiftDisplay: NonAttribute<string | null>;
  declare readonly salary: NonAttribute<string>;

  // Get salary display
  getSalaryDisplay(): string | null {
    const comp = this.compensation;
    if (!comp?.amount) return null;

    const amount = comp.amount.toLocaleString('en-IN');
    let type = '/month';
    if (comp.type === 'hourly') type = '/hr';
    else if (comp.type === 'daily') type = '/day';
    else if (comp.type === 'per_patient') type = '/patient';

    return `₹${amount}${type}`;
  }

  // Get shift display
  getShiftDisplay(): string | null {
    if (!this.shift) return null;
    return `${this.shift.startTime} - ${this.shift.endTime}`;
  }

  // Check if job is expired
  isExpired(): boolean {
    if (this.expiresAt && new Date() > this.expiresAt) return true;
    if (
      this.duration?.endDate &&
      !this.duration?.isOngoing &&
      new Date() > new Date(this.duration.endDate)
    )
      return true;
    return false;
  }

  // Generate job code
  static generateJobCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `JOB-${timestamp}-${random}`;
  }
}

Job.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    hospitalId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [0, 5000] },
    },
    jobCode: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: true,
    },
    specialization: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    jobType: {
      type: DataTypes.ENUM(...Object.values(JobType)),
      allowNull: false,
    },
    duration: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    shift: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    workSchedule: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: false,
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
    compensation: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    facilities: {
      type: DataTypes.JSONB,
      defaultValue: {
        meals: false,
        transport: false,
        accommodation: false,
        insurance: false,
      },
    },
    requirements: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    status: {
      type: DataTypes.ENUM(...Object.values(JobStatus)),
      defaultValue: JobStatus.DRAFT,
    },
    applicationSettings: {
      type: DataTypes.JSONB,
      defaultValue: {
        maxApplicants: null,
        autoCloseOnFill: true,
        requireCoverLetter: false,
        questionnaire: [],
      },
    },
    stats: {
      type: DataTypes.JSONB,
      defaultValue: {
        views: 0,
        applications: 0,
        shortlisted: 0,
        interviewed: 0,
        hired: 0,
        rejected: 0,
      },
    },
    isUrgent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    weeklyAvailabilityMatrix: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    searchTags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    postedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closedReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Job',
    tableName: 'jobs',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['hospital_id'] },
      { fields: ['status'] },
      { fields: ['specialization'] },
      { fields: ['job_type'] },
      { fields: ['created_at'] },
      { fields: ['hospital_id', 'status'] },
      { fields: ['specialization', 'status'] },
      { fields: ['latitude', 'longitude'] },
      { fields: ['published_at'] },
      { fields: ['is_featured', 'status'] },
      { fields: ['is_urgent', 'status'] },
      {
        name: 'jobs_location_city_idx',
        fields: [sequelize.literal("(location->>'city')")],
      },
      {
        name: 'jobs_location_state_idx',
        fields: [sequelize.literal("(location->>'state')")],
      },
      {
        name: 'jobs_search_tags_gin_idx',
        fields: [sequelize.literal('search_tags')],
        using: 'gin',
      },
    ],
    hooks: {
      beforeCreate: (job: Job) => {
        if (!job.jobCode) {
          job.jobCode = Job.generateJobCode();
        }
        // Extract coordinates
        if (job.location?.coordinates) {
          job.latitude = job.location.coordinates.lat;
          job.longitude = job.location.coordinates.lng;
        }
      },
      beforeUpdate: (job: Job) => {
        if (job.location?.coordinates) {
          job.latitude = job.location.coordinates.lat;
          job.longitude = job.location.coordinates.lng;
        }
      },
    },
    // @ts-ignore
    getterMethods: {
      salary() {
        // @ts-ignore
        return this.getSalaryDisplay() || 'Not disclosed';
      }
    }
  }
);

export default Job;
