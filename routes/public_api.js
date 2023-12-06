import express from 'express';
import AWS from 'aws-sdk';
import { selectSql } from '../utils/pg_helper.js';
import { decryptData } from '../utils/helper.js';
import error_resp from '../constants/errors.js'

const router = express.Router();

const BUCKET_NAME = process.env.S3_BUCKET;
const IAM_USER_KEY = process.env.S3_KEY;
const IAM_USER_SECRET = process.env.S3_SECRET;

router.get('/hello', async (req, res) => {
    res.status(200).send("Hello");
})

router.get('/getEvidence/:file/:enc_data', async (req, res) => {
    const { file, enc_data } = req.params;
    // const schema_nm = req.headers.schema_nm;
    let check_value = decryptData(enc_data);
    let current_ts = Math.ceil(Date.now() / 1000);
    // console.log(current_ts,'check',check_value);
    // console.log(current_ts - Number(check_value));
    if (current_ts - Number(check_value) < 15) {
        let sql = `SELECT split_part(pte.evidence_value,'.',2) AS ext,pte.evidence_value as file_name FROM ops_1.project_task_evidence pte where evidence_value like '${file}.%'`
        let resp = await selectSql(sql);
        if (resp.results.length > 0) {
            let file_name = resp.results[0].file_name, ext = resp.results[0].ext;
            let s3 = new AWS.S3({
                accessKeyId: IAM_USER_KEY,
                secretAccessKey: IAM_USER_SECRET,
                // region: process.env.AWS_REGION,
            });
            let params = { Bucket: BUCKET_NAME, Key: file_name };
            let output = await new Promise((resolve, reject) => {
                s3.getObject(params, function (err, data) {
                    if (!err)
                        return resolve(data.Body);
                });
            });
            // console.log(ext);
            if (ext == 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
            } else if (ext == 'doc') {
                res.setHeader('Content-Type', 'application/msword');
            } else if (ext == 'docx') {
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            } else if (ext == 'xls') {
                res.setHeader('Content-Type', 'application/vnd.ms-excel');
            }
            else if (ext == 'xlsx') {
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            }
            else if (ext == 'ppt') {
                res.setHeader('Content-Type', 'application/vnd.ms-powerpoint');
            }
            else if (ext == 'pptx') {
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
            }
            else {
                res.setHeader('Content-Type', `image/${ext}`);
            }
            // res.setHeader('Content-Disposition', 'attachment');
            res.status(200).send(output);

        } else {
            res.status(error_resp.No_Record.http_status_code).send(error_resp.No_Record.error_msg);
        }
    } else {
        res.status(error_resp.Invalid_Request.http_status_code).send(error_resp.Invalid_Request.error_msg);
    }
})
router.get('/getDocument/:file/:enc_data', async (req, res) => {
    const { file, enc_data } = req.params;
    // const schema_nm = req.headers.schema_nm;
    // const schema_nm = req.headers.schema_nm;
    let check_value = decryptData(enc_data);
    let current_ts = Math.ceil(Date.now() / 1000);
    // console.log(current_ts,'check',check_value);
    // console.log(current_ts - Number(check_value));
    if (current_ts - Number(check_value) < 15) {
        let sql = `SELECT split_part(pte.document_value,'.',2) AS ext,pte.document_value as file_name FROM ops_1.project_pnp_documents pte where document_value like '${file}.%'`;
        let resp = await selectSql(sql);
        if (resp.results.length > 0) {
            let file_name = resp.results[0].file_name, ext = resp.results[0].ext;
            let s3 = new AWS.S3({
                accessKeyId: IAM_USER_KEY,
                secretAccessKey: IAM_USER_SECRET,
                // region: process.env.AWS_REGION,
            });
            let params = { Bucket: BUCKET_NAME, Key: file_name };
            let output = await new Promise((resolve, reject) => {
                s3.getObject(params, function (err, data) {
                    console.log(err, data);
                    if (!err)
                        return resolve(data.Body);
                });
            });
            // console.log(ext);
            if (ext == 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
            } else if (ext == 'doc') {
                res.setHeader('Content-Type', 'application/msword');
            } else if (ext == 'docx') {
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            } else if (ext == 'xls' || ext == 'xlsx') {
                res.setHeader('Content-Type', 'application/vnd.ms-excel');
            } else {
                res.setHeader('Content-Type', `image/${ext}`);
            }
            // res.setHeader('Content-Disposition', 'attachment');
            res.status(200).send(output);


        } else {
            res.status(error_resp.No_Record.http_status_code).send(error_resp.No_Record.error_msg);
        }
    } else {
        res.status(error_resp.Invalid_Request.http_status_code).send(error_resp.Invalid_Request.error_msg);
    }
})

router.get('/getControlEvidence/:file/:enc_data', async (req, res) => {
    const { file, enc_data } = req.params;
    // const schema_nm = req.headers.schema_nm;
    // const schema_nm = req.headers.schema_nm;
    let check_value = decryptData(enc_data);
    let current_ts = Math.ceil(Date.now() / 1000);
    // console.log(current_ts,'check',check_value);
    // console.log(current_ts - Number(check_value));
    if (current_ts - Number(check_value) < 15) {
        let sql = `SELECT split_part(pte.evidence_value,'.',2) AS ext,pte.evidence_value as file_name FROM ${schema_nm}.hitrust_control_evidences pte where evidence_value like '${file}.%'`;
        let resp = await selectSql(sql);
        if (resp.results.length > 0) {
            let file_name = resp.results[0].file_name, ext = resp.results[0].ext;
            let s3 = new AWS.S3({
                accessKeyId: IAM_USER_KEY,
                secretAccessKey: IAM_USER_SECRET,
                // region: process.env.AWS_REGION,
            });
            let params = { Bucket: BUCKET_NAME, Key: file_name };
            let output = await new Promise((resolve, reject) => {
                s3.getObject(params, function (err, data) {
                    console.log(err, data);
                    if (!err)
                        return resolve(data.Body);
                });
            });
            // console.log(ext);
            if (ext == 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
            } else if (ext == 'doc') {
                res.setHeader('Content-Type', 'application/msword');
            } else if (ext == 'docx') {
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            } else if (ext == 'xls' || ext == 'xlsx') {
                res.setHeader('Content-Type', 'application/vnd.ms-excel');
            } else {
                res.setHeader('Content-Type', `image/${ext}`);
            }
            // res.setHeader('Content-Disposition', 'attachment');
            res.status(200).send(output);


        } else {
            res.status(error_resp.No_Record.http_status_code).send(error_resp.No_Record.error_msg);
        }
    } else {
        res.status(error_resp.Invalid_Request.http_status_code).send(error_resp.Invalid_Request.error_msg);
    }

})
export default router;