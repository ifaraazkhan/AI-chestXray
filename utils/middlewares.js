import jwt from "jsonwebtoken";
import { selectSql, updateSql } from "./pg_helper.js";
import { schemaValidator } from "./validator_helper.js";
import error_resp from "../constants/errors.js";
import { createAuthToken } from "./helper.js";

const PUBLIC_API = ""; //process.env.PUBLIC_API;


export const schemaValidation = async (req, res, next) => {
    if (req.method == 'POST') {
        let resp = await schemaValidator(req);
        if (resp.status_code == 'dc200') {
            next();
        } else {
            res.status(401).send(resp);
        }
    } else {
        next();
    }
}

export const validateToken = (req, res, next) => {
  let token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (token !== undefined) {
    token = token.replace("Bearer ", "");
  }
  
  if (!token) {
    return res.status(401).send({ status_code: 'dc401', message: 'Unauthorized' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ status_code: 'dc403', message: 'Invalid token' });
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const { user_id, mobile, account_type } = decoded;

    if (decoded.exp <= currentTime) {
      // Token has expired, return a 403 Forbidden status
      return res.status(403).send({ status_code: 'dc403', message: 'Token expired' });
    }

    const newToken = createAuthToken(user_id, mobile, account_type);

    res.setHeader('Authorization', `Bearer ${newToken}`);
    req.headers.user_id = user_id;
    req.headers.account_type = account_type;
    req.headers.account_type = mobile;

    res.setHeader('Authorization', `Bearer ${token}`);
    next();
  });
};


export const fileFormatFilter = function (req, file, cb) {
    // Accept images only
    // let valid_formats = 'jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF';
    // let expre = `/\.(${valid_formats})$/`
    if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF|doc|docx|pdf|xls|xlsx|svg|webp|jfif|msg|MSG|eml|EML|zip|ZIP|ppt|PPT|pptx|PPTX)$/)) {
        req.fileValidationError = 'Only image files are allowed!';
        return cb(null, true);
    }
    cb(null, true);
};
