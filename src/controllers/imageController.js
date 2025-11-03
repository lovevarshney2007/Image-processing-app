import { Image } from "../models/imageModel.js";
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { v2 as cloudinary } from 'cloudinary';
import { rejects } from "assert";


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// UploadImage
const uploadImageController = asyncHandler(async (req,res) => {
    
    if(!req.user || !req.user._id) { 
        throw new ApiError(401, "User not authenticated for upload.");
    }
    
    try {
        if(!req.file) {
            console.log("[DEBUG] File upload failed before controller: req.file is missing."); 
            throw new ApiError(400, "No image file provided for upload.");
        }
        
        console.log("[DEBUG] File received by controller. Path/URL:", req.file.path || req.file.url); 
        
        const userId = req.user._id;
        const { processingType } = req.body; 
        
        const cloudinaryUrl = req.file.path || req.file.url || req.file.secure_url;
        const publicId = req.file.filename || req.file.public_id;


        if (!cloudinaryUrl || !publicId) {
             throw new ApiError(500, "Cloudinary upload failed: Missing URL/Public ID in response.");
        }

        
        console.log("[DEBUG] Starting database creation...");
        const newImage = await Image.create({
            userId : req.user._id,
            originalPath: cloudinaryUrl, 
            fileName: publicId,
            processingType: req.body.processingType || 'analysis',
            metaData: {
                size: req.file.size,
                mimetype: req.file.mimetype,
                publicId : publicId,
            },
            fileHash: `${req.user._id}-${Date.now()}`
        });
        console.log("[DEBUG] Database entry successful. Sending response.");

        return res
            .status(201)
            .json(
                new ApiResponse(
                    201, 
                    newImage, 
                    "Image uploaded successfully. Processing initiated."
                )
            );

    } catch (error) {
        console.error("Critical Upload Error:", error);
        throw error; 
    }
});

// ImageProccessing Controller
const getImageDetailsController = asyncHandler(async(req,res) => {
    const { imageId } = req.params;
    const image = await Image.findById(imageId);

    if (!image) {
        throw new ApiError(404, "Image not found.");
    }

    if (image.userId.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Access denied. Not the owner of this image.");
    }


    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                image,
                "Image details fetched successfully."
            )
        );

})

// resize image
const  resizeImageController = asyncHandler(async (req,res) => {
    const { imageId, width , height } = req.body;
    const userId = req.user._id;

    if(!imageId || !width || !height) {
        throw new ApiError(400, "ImageId , width and height are required for resizing.")
    }

    const image = await Image.findById(imageId);

    if(!image){
        throw new ApiError(404,"Image not found.");
    }

  

    if(image.userId.toString() !== userId.toString()){
        throw new ApiError(403, "Access denied. You can only resize your own images.");
    }

      const publicId = image.metaData.publicId || image.fileName;
    const transformationString = `c_fill,h_${height},w_${width}`;


    try{
      
        const processedUrl = cloudinary.url(publicId , {
            transformation : [{
                crop : 'fill',width: parseInt(width),height: parseInt(height)
            }],
            fetch_format : 'auto'
        })

        // Update Database Entry
        image.processedPath = processedUrl;
        image.processingType = `resize_${width}x${height}`;
        image.status = 'completed';
        await image.save();

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,{
                    ...image.toObject(),
                    processedUrl: processedUrl
                },
                "Image resized successfully"
            )
        );
    } catch(error){
        image.status = 'failed';
        await image.save();
        console.error("Sharp Processing Error : ",error);
        throw new ApiError(500,`Image processing failed : ${error.code || error.message}`);
    }
});


// grayscaleImage controller
const grayscaleImageController = asyncHandler(async(req,res) => {

    const { imageId } = req.body; 
    const userId = req.user._id;

    if (!imageId) {
        throw new ApiError(400, "ImageId is required for grayscale transformation.");
    }

    const image = await Image.findById(imageId); // 🛑 FIX: Fetch image data

    if (!image || image.userId.toString() !== userId.toString()) {
        throw new ApiError(404, "Image not found or access denied.");
    }
   
    try {
        const publicId = image.metaData.publicId || image.fileName;
      
        const processedUrl = cloudinary.url(publicId, {
            transformation: [{
                effect: 'grayscale' 
            }],
            fetch_format: 'auto'
        });

        // 2. Database Entry Update
        image.processedPath = processedUrl;
        image.processingType = 'grayscale';
        image.status = 'completed';
        await image.save();

        return res
            .status(200)
            .json(new ApiResponse(200, {
                ...image.toObject(),
                processedUrl: processedUrl 
            }, "Image filtered to grayscale successfully."));

    } catch (error) {
        throw new ApiError(500, `Image filtering failed: ${error.message}`);
    }
});
export { 
    uploadImageController, 
    getImageDetailsController,
    resizeImageController,
    grayscaleImageController
};