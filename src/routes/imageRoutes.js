import express from "express";
import { verifyJWT } from "../middlewares/authMiddleware.js"; 
import { uploadSingleImage } from "../middlewares/multerMiddleware.js"; 
import { 
    uploadImageController, 
    getImageDetailsController 
} from "../controllers/imageController.js"; 

const router = express.Router();

router.post(
    "/upload", 
    verifyJWT, 
    uploadSingleImage('image'), 
    uploadImageController
);

router.get("/:imageId", verifyJWT, getImageDetailsController);

export default router;