const SCHEMAS = {
    // Start Order Route Schema
    'login': {
        schema:
        {
            "type": "object",
            "properties": {
                "mobile": { "type": "number", "minLength": 10 },
                "password": { "type": "string", "minLength": 4 }
            },
            "required": ["mobile", "password"]
        }
    },
    'loginwithOTP': {
        schema:
        {
            "type": "object",
            "properties": {
                "mobile": { "type": "number", "minLength": 10 },
                "otp": { "type": "number", "minLength": 4 }
            },
            "required": ["mobile", "otp"]
        }
    },
    'register': {
        schema:
        {
            "type": "object",
            "properties": {
                "fullname": { "type": "string", "minLength": 1 },
                "mobile": { "type": "string", "minLength": 10 },
                "password": { "type": "string", "minLength": 4 },
                "account_type": { "type": "number", "minLength": 1 },
                "otp":{ "type": "number", "minLength": 4 },
            },
            "required": ["fullname", "mobile","password","account_type","otp"]
        }
    },
    'sendOTP': {
        schema:
        {
            "type": "object",
            "properties": {
                "mobilenumber": { "type": "number", "minLength": 10, "maxLength":10 },
                "type": { "type": "string", "minLength": 1 }
            },
            "required": ["mobilenumber","type"]
        }
    },
    'resendOTP': {
        schema:
        {
            "type": "object",
            "properties": {
                "mobilenumber": { "type": "number", "minLength": 10, "maxLength":10 },
                "type": { "type": "string", "minLength": 1 }
            },
            "required": ["mobilenumber","type"]
        }
    },
    'startTest': {
        schema:
        {
            "type": "object",
            "properties": {
                "p_name": { "type": "string", "minLength": 1},
                "p_age": { "type": "number", "minLength": 1 },
                "p_gender": { "type": "string", "minLength": 1 }
            },
            "required": ["p_name","p_age","p_gender"]
        }
    },
    'updateProfile': {
        schema:
        {
            "type": "object",
            "properties": {
                "age": { "type": "number", "minLength": 1 },
                "password": { "type": "string", "minLength": 1 }
            },
            "required": ["age"]
        }
    },
    'submitTest': {
        schema:
        {
            "type": "object",
            "properties": {
                "test_id": { "type": "number", "minLength": 1 },
                "answers": { "type": "array", "minLength": 1 }
            },
            "required": ["test_id","answers"]
        }
    },
    'generatePaymentLink': {
        schema:
        {
            "type": "object",
            "properties": {
                "plan_id": { "type": "number", "minLength": 1 }
            },
            "required": ["plan_id"]
        }
    },
    'generateTestPaymentLink': {
        schema:
        {
            "type": "object",
            "properties": {
                "plan_id": { "type": "number", "minLength": 1 }
            },
            "required": ["plan_id"]
        }
    },
    'updateFeedback': {
        schema:
        {
            "type": "object",
            "properties": {
                "test_id": { "type": "number", "minLength": 1 },
                "feedback": { "type": "string", "minLength": 1 }
            },
            "required": ["test_id","feedback"]
        }
    },

    

};

Object.freeze(SCHEMAS);

export default SCHEMAS;