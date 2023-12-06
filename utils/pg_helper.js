import postgress from '../init/pgclient.js';
import error_resp from '../constants/errors.js';
import sanitizer from 'sanitizer';

export const selectSql = async (sql, values) => {
    return new Promise((resolve, reject) => {
        try {
            //console.log(sql, values);
            postgress.query(sql, values, function (error, results) {
                if (error) {
                    console.log(error);
                    //error_resp.Query_Error.error_msg.error = error.message;
                    resolve(error_resp.Query_Error.error_msg);
                } else {
                    resolve({ status_code: 'dc200', message: 'Success', results: results.rows });
                }
            });
        } catch (error) {
            console.error(`Error occured in select query ${error}`);
            reject('')
        }
    })
}

export const updateSql = async (sql, values) => {
    return new Promise((resolve, reject) => {
        try {
            postgress.query(sql, values, function (error, results) {
                if (error) {
                    console.log(error);
                    // error_resp.Query_Error.error_msg.error = error.message;
                    resolve(error_resp.Query_Error.error_msg);
                } else {
                    resolve({ status_code: 'dc200', message: 'Success', rows_affected: results.affectedRows });
                }
            });
        } catch (error) {
            reject('')
            console.error(`Error occured in addLocation ${error}`);
        }
    })
}

export const insertSql = async (sql, values) => {
    return new Promise((resolve, reject) => {
        try {
            postgress.query(sql, values, function (error, results) {
                if (error) {
                    console.log(error);
                    //error_resp.Query_Error.error_msg.error = error.message;
                    resolve(error_resp.Query_Error.error_msg);
                } else {
                    // console.log(results)
                    resolve({ status_code: 'dc200', message: 'Success', message_id: results.rows[0] });
                }
            });
        } catch (error) {
            reject('')
            console.error(`Error occured in insertSql ${error}`);
        }
    })
}


export const callProdecure = async () => {
    return new Promise((resolve, reject) => {
        try {
            postgress.query(sql, function (error, results) {
                if (error) {
                    resolve(error_resp.Query_Error.error_msg.toString().replace('<error_msg>', error.detail));
                } else {
                    console.log(results)
                    resolve({ status_code: 'dc200', message: 'Success', message_id: results.rows[0] });
                }
            });
        } catch (error) {
            reject('')
            console.error(`Error occured in addLocation ${error}`);
        }
    })
}

export const RecordExist = async (fieldName, fieldValue, tableName, schema_nm) => {
    return new Promise((resolve, reject) => {
        try {
            postgress.query(`select * from ${schema_nm}.${tableName} where ${fieldName} = ${fieldValue}`, function (error, results) {
                if (error) {
                    resolve(error_resp.Query_Error.error_msg.toString().replace('<error_msg>', error.detail));
                } else {
                    if (results.rows.length > 0) {
                        resolve(results.rows)
                    } else {
                        resolve(false);
                    }

                }
            });
        } catch (error) {
            reject('')
            console.error(`Error occured ${error}`);
        }
    })
}
