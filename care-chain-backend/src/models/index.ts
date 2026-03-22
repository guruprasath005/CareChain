// src/models/index.ts
// Central model exports and associations

import { sequelize } from '../config/database';
import { User } from './User.model';
import { Doctor } from './Doctor.model';
import { Hospital } from './Hospital.model';
import { Job } from './Job.model';
import { Application } from './Application.model';
import { Assignment } from './Assignment.model';
import { Attendance } from './Attendance.model';
import { LeaveRequest } from './LeaveRequest.model';
import { Conversation } from './Conversation.model';
import { Message } from './Message.model';
import { Feedback } from './Feedback.model';

// ============================================
// Define Associations
// ============================================

// User - Doctor (One-to-One)
User.hasOne(Doctor, {
  foreignKey: 'userId',
  as: 'doctorProfile',
  onDelete: 'CASCADE',
});
Doctor.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// User - Hospital (One-to-One)
User.hasOne(Hospital, {
  foreignKey: 'userId',
  as: 'hospitalProfile',
  onDelete: 'CASCADE',
});
Hospital.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// User (Hospital) - Job (One-to-Many)
User.hasMany(Job, {
  foreignKey: 'hospitalId',
  as: 'jobs',
  onDelete: 'CASCADE',
});
Job.belongsTo(User, {
  foreignKey: 'hospitalId',
  as: 'hospital',
});

// Job - Application (One-to-Many)
Job.hasMany(Application, {
  foreignKey: 'jobId',
  as: 'applications',
  onDelete: 'CASCADE',
});
Application.belongsTo(Job, {
  foreignKey: 'jobId',
  as: 'job',
});

// User (Doctor) - Application (One-to-Many)
User.hasMany(Application, {
  foreignKey: 'doctorId',
  as: 'doctorApplications',
  onDelete: 'CASCADE',
});
Application.belongsTo(User, {
  foreignKey: 'doctorId',
  as: 'doctor',
});

// User (Hospital) - Application (One-to-Many)
User.hasMany(Application, {
  foreignKey: 'hospitalId',
  as: 'hospitalApplications',
  onDelete: 'CASCADE',
});
Application.belongsTo(User, {
  foreignKey: 'hospitalId',
  as: 'applicationHospital',
});

// Job - Assignment (One-to-Many)
Job.hasMany(Assignment, {
  foreignKey: 'jobId',
  as: 'assignments',
  onDelete: 'CASCADE',
});
Assignment.belongsTo(Job, {
  foreignKey: 'jobId',
  as: 'job',
});

// User (Doctor) - Assignment (One-to-Many)
User.hasMany(Assignment, {
  foreignKey: 'doctorId',
  as: 'doctorAssignments',
  onDelete: 'CASCADE',
});
Assignment.belongsTo(User, {
  foreignKey: 'doctorId',
  as: 'doctor',
});

// User (Hospital) - Assignment (One-to-Many)
User.hasMany(Assignment, {
  foreignKey: 'hospitalId',
  as: 'hospitalAssignments',
  onDelete: 'CASCADE',
});
Assignment.belongsTo(User, {
  foreignKey: 'hospitalId',
  as: 'assignmentHospital',
});

// Application - Assignment (One-to-One)
Application.hasOne(Assignment, {
  foreignKey: 'applicationId',
  as: 'assignment',
  onDelete: 'SET NULL',
});
Assignment.belongsTo(Application, {
  foreignKey: 'applicationId',
  as: 'application',
});

// Assignment - Attendance (One-to-Many)
Assignment.hasMany(Attendance, {
  foreignKey: 'assignmentId',
  as: 'attendances',
  onDelete: 'CASCADE',
});
Attendance.belongsTo(Assignment, {
  foreignKey: 'assignmentId',
  as: 'assignment',
});

// User (Doctor) - Attendance
User.hasMany(Attendance, {
  foreignKey: 'doctorId',
  as: 'doctorAttendances',
  onDelete: 'CASCADE',
});
Attendance.belongsTo(User, {
  foreignKey: 'doctorId',
  as: 'doctor',
});

// User (Hospital) - Attendance
User.hasMany(Attendance, {
  foreignKey: 'hospitalId',
  as: 'hospitalAttendances',
  onDelete: 'CASCADE',
});
Attendance.belongsTo(User, {
  foreignKey: 'hospitalId',
  as: 'attendanceHospital',
});

