import express from 'express';
import { createAuthToken, generateOTP, sendOTP, checkLoginAttempts, encryptData,checkUserAlreadyExists, validateOTP } from '../utils/helper.js';
import { insertSql, selectSql, updateSql } from '../utils/pg_helper.js';
import error_resp from '../constants/errors.js'
import EmailServices from '../utils/email_service.js';
import { validateToken } from '../utils/middlewares.js';
import md5 from 'md5';
import question from './question.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import { log } from 'console';
import axios from 'axios';
import crypto from 'crypto';
import jwt from "jsonwebtoken";

const router = express.Router();


const saltKey = process.env.PHONEPE_SALTKEY;
const saltIndex = process.env.PHONEPE_SALTINDEX;
const phonepe_api_url = process.env.PHONEPE_API;
const phonepe_MERCHANTID = process.env.PHONEPE_MERCHANTID;


router.get('/health', (req, res) => {
    const currentDate = new Date();
    const day = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
    const date = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const time = currentDate.toLocaleTimeString('en-US');
  
    res.json({ day, date, time });
  });

router.post('/register', async (req, res) => {
  console.log(req.body);
    const { fullname,mobile,password,registration_no,account_type,otp,register_type  } = req.body;
    if(fullname != undefined || mobile != undefined || password != undefined || account_type != undefined || otp != "" )
    {
     
        let status = await checkUserAlreadyExists(mobile);
        let validate;
        if(status){
          if(register_type == 'quickPay'){
            validate = true;
          }
          else{
            validate = await validateOTP(mobile,otp,'register');
          }
            
            if(validate == true){
                let sql ;
                let resp ;
               let password_ = md5(password);
               let userId_for_tk = '';
                if(account_type == 1 || account_type == 2 || account_type == 3 || account_type == 4){
                    //normal user
                    sql = `insert into ai.users (mobile,"password",ac_type_id,registration_no,created_at) values ($1,$2,$3,$4,now()) RETURNING user_id`
                    resp = await selectSql(sql,[mobile,password_,account_type,'']);
                    let userID_ = resp.results[0].user_id;
                    sql = `insert into ai.account (user_id,fullname,last_updated_at,last_updated_by) values ($1,$2,now(),'api')`;
                    resp = await selectSql(sql,[userID_,fullname]);
                    userId_for_tk = userID_;
                }
                else if(account_type == 2 && registration_no != ""){
                    //doctor 
                    sql = `insert into ai.users (mobile,"password",ac_type_id,registration_no,created_at,status) values ($1,$2,$3,$4,now(),$5) RETURNING user_id`
                    resp = await selectSql(sql,[mobile,password_,account_type,registration_no,'D']);
                    let userID_ = resp.results[0].user_id;
                    sql = `insert into ai.account (user_id,fullname,last_updated_at,last_updated_by) values ($1,$2,now(),'api')`;
                    resp = await selectSql(sql,[userID_,fullname]);
                    userId_for_tk = userID_;
                }
                else{
                    res.status(401).send({ status_code: 'dc200', message: 'For Doctor\'s Account, registration number should not be blank' });
                }
                let results = {};
                if(account_type == 1 || account_type == 2 || account_type == 3 || account_type == 4){
                    let auth_token = await createAuthToken(userId_for_tk,mobile,account_type);
                    results.user_id = userId_for_tk;
                    results.username = fullname;
                    results.account_type = account_type;
                    results.accessToken = auth_token;
                    results.tokenType = 'Bearer';
                     let response = { status_code: 'dc200', message: 'Success', results: results };
                     res.status(200).send(response);
                }
                else{
                    res.send(resp);
                }
                
            }
            else{
                res.status(401).send({ status_code: 'dc401', message: 'Incorrect OTP. Please try again' });
            }
        }
        else{
            res.status(200).send({ status_code: 'dc200', message: 'User with this mobile number already exists' });
        } 
    }
    else{
        res.status(401).send({ status_code: 'dc401', message: 'Please enter all required details' });
    }
    
   
});

