// src/models/Message.model.ts
// Message Model - Individual chat messages

import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';

export type MessageType = 'text' | 'image' | 'file' | 'system' | 'invitation' | 'contact_share';
export type MessageStatus = 'sent' | 'delivered' | 'read';

export class Message extends Model<
  InferAttributes<Message>,
  InferCreationAttributes<Message>
> {
  declare id: CreationOptional<string>;
  
  // Conversation reference
  declare conversationId: string;
  
  // Sender info
  declare senderId: string;
  declare senderRole: 'doctor' | 'hospital';
  
  // Message content
  declare type: CreationOptional<MessageType>;
  declare content: string;
  
  // Attachments
  declare attachments: CreationOptional<{
    url: string;
    name: string;
    size: number;
    mimeType: string;
  }[] | null>;
  
  // Metadata for special message types
  declare metadata: CreationOptional<{
    invitationType?: 'job' | 'interview';
    jobId?: string;
    jobTitle?: string;
    contactInfo?: {
      phone?: string;
      email?: string;
    };
    systemAction?: string;
  } | null>;
  
  // Status tracking
  declare status: CreationOptional<MessageStatus>;
  declare readAt: CreationOptional<Date | null>;
  declare deliveredAt: CreationOptional<Date | null>;
  
  // Soft delete
  declare isDeleted: CreationOptional<boolean>;
  declare deletedAt: CreationOptional<Date | null>;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  
  // Associations
  declare conversation?: NonAttribute<any>;
  declare sender?: NonAttribute<any>;
}

Message.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'conversations', key: 'id' },
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    senderRole: {
      type: DataTypes.ENUM('doctor', 'hospital'),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('text', 'image', 'file', 'system', 'invitation', 'contact_share'),
      defaultValue: 'text',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    attachments: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('sent', 'delivered', 'read'),
      defaultValue: 'sent',
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: 'messages',
    timestamps: true,
    indexes: [
      { fields: ['conversation_id'] },
      { fields: ['sender_id'] },
      { fields: ['created_at'] },
      { fields: ['conversation_id', 'created_at'] },
    ],
  }
);

export default Message;
