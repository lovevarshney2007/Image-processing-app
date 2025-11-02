import express from "express";
import {
    registerController,
    loginController,
    logoutController,
    refreshAccessTokenController,
    forgotPasswordController,
    resetPasswordController,
    socialLoginMockController,
    updatePasswordController
} from "../controllers/authController.js"
import {verifyJWT}  from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register",registerController)
router.post("/login",loginController);
router.post("/refresh-token",refreshAccessTokenController);
router.post("/update-password", verifyJWT, updatePasswordController);
router.post("/logout", verifyJWT, logoutController);
router.post("/forgot-password", forgotPasswordController); 
router.post("/reset-password/:token", resetPasswordController);
router.post("/social-mock", socialLoginMockController);


export default router;