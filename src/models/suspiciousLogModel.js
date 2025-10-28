import mongoose from "mongoose";

const suspiciousLogSchema = new mongoose.Schema({
    ipAddress: {
        type: String,
        required: true,
    },
    endpoint: {
        type: String, 
        required: true,
    },
    reason: {
        type: String, 
        default: "RATE_LIMIT_EXCEEDED",
    },
    
}, { timestamps: true });

export const SuspiciousLog = mongoose.model('SuspiciousLog', suspiciousLogSchema);