import schema from '../constants/schema.js';
import Validator from 'jsonschema';
const validatorObj = new Validator.Validator();
import error_resp from '../constants/errors.js'

//these apis wil be ignored from schema validation
let ignoredSchemaValidation = ['callback','deleteAccount'];

export const schemaValidator = async (req) => {
    return new Promise((resolve, reject) => {
        try {
            let subApiName = req.path.replace('/', '');
            subApiName = subApiName.split('/')[0];
            if (ignoredSchemaValidation.includes(subApiName)) {
                resolve({ status_code: 'dc200', message: 'Success' });
            }
            else if (schema[subApiName] != undefined) {
                let schemaObj = schema[subApiName].schema;
                try {
                    let resp = validatorObj.validate(req.body, schemaObj, { required: true, "throwError": true });
                    resolve({ status_code: 'dc200', message: 'Success' });
                } catch (error) {
                    resolve({ status_code: 'dc401', message: error['path'] + ' ' + error.message });
                }
            } else {
                resolve(error_resp.Schema_Error.error_msg);
            }
        } catch (error) {
            console.log(error);
            reject('')
            console.error(`Error occured in schema validation ${error}`);
        }
    })
}