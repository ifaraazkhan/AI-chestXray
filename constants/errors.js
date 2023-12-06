const error = {
    Email_Required: { http_status_code: 400, error_msg: { status_code: 'dc400', message: 'Email required' } },
    Invalid_Token: { http_status_code: 401, error_msg: { status_code: 'dc401', message: 'Invalid token' } },
    Invalid_APIKEY: { http_status_code: 401, error_msg: { status_code: 'dc401', message: 'Invalid apikey' } },
    Schema_Error: { http_status_code: 422, error_msg: { status_code: 'dc422', message: 'Error occured in schema validation' } },
    No_Record: { http_status_code: 404, error_msg: { status_code: 'dc404', message: 'No record found' } },
    Not_Authorized: { http_status_code: 401, error_msg: { status_code: 'dc401', message: 'You are not authorized to use this service' } },
    Current_Password_Wrong: { http_status_code: 401, error_msg: { status_code: 'dc401', message: 'Current password is wrong' } },
    Invalid_OTP: { http_status_code: 401, error_msg: { status_code: 'dc401', message: 'Your OTP is wrong or expired, please try login again' } },
    No_OTP: { http_status_code: 401, error_msg: { status_code: 'dc401', message: 'OTP is not yet generated, please try login again' } },
    Invalid_Request: { http_status_code: 404, error_msg: { status_code: 'dc404', message: 'Invalid request' } },
    Invalid_File_Format: { http_status_code: 404, error_msg: { status_code: 'dc404', message: 'File format not supported' } },
    No_APIKEY_TOKEN: { http_status_code: 404, error_msg: { status_code: 'dc404', message: 'Key/Token provided is invalid' } },
   Internal_Error: { http_status_code: 500, error_msg: { status_code: 'dc500', message: 'Internal server error occured' } },
}

Object.freeze(error);

export default error;