// src/models/LeaveRequest.model.ts
// Leave Request Model

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
import { Assignment } from './Assignment.model';
import { LeaveType, LeaveStatus, LeaveDocument } from './types';

export class LeaveRequest extends Model<
  InferAttributes<LeaveRequest>,
  InferCreationAttributes<LeaveRequest>
> {
  // Primary key
  declare id: CreationOptional<string>;

  // References
  declare doctorId: ForeignKey<User['id']>;
  declare hospitalId: ForeignKey<User['id']>;
  declare assignmentId: ForeignKey<Assignment['id']>;

  // Leave Details
  declare leaveType: LeaveType;
  declare startDate: string; // DATEONLY
  declare endDate: string; // DATEONLY

  // Duration
  declare totalDays: number;
  declare isHalfDay: CreationOptional<boolean>;
  declare halfDayPeriod: CreationOptional<'first_half' | 'second_half' | null>;

  // Reason
  declare reason: string;

  // Documents
  declare documents: CreationOptional<LeaveDocument[]>;

  // Status
  declare status: CreationOptional<LeaveStatus>;

  // Approval
  declare approvedBy: CreationOptional<string | null>;
  declare approvedAt: CreationOptional<Date | null>;

  // Rejection
  declare rejectedBy: CreationOptional<string | null>;
  declare rejectedAt: CreationOptional<Date | null>;
  declare rejectionReason: CreationOptional<string | null>;

  // Cancellation
  declare cancelledAt: CreationOptional<Date | null>;
  declare cancellationReason: CreationOptional<string | null>;

  // Admin Notes
  declare adminNotes: CreationOptional<string | null>;

  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare doctor?: NonAttribute<User>;
  declare leaveHospital?: NonAttribute<User>;
  declare assignment?: NonAttribute<Assignment>;
  declare leaveAttendances?: NonAttribute<any[]>;

  // Calculate total days
  calculateTotalDays(): number {
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      const diff = Math.abs(end.getTime() - start.getTime());
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
      return this.isHalfDay ? 0.5 : days;
    }
    return 0;
  }
}

LeaveRequest.init(
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
    assignmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'assignments', key: 'id' },
      onDelete: 'CASCADE',
    },
    leaveType: {
      type: DataTypes.ENUM(...Object.values(LeaveType)),
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    totalDays: {
      type: DataTypes.DECIMAL(3, 1),
      allowNull: false,
    },
    isHalfDay: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    halfDayPeriod: {
      type: DataTypes.ENUM('first_half', 'second_half'),
      allowNull: true,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [1, 500] },
    },
    documents: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    status: {
      type: DataTypes.ENUM(...Object.values(LeaveStatus)),
      defaultValue: LeaveStatus.PENDING,
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejectedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    rejectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    adminNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'LeaveRequest',
    tableName: 'leave_requests',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['doctor_id'] },
      { fields: ['hospital_id'] },
      { fields: ['assignment_id'] },
      { fields: ['status'] },
      { fields: ['start_date'] },
      { fields: ['doctor_id', 'status', 'created_at'] },
      { fields: ['hospital_id', 'status', 'created_at'] },
    ],
    hooks: {
      beforeSave: (leaveRequest: LeaveRequest) => {
        // Calculate total days before save
        if (leaveRequest.startDate && leaveRequest.endDate) {
          const start = new Date(leaveRequest.startDate);
          const end = new Date(leaveRequest.endDate);
          const diff = Math.abs(end.getTime() - start.getTime());
          const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
          leaveRequest.totalDays = leaveRequest.isHalfDay ? 0.5 : days;
        }
      },
    },
  }
);

export default LeaveRequest;
