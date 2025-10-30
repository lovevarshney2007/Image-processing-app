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
//     const cloudinaryUrl = req.file.path || req.file.url;
//     const publicId = req.file.filename || req.file.public_id;

//     // const hash = await new Promise((resolve,reject) => {
//     //     const hash = crypto.createHash('sha256');
//     //     const stream = fs.createReadStream(filePath);
//     //    stream.on('error', err => {
//     //         fs.unlinkSync(filePath); 
//     //         reject(new ApiError(500, `File read error: ${err.message}`));
//     //     });
//     //     stream.on('data', chunk => hash.update(chunk));
//     //     stream.on('end', () => resolve(hash.digest('hex')));
//     // });

//     // // Duplication Check
//     // const existingImage = await Image.findOne({ fileHash: hash }).select('+fileHash');

//     // if (existingImage) {
//     //     fs.unlinkSync(filePath); 

//     //     if (req.body.forceUpload !== 'true') {
//     //         throw new ApiError(409, "Image already exists. Send 'forceUpload: true' to upload again.", {
//     //             imageId: existingImage._id,
//     //             duplicate: true
//     //         });
//     //     }
//     // }

//     // add Image
//     const newImage = await Image.create({
//         userId : userId,
//         originalPath: cloudinaryUrl, 
//         fileName: publicId,
//         processingType: processingType || 'analysis',
//         metaData: {
//             size: req.file.size,
//             mimetype: req.file.mimetype,
//             publicId : publicId,
//         },
//     });
//     return res
//         .status(201)
//         .json(
//             new ApiResponse(
//                 201, 
//                 newImage, 
//                 "Image uploaded successfully. Processing initiated."
//             )
//         );
// });

// imageController.js

const uploadImageController = asyncHandler(async (req,res) => {
    // 1. Check Authentication (req.user)
    if(!req.user || !req.user._id) { 
        // This is a safety check if verifyJWT fails silently
        throw new ApiError(401, "User not authenticated for upload.");
    }
    
    try {
        // --- STEP 1: Check File Receipt ---
        if(!req.file) {
            // If the failure is before Cloudinary (e.g., in fileFilter), this runs
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

        
        // --- STEP 2: Database Operation ---
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

        // --- STEP 3: Successful Response ---
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
        // 🛑 This catches ANY failure in the steps above
        console.error("Critical Upload Error:", error);
        // This re-throws the error to your asyncHandler/errorMiddleware
        throw error; 
    }
});
// ... rest of the file

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

  
    // authorization check 
    if(image.userId.toString() !== userId.toString()){
        throw new ApiError(403, "Access denied. You can only resize your own images.");
    }

      const publicId = image.metaData.publicId || image.fileName;
    const transformationString = `c_fill,h_${height},w_${width}`;


    try{
        // Path define karna 
        // const  originalFilePath = path.normalize(path.resolve(image.originalPath));
        // const processedFileName = `resized-${width}x${height}-${image.fileName}`;
        // const processedFilePath = path.resolve('public','uploads', processedFileName);

        const processedUrl = cloudinary.url(publicId , {
            transformation : [{
                crop : 'fill',width: parseInt(width),height: parseInt(height)
            }],
            fetch_format : 'auto'
        })

        // // resizing Image by sharp module
        // await sharp(originalFilePath)
        // .resize(parseInt(width),parseInt(height))
        // .toFile(processedFilePath);

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
                    // Frontend ke liye Url (jahan se image serve hogi)
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