router.post('/login', async (req, res) => {
    const { mobile,password  } = req.body;
    let status = await checkUserAlreadyExists(mobile);
    let password_ = md5(password);
    if(status == false){
        let sql = `select u.user_id,u.ac_type_id,u.status,a.fullname  from ai.users u,ai.account a  where u.user_id = a.user_id 
        and mobile = $1 and "password" = $2`;
        let resp = await selectSql(sql,[mobile,password_])
        if(resp.results.length>0){
            let user_id = resp.results[0].user_id;
            let ac_type_id = resp.results[0].ac_type_id;
            let ac_status = resp.results[0].status;
            let username = resp.results[0].fullname;
            let results = { };
            if(ac_status == 'A'){
                let auth_token = await createAuthToken(user_id,mobile,ac_type_id);
                results.user_id = user_id;
                results.username = username;
                results.account_type = ac_type_id;
                results.accessToken = auth_token;
                results.tokenType = 'Bearer';
                let response = { status_code: 'dc200', message: 'Success', results: results };
                res.status(200).send(response);

            }
            else if(ac_status == 'D'){
                  //doctor
                  res.status(401).send({ status_code: 'dc401', message: 'Your Account is under verification. Please contact support team or try after sometime' });
            }
            else if(ac_status == 'R'){
              //doctor
              res.status(401).send({ status_code: 'dc401', message: 'Your account has been deleted. For assistance, please contact our support team' });
        }
        }
        else{
            res.status(401).send({ status_code: 'dc401', message: 'Mobile number / password is wrong' });
        }
    }else{
        res.status(401).send({ status_code: 'dc401', message: 'No record found for this mobile number' });
        //res.status(error_resp.Invalid_Request.http_status_code).send(error_resp.Invalid_Request.error_msg);
    }
   
    
});

router.post('/loginwithOTP', async (req, res) => {
    const { mobile,otp  } = req.body;
    let status = await checkUserAlreadyExists(mobile);
    if(status == false){
      let validate = await validateOTP(mobile,otp,'login');
      if(validate == true){
        let sql = `select u.user_id,u.ac_type_id,u.status,a.fullname from ai.users u,ai.account a where u.user_id = a.user_id and mobile = $1`;
        let resp = await selectSql(sql,[mobile])
        if(resp.results.length>0){
            let user_id = resp.results[0].user_id;
            let ac_type_id = resp.results[0].ac_type_id;
            let ac_status = resp.results[0].status;
            let username = resp.results[0].fullname;
            let results = { };
            if((ac_type_id == 1 || ac_type_id == 2 )&& ac_status == 'A'){
                let auth_token = await createAuthToken(user_id,mobile,ac_type_id);
                results.user_id = user_id;
                results.username = username;
                results.account_type = ac_type_id;
                results.accessToken = auth_token;
                results.tokenType = 'Bearer';
                let response = { status_code: 'dc200', message: 'Success', results: results };
                res.status(200).send(response);

            }
            else if(ac_type_id == 2 && ac_status == 'D'){
                  //doctor
                  res.status(401).send({ status_code: 'dc401', message: 'Your Account is under verification. Please contact support team or try after sometime' });
            }
        }
        else{
            res.status(error_resp.Internal_Error.http_status_code).send(error_resp.Internal_Error.error_msg);
        }
      }
      else{
        res.status(401).send({ status_code: 'dc401', message: 'Incorrect OTP. Please try again' });
      }
    }
    else{
        res.status(401).send({ status_code: 'dc401', message: 'No record found for this mobile number' });
    }

    
});