// Assignment - LeaveRequest (One-to-Many)
Assignment.hasMany(LeaveRequest, {
  foreignKey: 'assignmentId',
  as: 'leaveRequests',
  onDelete: 'CASCADE',
});
LeaveRequest.belongsTo(Assignment, {
  foreignKey: 'assignmentId',
  as: 'assignment',
});

// User (Doctor) - LeaveRequest
User.hasMany(LeaveRequest, {
  foreignKey: 'doctorId',
  as: 'doctorLeaveRequests',
  onDelete: 'CASCADE',
});
LeaveRequest.belongsTo(User, {
  foreignKey: 'doctorId',
  as: 'doctor',
});

// User (Hospital) - LeaveRequest
User.hasMany(LeaveRequest, {
  foreignKey: 'hospitalId',
  as: 'hospitalLeaveRequests',
  onDelete: 'CASCADE',
});
LeaveRequest.belongsTo(User, {
  foreignKey: 'hospitalId',
  as: 'leaveHospital',
});

// LeaveRequest - Attendance (One-to-Many for leave days)
LeaveRequest.hasMany(Attendance, {
  foreignKey: 'leaveRequestId',
  as: 'leaveAttendances',
  onDelete: 'SET NULL',
});
Attendance.belongsTo(LeaveRequest, {
  foreignKey: 'leaveRequestId',
  as: 'leaveRequest',
});

// ============================================
// Feedback Associations
// ============================================

// Assignment - Feedback (One-to-Many)
Assignment.hasMany(Feedback, {
  foreignKey: 'assignmentId',
  as: 'feedbacks',
  onDelete: 'CASCADE',
});
Feedback.belongsTo(Assignment, {
  foreignKey: 'assignmentId',
  as: 'assignment',
});

// User (Reviewer) - Feedback
User.hasMany(Feedback, {
  foreignKey: 'reviewerId',
  as: 'givenFeedbacks',
  onDelete: 'CASCADE',
});
Feedback.belongsTo(User, {
  foreignKey: 'reviewerId',
  as: 'reviewer',
});

// User (Reviewee) - Feedback
User.hasMany(Feedback, {
  foreignKey: 'revieweeId',
  as: 'receivedFeedbacks',
  onDelete: 'CASCADE',
});
Feedback.belongsTo(User, {
  foreignKey: 'revieweeId',
  as: 'reviewee',
});

// ============================================
// Conversation & Message Associations
// ============================================

// User (Doctor) - Conversation
User.hasMany(Conversation, {
  foreignKey: 'doctorId',
  as: 'doctorConversations',
  onDelete: 'CASCADE',
});
Conversation.belongsTo(User, {
  foreignKey: 'doctorId',
  as: 'doctor',
});

// User (Hospital) - Conversation
User.hasMany(Conversation, {
  foreignKey: 'hospitalId',
  as: 'hospitalConversations',
  onDelete: 'CASCADE',
});
Conversation.belongsTo(User, {
  foreignKey: 'hospitalId',
  as: 'hospital',
});

// Job - Conversation
Job.hasMany(Conversation, {
  foreignKey: 'jobId',
  as: 'conversations',
  onDelete: 'SET NULL',
});
Conversation.belongsTo(Job, {
  foreignKey: 'jobId',
  as: 'job',
});

// Application - Conversation
Application.hasOne(Conversation, {
  foreignKey: 'applicationId',
  as: 'conversation',
  onDelete: 'SET NULL',
});
Conversation.belongsTo(Application, {
  foreignKey: 'applicationId',
  as: 'application',
});

// Conversation - Message (One-to-Many)
Conversation.hasMany(Message, {
  foreignKey: 'conversationId',
  as: 'messages',
  onDelete: 'CASCADE',
});
Message.belongsTo(Conversation, {
  foreignKey: 'conversationId',
  as: 'conversation',
});

// User - Message (Sender)
User.hasMany(Message, {
  foreignKey: 'senderId',
  as: 'sentMessages',
  onDelete: 'CASCADE',
});
Message.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender',
});

// ============================================
// Export all models
// ============================================

export {
  sequelize,
  User,
  Doctor,
  Hospital,
  Job,
  Application,
  Assignment,
  Attendance,
  LeaveRequest,
  Conversation,
  Message,
  Feedback,
};

// Export types
export * from './types';

// Default export for convenience
export default {
  sequelize,
  User,
  Doctor,
  Hospital,
  Job,
  Application,
  Assignment,
  Attendance,
  LeaveRequest,
  Conversation,
  Message,
  Feedback,
};
