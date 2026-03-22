// src/models/Attendance.model.ts
// Attendance Model - Tracks daily attendance for active assignments

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
import {
  AttendanceStatus,
  CheckInOut,
  ScheduledShift,
  WorkDuration,
} from './types';

export class Attendance extends Model<
  InferAttributes<Attendance>,
  InferCreationAttributes<Attendance>
> {
  // Primary key
  declare id: CreationOptional<string>;

  // References
  declare doctorId: ForeignKey<User['id']>;
  declare hospitalId: ForeignKey<User['id']>;
  declare assignmentId: ForeignKey<Assignment['id']>;

  // Date
  declare date: string; // DATEONLY

  // Check-in/Check-out
  declare checkIn: CreationOptional<CheckInOut | null>;
  declare checkOut: CreationOptional<CheckInOut | null>;

  // Scheduled
  declare scheduled: CreationOptional<ScheduledShift>;

  // Duration
  declare workDuration: CreationOptional<WorkDuration | null>;
  declare breakDuration: CreationOptional<WorkDuration | null>;
  declare overtimeMinutes: CreationOptional<number>;

  // Status
  declare status: CreationOptional<AttendanceStatus>;

  // Late/Early
  declare isLate: CreationOptional<boolean>;
  declare lateMinutes: CreationOptional<number>;
  declare isEarlyLeave: CreationOptional<boolean>;
  declare earlyLeaveMinutes: CreationOptional<number>;

  // Leave Reference
  declare leaveRequestId: ForeignKey<string> | null;

  // Notes
  declare notes: CreationOptional<string | null>;

  // Approval
  declare isApproved: CreationOptional<boolean>;
  declare approvedBy: CreationOptional<string | null>;
  declare approvedAt: CreationOptional<Date | null>;

  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare doctor?: NonAttribute<User>;
  declare attendanceHospital?: NonAttribute<User>;
  declare assignment?: NonAttribute<Assignment>;
  declare leaveRequest?: NonAttribute<any>;

  // Calculate work duration
  calculateWorkDuration(): WorkDuration | null {
    if (this.checkIn?.time && this.checkOut?.time) {
      const checkInTime = new Date(this.checkIn.time);
      const checkOutTime = new Date(this.checkOut.time);
      const diff = checkOutTime.getTime() - checkInTime.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return { hours, minutes };
    }
    return null;
  }
}

Attendance.init(
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    checkIn: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    checkOut: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    scheduled: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    workDuration: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    breakDuration: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    overtimeMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(AttendanceStatus)),
      defaultValue: AttendanceStatus.PENDING,
    },
    isLate: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    lateMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isEarlyLeave: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    earlyLeaveMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    leaveRequestId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'leave_requests', key: 'id' },
      onDelete: 'SET NULL',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isApproved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Attendance',
    tableName: 'attendances',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['doctor_id'] },
      { fields: ['hospital_id'] },
      { fields: ['assignment_id'] },
      { fields: ['date'] },
      { fields: ['status'] },
      { fields: ['assignment_id', 'date'], unique: true }, // Prevent duplicates
      { fields: ['doctor_id', 'date'] },
      { fields: ['hospital_id', 'date'] },
    ],
    hooks: {
      beforeSave: (attendance: Attendance) => {
        // Calculate work duration before save
        if (attendance.checkIn?.time && attendance.checkOut?.time) {
          const checkInTime = new Date(attendance.checkIn.time);
          const checkOutTime = new Date(attendance.checkOut.time);
          const diff = checkOutTime.getTime() - checkInTime.getTime();
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          attendance.workDuration = { hours, minutes };
        }
      },
    },
  }
);

export default Attendance;
