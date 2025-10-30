import express from "express";
import dotenv from "dotenv";
import connectDb from "./config/db.js"
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit"; 
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js"
import { errorMiddleware } from "./middlewares/errorMiddleware.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { ApiError } from "./utils/ApiError.js";
import { ApiResponse } from "./utils/ApiResponse.js";
import imageRoutes from "./routes/imageRoutes.js";
import path from 'path';

// load environmental Variable
dotenv.config({
    path : './.env'
})



// connect To mongodb
connectDb();

// initiallize express app
const app = express();

// Rate-Limiting
const limiter = rateLimit({
    windowMs : 60*1000,
    max: 5,
    standardHeaders: true,
    legacyHaders : false,
    message: "Too many requests from this IP, please try again after 15 minutes",

    
    handler: async (req,res,next,options) => {
        const suspiciousIP = req.ip;

      try {
            await SuspiciousLog.create({
                ipAddress: suspiciousIP,
                endpoint: req.originalUrl,
                reason: "RATE_LIMIT_EXCEEDED",
            });
            console.log(`[ALERT] Stored suspicious activity for IP: ${suspiciousIP}`);

        } catch (error) {
            console.error("Error storing suspicious log:", error.message);
        }
        res.status(options.statusCode).send(options.message);
    },
})

// middlewares
app.use(limiter);
// app.use(cors());

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
)
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use('/uploads', express.static(path.resolve('public/uploads')));

// test route
app.get("/",(req , res) => {
    res.send("Image Proccessing  is running");
})

// routes
app.use("/api/v1/auth",authRoutes);
app.use("/api/v1/images", imageRoutes);

app.use(errorMiddleware)


// server Listening
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`server running on Port ${PORT}`);
})



// import http from "http";

// const http = require('http');




const temp=(req, res) => {
  
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  
  
  res.end('Hello from Agnisense Vercel Function!\n');
};

export {
    temp
}


