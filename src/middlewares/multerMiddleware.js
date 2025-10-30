import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from '../utils/ApiError.js'; 

// FIX: CommonJS Import
import pkg from 'multer-storage-cloudinary';
const { CloudinaryStorage } = pkg;


if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    console.error("CRITICAL ERROR: Cloudinary credentials missing from .env file!");
    // You could even force the process to exit cleanly here to see the message
    // process.exit(1); 
}

// 1. Cloudinary Configuration
cloudinary.config({
    cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret : process.env.CLOUDINARY_API_SECRET
});

// 2. Cloudinary Storage Configuration
const cloudinaryStorage = new CloudinaryStorage({
    cloudinary : cloudinary,
    params : {
        folder : 'agnisense_uploads',
        public_id : (req,file) => {
            const fileNameWithoutExt = file.originalname.split('.').slice(0,-1).join('_');
            return `${fileNameWithoutExt}_${Date.now()}`;
        },
        quality : 80,
    },
});

// 3. File Filter (FIXED)
const fileFilter = (req, file, cb) => { // <-- FIX: 'file' parameter shamil kiya
    if (!file.mimetype.startsWith('image/')) {
        return cb( 
            new ApiError(400,'Only image files are allowed!'),
            false 
        );
    }
    return cb(null, true); // <-- FIX: Is line ko if block se bahar, sahi jagah par rakha
};


// 4. Multer Instance
const upload = multer({
    storage : cloudinaryStorage,
    limits : { fileSize: 10*1024*1024},
    fileFilter : fileFilter, // <-- Function ko yahan use kiya
});


 const uploadSingleImage = (fieldName) => upload.single(fieldName);

export { 
    upload,
    uploadSingleImage
};