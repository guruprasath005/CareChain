// src/models/Application.model.ts
// Job Application Model

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
import {
  ApplicationStatus,
  StatusHistoryEntry,
  Interview,
  Offer,
  Rejection,
  Withdrawal,
  InternalNote,
  Compensation,
} from './types';

export class Application extends Model<
  InferAttributes<Application>,
  InferCreationAttributes<Application>
> {
  // Primary key
  declare id: CreationOptional<string>;

  // References
  declare jobId: ForeignKey<Job['id']>;
  declare doctorId: ForeignKey<User['id']>;
  declare hospitalId: ForeignKey<User['id']>;

  // Application Details
  declare applicationCode: CreationOptional<string | null>;
  declare coverLetter: CreationOptional<string | null>;
  declare questionnaireResponses: CreationOptional<
    { question: string; answer: string }[]
  >;
  declare expectedCompensation: CreationOptional<Compensation | null>;
  declare availableFrom: CreationOptional<Date | null>;

  // Status
  declare status: CreationOptional<ApplicationStatus>;
  declare statusHistory: CreationOptional<StatusHistoryEntry[]>;

  // Interview
  declare interview: CreationOptional<Interview | null>;

  // Offer
  declare offer: CreationOptional<Offer | null>;

  // Rejection
  declare rejection: CreationOptional<Rejection | null>;

  // Withdrawal
  declare withdrawal: CreationOptional<Withdrawal | null>;

  // Internal Notes
  declare internalNotes: CreationOptional<InternalNote[]>;

  // Tracking
  declare viewedByHospital: CreationOptional<boolean>;
  declare viewedAt: CreationOptional<Date | null>;
  declare lastActivityAt: CreationOptional<Date | null>;

  // Match Score
  declare matchScore: CreationOptional<number | null>;

  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare job?: NonAttribute<Job>;
  declare doctor?: NonAttribute<User>;
  declare applicationHospital?: NonAttribute<User>;
  declare assignment?: NonAttribute<any>;

  // Generate application code
  static generateApplicationCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `APP-${timestamp}-${random}`;
  }

  // Add to status history
  addStatusHistory(
    status: ApplicationStatus,
    userId: string | null = null,
    notes: string | null = null
  ): void {
    const history = this.statusHistory || [];
    history.push({
      status,
      changedAt: new Date().toISOString(),
      changedBy: userId || undefined,
      notes: notes || undefined,
    });
    this.statusHistory = history;
  }
}

Application.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    jobId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'jobs', key: 'id' },
      onDelete: 'CASCADE',
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
    applicationCode: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: true,
    },
    coverLetter: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: { len: [0, 2000] },
    },
    questionnaireResponses: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    expectedCompensation: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    availableFrom: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ApplicationStatus)),
      defaultValue: ApplicationStatus.APPLIED,
    },
    statusHistory: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    interview: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    offer: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    rejection: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    withdrawal: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    internalNotes: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    viewedByHospital: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    viewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastActivityAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    matchScore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0, max: 100 },
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Application',
    tableName: 'applications',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['job_id'] },
      { fields: ['doctor_id'] },
      { fields: ['hospital_id'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
      { fields: ['job_id', 'doctor_id'], unique: true }, // Prevent duplicates
      { fields: ['status', 'created_at'] },
      { fields: ['hospital_id', 'status'] },
      { fields: ['doctor_id', 'status'] },
    ],
    hooks: {
      beforeCreate: (application: Application) => {
        if (!application.applicationCode) {
          application.applicationCode = Application.generateApplicationCode();
        }
        application.lastActivityAt = new Date();
        application.statusHistory = [
          {
            status: application.status,
            changedAt: new Date().toISOString(),
          },
        ];
      },
      beforeUpdate: (application: Application) => {
        application.lastActivityAt = new Date();
        if (application.changed('status')) {
          const history = application.statusHistory || [];
          history.push({
            status: application.status,
            changedAt: new Date().toISOString(),
          });
          application.statusHistory = history;
        }
      },
    },
  }
);

export default Application;
