import { ApiError } from "../utils/ApiError.js";

const errorMiddleware = (err,req,res,next) => {
    let statusCode = err.statusCode ||  500;
    let message = err.message || "Internal Server Error";


if(err.code === 11000) {
    statusCode = 409; 
  message = `Duplicate field value entered for ${Object.keys(err.keyValue).join(', ')}`;

}

res.status(statusCode).json({
    success : false,
    message : message,
    errors : err.errors || [] ,
    stack : process.env.NODE_ENV === 'development' ? err.stack : {}
});
};

export {errorMiddleware};