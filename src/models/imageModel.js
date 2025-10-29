import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    originalPath: {
        type: String,
        required: true,
    },
    processedPath: {
        type: String,
        default: null, 
    },
    fileName: {
        type: String,
        required: true,
    },
    fileHash : {
       type: String,
        required: true,
        unique: true, 
        select: false 
    },
    status: {
        type: String,
        enum: ['uploaded', 'processing', 'completed', 'failed'],
        default: 'uploaded',
        required: true,
    },
    processingType: {
        type: String,
        default: 'analysis', 
    },
    analysisResults: {
        type: mongoose.Schema.Types.Mixed, 
        default: {},
    },
    metaData: {
        size: Number,
        mimetype: String
    }
}, {
    timestamps: true 
});

export const Image = mongoose.model('Image', imageSchema);