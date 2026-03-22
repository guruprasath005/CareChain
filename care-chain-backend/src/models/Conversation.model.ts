// src/models/Conversation.model.ts
// Conversation Model - Tracks chat conversations between users

import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';

export type ConversationType = 'application' | 'interview' | 'general' | 'support';
export type ConversationStatus = 'active' | 'archived' | 'blocked';
export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export class Conversation extends Model<
  InferAttributes<Conversation>,
  InferCreationAttributes<Conversation>
> {
  declare id: CreationOptional<string>;

  // Participants (doctor <-> hospital)
  declare doctorId: string;
  declare hospitalId: string;

  // Related entities
  declare jobId: CreationOptional<string | null>;
  declare applicationId: CreationOptional<string | null>;

  // Conversation metadata
  declare type: CreationOptional<ConversationType>;
  declare status: CreationOptional<ConversationStatus>;
  
  // Invitation status (for first contact from hospital)
  declare invitationStatus: CreationOptional<InvitationStatus>;
  declare initiatorId: CreationOptional<string | null>;

  // Last message preview
  declare lastMessageId: CreationOptional<string | null>;
  declare lastMessageText: CreationOptional<string | null>;
  declare lastMessageAt: CreationOptional<Date | null>;
  declare lastMessageSenderId: CreationOptional<string | null>;

  // Unread counts
  declare doctorUnreadCount: CreationOptional<number>;
  declare hospitalUnreadCount: CreationOptional<number>;

  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare doctor?: NonAttribute<any>;
  declare hospital?: NonAttribute<any>;
  declare job?: NonAttribute<any>;
  declare application?: NonAttribute<any>;
  declare messages?: NonAttribute<any[]>;
}

Conversation.init(
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
    },
    hospitalId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    jobId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'jobs', key: 'id' },
    },
    applicationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'applications', key: 'id' },
    },
    type: {
      type: DataTypes.ENUM('application', 'interview', 'general', 'support'),
      defaultValue: 'general',
    },
    status: {
      type: DataTypes.ENUM('active', 'archived', 'blocked'),
      defaultValue: 'active',
    },
    invitationStatus: {
      type: DataTypes.ENUM('pending', 'accepted', 'declined'),
      defaultValue: 'pending',
    },
    initiatorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    lastMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    lastMessageText: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastMessageSenderId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    doctorUnreadCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    hospitalUnreadCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'conversations',
    timestamps: true,
    indexes: [
      { fields: ['doctor_id'] },
      { fields: ['hospital_id'] },
      { fields: ['job_id'] },
      { fields: ['application_id'] },
      { fields: ['last_message_at'] },
      {
        unique: true,
        fields: ['doctor_id', 'hospital_id', 'job_id'],
        name: 'unique_conversation_per_job',
      },
    ],
  }
);

export default Conversation;
