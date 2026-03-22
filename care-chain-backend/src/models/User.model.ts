// src/models/User.model.ts
// Base User Model - Common fields for both Doctor and Hospital

import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
} from 'sequelize';
import bcrypt from 'bcryptjs';
import { sequelize } from '../config/database';
import { UserRole, OtpType } from './types';

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  // Primary key
  declare id: CreationOptional<string>;

  // Authentication
  declare email: string;
  declare password: string;
  declare role: CreationOptional<UserRole>;

  // Profile
  declare fullName: string;
  declare phoneCountryCode: CreationOptional<string>;
  declare phoneNumber: CreationOptional<string | null>;
  declare isPhoneVerified: CreationOptional<boolean>;
  declare avatarUrl: CreationOptional<string | null>;
  declare avatarPublicId: CreationOptional<string | null>;

  // Status
  declare isEmailVerified: CreationOptional<boolean>;
  declare isActive: CreationOptional<boolean>;
  declare isProfileComplete: CreationOptional<boolean>;
  declare profileCompletionPercentage: CreationOptional<number>;

  // OTP
  declare otpCode: CreationOptional<string | null>;
  declare otpExpiresAt: CreationOptional<Date | null>;
  declare otpType: CreationOptional<OtpType | null>;

  // Password Reset
  declare passwordChangedAt: CreationOptional<Date | null>;
  declare passwordResetToken: CreationOptional<string | null>;
  declare passwordResetExpires: CreationOptional<Date | null>;

  // Email Verification
  declare emailVerificationOTP: CreationOptional<string | null>;
  declare emailVerificationExpires: CreationOptional<Date | null>;

  // Session
  declare lastLogin: CreationOptional<Date | null>;
  declare refreshTokens: CreationOptional<string[]>;

  // Push Notifications
  declare fcmTokens: CreationOptional<string[]>;

  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations (will be set up in index.ts)
  declare doctorProfile?: NonAttribute<any>;
  declare hospitalProfile?: NonAttribute<any>;

  // Virtuals (excluded from model attributes)
  declare readonly maskedPhone: NonAttribute<string | null>;

  // Instance methods
  async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }

  changedPasswordAfter(jwtTimestamp: number): boolean {
    if (this.passwordChangedAt) {
      const changedTimestamp = Math.floor(
        this.passwordChangedAt.getTime() / 1000
      );
      return jwtTimestamp < changedTimestamp;
    }
    return false;
  }

  // Getter for maskedPhone
  getMaskedPhone(): string | null {
    if (!this.phoneNumber) return null;
    return `${this.phoneCountryCode} XXXXX${this.phoneNumber.slice(-5)}`;
  }

  // Override toJSON to exclude sensitive fields
  toJSON(): object {
    const values = Object.assign({}, this.dataValues) as Record<string, unknown>;
    delete values.password;
    delete values.refreshTokens;
    delete values.otpCode;
    delete values.passwordResetToken;
    delete values.emailVerificationOTP;
    return values;
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
      set(value: string) {
        this.setDataValue('email', value.toLowerCase().trim());
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { len: [8, 255] },
    },
    role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      defaultValue: UserRole.PENDING,
    },
    fullName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { len: [1, 100] },
    },
    phoneCountryCode: {
      type: DataTypes.STRING(10),
      defaultValue: '+91',
    },
    phoneNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    isPhoneVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    avatarUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    avatarPublicId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    isProfileComplete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    profileCompletionPercentage: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: { min: 0, max: 100 },
    },
    otpCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    otpExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    otpType: {
      type: DataTypes.ENUM(...Object.values(OtpType)),
      allowNull: true,
    },
    passwordChangedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    passwordResetToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    emailVerificationOTP: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    emailVerificationExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    refreshTokens: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    fcmTokens: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      defaultValue: [],
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['email'], unique: true },
      { fields: ['role'] },
      { fields: ['phone_number'] },
      { fields: ['created_at'] },
      { fields: ['is_active'] },
    ],
    hooks: {
      beforeSave: async (user: User) => {
        if (user.changed('password')) {
          // Avoid double-hashing
          const isHashed = /^\$2[aby]\$\d{2}\$/.test(user.password);
          if (!isHashed) {
            const salt = await bcrypt.genSalt(12);
            user.password = await bcrypt.hash(user.password, salt);

            if (!user.isNewRecord) {
              user.passwordChangedAt = new Date(Date.now() - 1000);
            }
          }
        }
      },
    },
  }
);

export default User;
