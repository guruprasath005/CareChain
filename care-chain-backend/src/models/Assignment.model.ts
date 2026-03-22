// src/models/Assignment.model.ts
// Active Employment/Assignment Model

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
import { Job } from './Job.model';
import { Application } from './Application.model';
import {
  AssignmentStatus,
  StatusHistoryEntry,
  Schedule,
  Compensation,
  OnCallStatus,
  ReportingTo,
  Performance,
  LeaveBalance,
  Termination,
} from './types';

export class Assignment extends Model<
  InferAttributes<Assignment>,
  InferCreationAttributes<Assignment>
> {
  // Primary key
  declare id: CreationOptional<string>;

  // References
  declare doctorId: ForeignKey<User['id']>;
  declare hospitalId: ForeignKey<User['id']>;
  declare jobId: ForeignKey<Job['id']>;
  declare applicationId: ForeignKey<Application['id']> | null;

  // Assignment Details
  declare assignmentCode: CreationOptional<string | null>;
  declare title: string;
  declare department: CreationOptional<string | null>;

  // Contract Period
  declare startDate: Date;
  declare endDate: CreationOptional<Date | null>;
  declare isOngoing: CreationOptional<boolean>;

  // Schedule
  declare schedule: CreationOptional<Schedule>;

  // Compensation
  declare compensation: CreationOptional<Compensation>;

  // Status
  declare status: CreationOptional<AssignmentStatus>;
  declare statusHistory: CreationOptional<StatusHistoryEntry[]>;

  // On-Call
  declare onCallStatus: CreationOptional<OnCallStatus>;

  // Reporting
  declare reportingTo: CreationOptional<ReportingTo>;

  // Performance
  declare performance: CreationOptional<Performance>;

  // Leave
  declare leaveBalance: CreationOptional<LeaveBalance>;

  // Termination
  declare termination: CreationOptional<Termination | null>;

  // Notes
  declare notes: CreationOptional<string | null>;

  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare doctor?: NonAttribute<User>;
  declare assignmentHospital?: NonAttribute<User>;
  declare job?: NonAttribute<Job>;
  declare application?: NonAttribute<Application>;
  declare attendances?: NonAttribute<any[]>;
  declare leaveRequests?: NonAttribute<any[]>;

  // Generate assignment code
  static generateAssignmentCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ASN-${timestamp}-${random}`;
  }

  // Add to status history
  addStatusHistory(
    status: AssignmentStatus,
    userId: string | null = null,
    reason: string | null = null
  ): void {
    const history = this.statusHistory || [];
    history.push({
      status,
      changedAt: new Date().toISOString(),
      changedBy: userId || undefined,
      reason: reason || undefined,
    });
    this.statusHistory = history;
  }
}

Assignment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    doctorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    hospitalId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    jobId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'jobs', key: 'id' },
      onDelete: 'CASCADE',
    },
    applicationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'applications', key: 'id' },
      onDelete: 'SET NULL',
    },
    assignmentCode: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isOngoing: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    schedule: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    compensation: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    status: {
      type: DataTypes.ENUM(...Object.values(AssignmentStatus)),
      defaultValue: AssignmentStatus.ACTIVE,
    },
    statusHistory: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    onCallStatus: {
      type: DataTypes.JSONB,
      defaultValue: {
        isOnCall: false,
        availableFrom: null,
        availableUntil: null,
      },
    },
    reportingTo: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    performance: {
      type: DataTypes.JSONB,
      defaultValue: {
        daysPresent: 0,
        daysAbsent: 0,
        totalShifts: 0,
        completedShifts: 0,
        attendanceRate: 100,
        rating: 0,
      },
    },
    leaveBalance: {
      type: DataTypes.JSONB,
      defaultValue: {
        annual: { total: 0, used: 0 },
        sick: { total: 0, used: 0 },
        casual: { total: 0, used: 0 },
      },
    },
    termination: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Assignment',
    tableName: 'assignments',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['doctor_id'] },
      { fields: ['hospital_id'] },
      { fields: ['job_id'] },
      { fields: ['status'] },
      { fields: ['start_date'] },
      { fields: ['doctor_id', 'hospital_id', 'status'] },
      { fields: ['status', 'start_date'] },
    ],
    hooks: {
      beforeCreate: (assignment: Assignment) => {
        if (!assignment.assignmentCode) {
          assignment.assignmentCode = Assignment.generateAssignmentCode();
        }
      },
    },
  }
);

export default Assignment;
