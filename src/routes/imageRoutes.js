import express from "express";
import { verifyJWT } from "../middlewares/authMiddleware.js"; 
import { uploadSingleImage } from "../middlewares/multerMiddleware.js"; 
import { 
    uploadImageController, 
    getImageDetailsController,
    resizeImageController,
    grayscaleImageController
} from "../controllers/imageController.js"; 

const router = express.Router();

router.post(
    "/upload", 
    verifyJWT, 
    uploadSingleImage('image'), 
    uploadImageController
);

router.post("/resize",verifyJWT,resizeImageController);
router.post("/grayscale", verifyJWT, grayscaleImageController);

router.get("/:imageId", verifyJWT, getImageDetailsController);

export default router;