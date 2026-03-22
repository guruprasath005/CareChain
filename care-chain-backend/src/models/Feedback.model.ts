// src/models/Feedback.model.ts
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
import { FeedbackType } from './types';

export class Feedback extends Model<
    InferAttributes<Feedback>,
    InferCreationAttributes<Feedback>
> {
    declare id: CreationOptional<string>;

    // References
    declare assignmentId: ForeignKey<Assignment['id']>;
    declare reviewerId: ForeignKey<User['id']>;
    declare revieweeId: ForeignKey<User['id']>;

    // Feedback Data
    declare type: FeedbackType;
    declare rating: number; // Overall rating (0–5)

    /**
     * Dimension scores matching CareChainX feedback forms (all 1–5).
     *
     * Hospital → Doctor:  { competence, ethics, teamwork, conduct }
     * Doctor → Hospital:  { professionalism, workEnvironment, ethics, team }
     */
    declare detailedRatings: CreationOptional<Record<string, number> | null>;

    /**
     * Computed quality score for this specific assignment (0–5 scale).
     * = mean(detailedRatings dimensions)  OR  1.0 if doctor was a no-show.
     * Mirrors CareChainX's Feedback.quality_score_for_job field.
     */
    declare qualityScoreForJob: CreationOptional<number>;

    declare comment: CreationOptional<string | null>;
    declare testimonial: CreationOptional<string | null>;

    // Timestamps
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    // Associations
    declare reviewer?: NonAttribute<User>;
    declare reviewee?: NonAttribute<User>;
    declare assignment?: NonAttribute<Assignment>;
}

Feedback.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        assignmentId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'assignments', key: 'id' },
            onDelete: 'CASCADE',
        },
        reviewerId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
        },
        revieweeId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
        },
        type: {
            type: DataTypes.ENUM(...Object.values(FeedbackType)),
            allowNull: false,
        },
        rating: {
            type: DataTypes.FLOAT,
            allowNull: false,
            validate: {
                min: 0,
                max: 5,
            },
        },
        comment: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        detailedRatings: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
        qualityScoreForJob: {
            type: DataTypes.FLOAT,
            defaultValue: 0.0,
            validate: { min: 0, max: 5 },
        },
        testimonial: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    },
    {
        sequelize,
        modelName: 'Feedback',
        tableName: 'feedbacks',
        timestamps: true,
        underscored: true,
        indexes: [
            { fields: ['assignment_id'] },
            { fields: ['reviewer_id'] },
            { fields: ['reviewee_id'] },
            { fields: ['type'] },
        ],
    }
);

export default Feedback;