router.post('/sendOTP', async (req, res) => {
    const { mobilenumber,type  } = req.body;
    if(mobilenumber != 0 && type != ""){
        let user_id = '';
        let sql,resp;
        // check userID against mobile number
        sql = `select user_id from ai.users where mobile = $1`;
        resp = await selectSql(sql, [mobilenumber]);
        if(resp.results.length>0){
            user_id = resp.results[0].user_id;
        }       

     //response       
    if(type == 'login' && user_id == '' ){
    res.status(401).send({ status_code: 'dc401', message: 'Mobile number not registered' });
    }
    else if(type == 'register' && user_id != '' ){
        res.status(401).send({ status_code: 'dc401', message: 'Mobile number already registered.' });
    }
    else{
    let sendOTP = await generateOTP(mobilenumber,type);
    res.send(sendOTP);
    }
  
    }
    else{
        res.status(error_resp.Invalid_Request.http_status_code).send(error_resp.Invalid_Request.error_msg);
    }
    
});

router.post('/resendOTP', async (req, res) => {
    const { mobilenumber,type  } = req.body;
    let sql = `select otp from ai.otp_token where user_id = $1 and status = 'A' and request_type = $2`;
    let resp = await selectSql(sql,[mobilenumber,type]);
    if(resp.results.length > 0){
        let db_value = resp.results[0].otp;
        let resentotP = await sendOTP(mobilenumber,db_value); 
        res.send(resp);
    }
    else{
        res.status(error_resp.Invalid_Request.http_status_code).send(error_resp.Invalid_Request.error_msg);
    }
});

router.get('/getOTP',async(req,res) =>{
    const { mobilenumber,type  } = req.body;

    let sql = `select otp from ai.otp_token where user_id = $1 and status = 'A' and request_type = $2`;
    let resp = await selectSql(sql,[mobilenumber,type]);
    let db_value = '';
    if(resp.results.length > 0){
        db_value = resp.results[0].otp;
    }
    res.status(200).send({ status_code: 'dc200', message: db_value });
   

})

router.get('/getTestDetails',async(req,res) =>{

    let sql = `select * from ai.test_type order by test_type_id `;
    let resp = await selectSql(sql);
    res.send(resp);
})

router.get('/getTestDetails/:test_type_id',async(req,res) =>{
    let test_id = req.params.test_type_id;
    let sql = `select * from ai.test_type where test_type_id = $1`;
    let resp = await selectSql(sql,[test_id]);
    resp.results[0].consultation_fee = 84.75;
    resp.results[0].gst = 15.25;
    resp.results[0].total_payable = 100;
    res.send(resp);
})

