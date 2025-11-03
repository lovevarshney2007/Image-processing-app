import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from '../utils/ApiError.js'; 


import pkg from 'multer-storage-cloudinary';
const { CloudinaryStorage } = pkg;


if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    console.error("CRITICAL ERROR: Cloudinary credentials missing from .env file!");
 
}


cloudinary.config({
    cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret : process.env.CLOUDINARY_API_SECRET
});


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


const fileFilter = (req, file, cb) => { 
    if (!file.mimetype.startsWith('image/')) {
        return cb( 
            new ApiError(400,'Only image files are allowed!'),
            false 
        );
    }
    return cb(null, true); 
};



const upload = multer({
    storage : cloudinaryStorage,
    limits : { fileSize: 10*1024*1024},
    fileFilter : fileFilter, 
});


 const uploadSingleImage = (fieldName) => upload.single(fieldName);

export { 
    upload,
    uploadSingleImage
};