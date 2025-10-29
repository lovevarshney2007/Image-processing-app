import { Image } from "../models/imageModel.js";
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import sharp from "sharp";
import  crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { rejects } from "assert";

// upload image controller
const uploadImageController = asyncHandler(async (req,res) => {
    if(!req.file) {
        throw new ApiError(400, "No image file provided for upload.");
    }

    const userId = req.user._id;
    const { processingType } = req.body; 
    const filePath = req.file.path;

    const hash = await new Promise((resolve,reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
       stream.on('error', err => {
            fs.unlinkSync(filePath); 
            reject(new ApiError(500, `File read error: ${err.message}`));
        });
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });

    // Duplication Check
    const existingImage = await Image.findOne({ fileHash: hash }).select('+fileHash');

    if (existingImage) {
        fs.unlinkSync(filePath); 

        if (req.body.forceUpload !== 'true') {
            throw new ApiError(409, "Image already exists. Send 'forceUpload: true' to upload again.", {
                imageId: existingImage._id,
                duplicate: true
            });
        }
    }

    // add Image
    const newImage = await Image.create({
        userId : userId,
        originalPath: req.file.path, 
        fileName: req.file.filename,
        fileHash: hash,
        processingType: processingType || 'analysis',
        metaData: {
            size: req.file.size,
            mimetype: req.file.mimetype
        },
    });
    return res
        .status(201)
        .json(
            new ApiResponse(
                201, 
                newImage, 
                "Image uploaded successfully. Processing initiated."
            )
        );
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

    try{
        // Path define karna 
        const  originalFilePath = path.normalize(path.resolve(image.originalPath));
        const processedFileName = `resized-${width}x${height}-${image.fileName}`;
        const processedFilePath = path.resolve('public','uploads', processedFileName);

        // resizing Image by sharp module
        await sharp(originalFilePath)
        .resize(parseInt(width),parseInt(height))
        .toFile(processedFilePath);

        // Update Database Entry
        image.processedPath = processedFilePath;
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
                    processedUrl: `/uploads/${processedFileName}`
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

    if(!imageId){
        throw new ApiError(400, "Image id is required for filtering");
    }

    const image = await Image.findById(imageId);
    if(!image || image.userId.toString() !== userId.toString()){
        throw new ApiError(403,"Access denied");
    }
    
    try {
        const originalFilePath = path.normalize(path.resolve(image.originalPath));
        const processedFileName = `grayscale-${image.fileName}`;
        const processedFilePath = path.resolve('public','uploads',processedFileName);

        await sharp(originalFilePath)
          .grayscale()
          .toFile(processedFilePath);

          image.processedPath = processedFilePath;
          image.processingType = 'grayscale';
          image.status = 'completed';
          await image.save();

          return res
            .status(200)
            .json(new ApiResponse(200, {
                ...image.toObject(),
                processedUrl: `/uploads/${processedFileName}`
            }, "Image filtered to grayscale successfully."));


    } catch (error) {

        image.status = 'failed';
        await image.save();
        console.error("Grayscale Processing Error:", error);
        throw new ApiError(500, `Image filtering failed: ${error.message}`);
    }
})

export { 
    uploadImageController, 
    getImageDetailsController,
    resizeImageController,
    grayscaleImageController
};