router.post('/callback', async (req, res) => {
  console.log('callback called');
    const input = req.body;
    let cb_response = '';let cb_transactionID='';let cb_referenceID='';let cb_amount='';
    let sql;
    let resp;
    cb_response = req.body.response;
    console.log(cb_response);
    let cb_res2 = req.body;
    if(cb_res2.code == "PAYMENT_SUCCESS"){
      cb_transactionID = cb_res2.transactionId;
      cb_referenceID = cb_res2.providerReferenceId;
      cb_amount = cb_res2.amount;
    }
    try{
    if(cb_response != '' || cb_res2.code == "PAYMENT_SUCCESS"){
      let decodedObject;
      if(cb_response != '' || cb_response != undefined){
        const buffer = Buffer.from(req.body.response, 'base64');
        decodedObject = JSON.parse(buffer.toString());
        cb_transactionID = decodedObject.data.merchantTransactionId;
        cb_referenceID = decodedObject.data.transactionId;
        cb_amount = decodedObject.data.amount;
      }
      if(decodedObject.success == true || decodedObject.code == "PAYMENT_SUCCESS" || cb_res2.code == "PAYMENT_SUCCESS"){
        // payment successfully completed 
        //update ai.pg_payment
        sql = `update ai.pg_payment set pg_status = 'PAYMENT_SUCCESS', status = 'success' where pg_transaction_id = $1 RETURNING user_id;`;
        resp = await selectSql(sql,[cb_transactionID]);
        //console.log(resp);
        let userID = resp.results[0].user_id;
        let test_type_id = resp.results[0].test_type_id;
        
        //insert into pgdeatils
        sql = `INSERT INTO ai.payment_details (pg_transaction_id, user_id, p_state, p_transactionId, p_amount, p_type, p_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, now())`
        resp = await insertSql(sql,[cb_transactionID,userID,'COMPLETED',cb_referenceID,cb_amount,'-'])
        //console.log(resp);

        // insert into  ai.test_details
        sql = `insert into ai.test_details (user_id,pg_id,status,test_type_id) values ($1,$2,$3,$4)`;
        resp = await selectSql(sql,[userID,cb_transactionID,'pending',test_type_id]);
        //console.log(resp);
        res.status(200).send(`
       <div><center>
       <h1>Success</h1>
       <p>Your payment is successful. Please wait and do not click back, you will be automatically redirected to the assessment...</p>
       </center></div>
         
      
      `);
      }
      else if (decodedObject.success == false){
        let code = decodedObject.code;
        if (code == "PAYMENT_ERROR"){
         // payment failed
         sql = `update ai.pg_payment set pg_status = 'PAYMENT_ERROR', status = 'failed' where pg_transaction_id = $1;`;
         resp = await updateSql(sql,[cb_transactionID]);
         res.send("Failed");

        }
        else if (code == "PAYMENT_PENDING"){
         // payment is pending
         sql = `update ai.pg_payment set pg_status = 'PAYMENT_PENDING', status = 'failed' where pg_transaction_id = $1;`;
         resp = await updateSql(sql,[cb_transactionID]);
         res.send("Pending");
        }
        else{
             res.send(code);
        }
       }

    }
    else{
      res.send("checking");
    }

        const finalXHeader = crypto.createHash('sha256')
          .update(`/pg/v1/status/${phonepe_MERCHANTID}/${cb_transactionID}${saltKey}`)
          .digest('hex') + '###' + saltIndex;
      
      //  try 
        // {
        //   const response = await axios.get(`${phonepe_api_url}/pg/v1/status/${phonepe_MERCHANTID}/${decodedObject.data.transactionId}`, {
        //     headers: {
        //       'Content-Type': 'application/json',
        //       'accept': 'application/json',
        //       'X-VERIFY': finalXHeader,
        //       'X-MERCHANT-ID': decodedObject.data.transactionId,
        //     },
        //   });
        //   console.log(`/pg/v1/status/${phonepe_MERCHANTID}/${decodedObject.data.transactionId}${saltKey}`);
        //   //console.log('Response:', response);
        //   let ResData = response.data;
        //   let ResData2 = response.data.data;
         
        //   console.log("--------===------------------------===------------------------===------------------------===----------------");
        //   console.log(ResData2);
        //   console.log("--------===------------------------===------------------------===------------------------===----------------");
        //   // Handle the response
        
          // if(ResData.success == true && ResData.code == "PAYMENT_SUCCESS"){
          
          //   sql = `update ai.pg_payment set pg_status = 'PAYMENT_SUCCESS', status = 'success' where pg_transaction_id = $1 RETURNING user_id,test_type_id;`;
          //   resp = await selectSql(sql,[decodedObject.data.transactionId]);
          //   // console.log(resp);
          //   let userID = resp.results[0].user_id;
          //   let test_type_id = resp.results[0].test_type_id;
            
          //   //insert into pgdeatils
          //   sql = `INSERT INTO ai.payment_details (pg_transaction_id, user_id, p_state, p_transactionId, p_amount, p_type, p_created_at)
          //   VALUES ($1, $2, $3, $4, $5, $6, now())`
          //   resp = await insertSql(sql,[decodedObject.data.transactionId,userID,ResData2.state,ResData2.transactionId,ResData2.amount,ResData2.paymentInstrument.type])

          //   // insert into  ai.test_details
          //   sql = `insert into ai.test_details (user_id,pg_id,status,test_type_id) values ($1,$2,$3,$4)`;
          //   resp = await selectSql(sql,[userID,decodedObject.data.transactionId,'pending',test_type_id]);

          //   res.status(200).send(`
          //  <div><center>
          //  <h1>Success</h1>
          //  <p>Your payment is successful. Please wait and do not click back, you will be automatically redirected to the assessment...</p>
          //  </center></div>
             
          
          // `);
          // }
          // else if (ResData.success == false){
          //  let code = ResData.code;
          //  if (code == "PAYMENT_ERROR"){
          //   // payment failed
          //   sql = `update ai.pg_payment set pg_status = 'PAYMENT_ERROR', status = 'failed' where pg_transaction_id = $1;`;
          //   resp = await updateSql(sql,[decodedObject.data.transactionId]);
          //   res.send("Failed");

          //  }
          //  else if (code == "PAYMENT_PENDING"){
          //   // payment is pending
          //   sql = `update ai.pg_payment set pg_status = 'PAYMENT_PENDING', status = 'failed' where pg_transaction_id = $1;`;
          //   resp = await updateSql(sql,[decodedObject.data.transactionId]);
          //   res.send("Pending");
          //  }
          //  else{
          //       res.send(code);
          //  }
          // }
        //}
  }
         catch (error) {
          //console.error('Error:', error);
          res.status(500).send('An error occurred');
        }
    
});


  router.get('/generate_pdf/:report_id/:token', async(req, res) => {
    let testID = req.params.report_id;
    const token = req.params.token;
    let validateTkn = await validateToken_pdf(token);
    //console.log(validateTkn);
    let userID;
    if (validateTkn && validateTkn.user_id) {
      userID = validateTkn.user_id;
  //check userID
  let sqlcheck = ` select ac_type_id from ai.users u where user_id = $1`;
  let check_res = await selectSql(sqlcheck,[userID]);
  let account_type = check_res.results[0].ac_type_id;
  
    let report_date = "";
    let name = "";
    let age = "";
    let mobile = "";
    let result_data;
    let sql = `select u.user_id,u.mobile,td.patient_name,td.patient_age,td.patient_gender,TO_CHAR(td.test_date, 'DD Month YYYY') AS test_date,TO_CHAR(td.test_date, 'HH:MI AM') AS test_time,
  td.test_result_id,td.assessment_result as test_result,td.test_feedback  from ai.test_details td , ai.users u
    where td.user_id = u.user_id and td.status = 'complete' and test_result_id  = $1 `;
    let resp = await selectSql(sql, [testID]);
    if (resp.results.length > 0 && (userID == resp.results[0].user_id || account_type == 2)) {
      report_date = resp.results[0].test_date;
      name = resp.results[0].patient_name;
      age = resp.results[0].patient_age;
      mobile = resp.results[0].mobile;
      result_data = resp.results[0].test_result;
  
      // Create a new PDF document
      const doc = new PDFDocument({ size: "A4" });
  
      // Set the response headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=report.pdf");
  
      // Pipe the PDF document to the response
      doc.pipe(res);
  
      // Specify the file path relative to your Node.js script
      const imagePath = "./assets/logo.png";
  
      // Read the image file synchronously
      const imageData = fs.readFileSync(imagePath);
  
      // Calculate image dimensions and positioning
      const imageWidth = 500; // Replace with actual image width
      const imageHeight = 500; // Replace with actual image height
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const imageX = (pageWidth - imageWidth) / 2;
      const imageY = (pageHeight - imageHeight) / 2;
  
      // Generate the PDF content
  
      // Set font size variables for easy customization
      const mainheadingFontSize = 25;
      const headingFontSize = 18;
      const subHeadingFontSize = 12;
      const textFontSize = 14;
  
      // Add heading
      doc
        .fontSize(mainheadingFontSize)
        .text("Assessment Report", { align: "center", bold: true });
  
      // Add Report ID
      doc.moveDown(2);
      doc
        .fontSize(headingFontSize)
        .text("Report ID - #" + req.params.report_id, { indent: 5 });
  
      // Add date
      doc.fontSize(subHeadingFontSize).text(report_date, { indent: 5 });
  
      // Add horizontal line
      doc.moveDown();
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
  
      // Add more sections
  
      // Section 1
      doc.moveDown(2);
      doc
        .fontSize(headingFontSize)
        .text("Patient Details", { indent: 5, bold: true });
      // Section 1 content
      doc.fontSize(textFontSize).text(name, { indent: 5 });
      doc.fontSize(textFontSize).text(age, { indent: 5 });
      doc.fontSize(textFontSize).text(mobile, { indent: 5 });
  
      // Section 1 horizontal line
      doc.moveDown();
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
  
      // Section 2
      doc.moveDown(2);
      // Section 3 content (based on dynamic JSON data)
      if (result_data.prediction && result_data.prediction.length > 0) {
        doc.fontSize(headingFontSize).text("Results:", { indent: 5, bold: true });
        doc.moveDown();
        result_data.prediction.forEach((result) => {
          doc.fontSize(textFontSize).text(result, { indent: 5 });
        });
      }
  
      if (result_data.diagnose && result_data.diagnose.length > 0) {
        doc.moveDown();
        result_data.diagnose.forEach((diagnosis) => {
          doc.fontSize(textFontSize).text(diagnosis, { indent: 5 });
        });
      }
  
      // Section 3 horizontal line
      doc.moveDown();
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
  
      // Add the image with opacity
      doc.image(imageData, imageX, imageY, {
        width: imageWidth,
        height: imageHeight,
      });
  
      // Finalize the PDF document
      doc.end();
    } else {
      // Create a new PDF document
      const doc = new PDFDocument({ size: "A4" });
      // Set the response headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=report.pdf");
      // Pipe the PDF document to the response
      doc.pipe(res);
      // Generate the PDF content
      // Set font size variables for easy customization
      const headingFontSize = 25;
      // Add heading
      doc
        .fontSize(headingFontSize)
        .text("Assessment Report", { align: "center", bold: true });
      doc.fontSize(20).text("No Data", { align: "center", bold: true });
      // Finalize the PDF document
      doc.end();
    }
  } else {
    console.log('Invalid user ID');
    const doc = new PDFDocument({ size: "A4" });
    // Set the response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=report.pdf");
    // Pipe the PDF document to the response
    doc.pipe(res);
    // Generate the PDF content
    // Set font size variables for easy customization
    const headingFontSize = 25;
    // Add heading
    doc
      .fontSize(headingFontSize)
      .text("Assessment Report", { align: "center", bold: true });
    doc.fontSize(20).text("No Data", { align: "center", bold: true });
    // Finalize the PDF document
    doc.end();
  }
  });

  router.get('/contactDetail', async(req, res) => {
    let result = {};
    result.phone = '0522-3570992';
    result.email = 'dectrocelheathcare@gmail.com';
    result.address = '3rd Floor Medtech, Central Library SGPGI, Lucknow 226014 Uttar Pradesh India';

     res.status(200).send({ status_code: 'dc200', message: 'Success', result:result });
    });


  export const validateToken_pdf = async (AuthToken) => {
    let token = AuthToken.replace("Bearer ", "");
  
    if (!token) {
      return 'Unauthorized';
    }
  
    try {
      const decoded = await jwt.verify(token, process.env.JWT_SECRET);
      const currentTime = Math.floor(Date.now() / 1000);
  
      if (decoded.exp <= currentTime) {
        return 'Token expired';
      }
  
      return {
        user_id: decoded.user_id,
        account_type: decoded.account_type
      };
    } catch (err) {
      return 'Invalid token';
    }
  };
  


export default router;
