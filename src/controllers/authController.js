import { User } from "../models/userModel.js";
import JWT from "jsonwebtoken";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import crypto from "crypto";

// generateAccessAndRefreshTokens
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found for token generation");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Error generating tokens: " + error.message);
  }
};

// Register User
const registerController = asyncHandler(async (req, res) => {
  const {  userName, email, password } = req.body;

  if (
    [ userName, email, password].some(
      (field) => !field || field.trim() === ""
    )
  ) {
    throw new ApiError(
      400,
      "All fields (name,userName,email,password) are required"
    );
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "User Already registered , Please Login");
  }

  const user = await User.create({  userName, email, password });
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(201,createdUser ,"User registered successfully")
    );
});

// Login User
const loginController = asyncHandler(async (req, res) => {
  const { email, userName, password } = req.body;

  if (!email && !userName) { 
     throw new ApiError(400, "Email/Username and Password Are Required");
}

  const user = await User.findOne({ email }).select("+password +refreshToken");
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user Credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: process.env.Node_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
        },
        "User logged in Successfully"
      )
    );
});

// Logout User
const logoutController = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $set: { refreshToken: undefined },
  });

  const options = {
    httpOnly: true,
    secure: process.env.Node_ENV === "production",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logout successfully"));
});

// Refresh AccessToken Controller
const refreshAccessTokenController = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is missing");
  }
    const decodedToken = JWT.verify(
      incomingRefreshToken,
      process.env.JWT_SECRET
    );


    const user = await User.findById(decodedToken?._id).select("+refreshToken");

    if (!user || incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    const options = {
      httpOnly: true,
      secure: process.env.Node_ENV === "production",
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken },
          "Access Token refreshed successfully"
        )
      );
  
});

// Forgot Passworder Controller
const forgotPasswordController = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email address is required to reset password.");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(
      404,
      "User not found. Please register first or check your email address."
    );
  }

  const resetToken = crypto.randomBytes(32).toString("hex");

  user.passwordResetToken = resetToken;
  user.passwordResetExpires = Date.now() + 3600000;

  await user.save({ validateBeforeSave: false });

  const passwordResetURL = `${req.protocol}://${req.get(
    "host"
  )}/api/v1/auth/reset-password/${resetToken}`;

  console.log("Password Reset Token");
  console.log(`URL for ${email}: ${passwordResetURL}`);
  console.log(`Token expires in 1 hour.`);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset link sent to email."));
});

// Reset password (verify token and change password)
const resetPasswordController = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    throw new ApiError(400, "Password and confirm password do not match.");
  }

  if (!password || password.length < 8) {
    throw new ApiError(400, "New password must be at least 8 characters long.");
  }

  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, "Token is invalid or has expired.");
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { accessToken },
        "Password reset successful and user logged in."
      )
    );
});

// social Login like google and github
const socialLoginMockController = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, " Email is required for  login.");
  }

  let user = await User.findOne({ email }).select("+password +refreshToken");

  if (!user) {
    user = await User.create({
      // name: "Social User",
      userName : "mockUsername",
      email: email,
      password: "MOCKED_PASSWORD_SOCIAL",
      role: "user",
    });
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
        },
        "Social Login Mock Successful"
      )
    );
});

export {
  generateAccessAndRefreshTokens,
  registerController,
  loginController,
  logoutController,
  refreshAccessTokenController,
  forgotPasswordController,
  resetPasswordController,
  socialLoginMockController,
};
