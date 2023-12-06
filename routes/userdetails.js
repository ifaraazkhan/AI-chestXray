import express from 'express';
import { selectSql, insertSql, updateSql, RecordExist } from '../utils/pg_helper.js';
import { createAuthToken, generateOTP, sendOTP, validateOTP,checkSuperUserAccount } from '../utils/helper.js';
import { fileFormatFilter } from '../utils/middlewares.js';
import error_resp from '../constants/errors.js';
import sanitizer from 'sanitizer';
import email_service from '../utils/email_service.js';
import { encryptData } from '../utils/helper.js';
import { postRequest, getRequest } from '../utils/http_utility.js';
import path from 'path';
import e from 'express';
import url from 'url';
import https from 'https';
import fs from 'fs';
import request from 'request';
import md5 from 'md5';
import question from './question.js';
import questionCLD from './questionCLD.js';
import axios from 'axios';

const router = express.Router();


router.post('/startTest', async(req,res)=>{
  const {p_name,p_age,p_gender,test_id} = req.body;
  const userID = req.headers.user_id;
  console.log("startTest ---> ",p_name,p_age,p_gender,test_id);

  try {
  //   let sql = `select test_result_id from dc.test_details where user_id = $1 and status = 'pending'`;
  // let resp = await selectSql(sql,[userID]);
  // let testID = resp.results[0].test_result_id;

  // console.log(testID);
  let sql = `update dc.test_details set patient_name = $1, patient_age = $2, patient_gender = $3, test_date = now() 
  where user_id = $4 and test_result_id = $5`;
  console.log(sql);
  let resp = await updateSql(sql,[p_name,p_age,p_gender,userID,test_id]);

  res.send(resp);
    
  } catch (error) {
    res.status(500).send("Invalid Request");
  }
  

})

router.get('/getProfile', async(req,res)=>{
  const userID = req.headers.user_id;
  let sql = `select a.fullname,a.u_age,u.mobile,u.registration_no,u.ac_type_id from dc.account a , dc.users u where a.user_id = u.user_id and a.user_id = $1`;
  let resp = await selectSql(sql,[userID]);
  res.send(resp);

})

router.post('/updateProfile', async(req,res)=>{
  const {age,password} = req.body;
  const userID = req.headers.user_id;

  let sql = `update dc.account set u_age = $1 where user_id = $2`;
  let resp = await updateSql(sql,[age,userID]);

  if(password.trim() != '' || password != undefined){
    let password_ = md5(password);
    sql = `update dc.users set "password" = $1 where user_id = $2`;
    resp = await updateSql(sql,[password_,userID]);
  }
  res.send(resp);

})

router.get('/getMedicalRecordsbyID/:test_id', async(req,res)=>{
  const userID = req.headers.user_id;
  let testID = req.params.test_id;

  let sql = `select u.mobile,td.patient_name,td.patient_age,td.patient_gender,TO_CHAR(td.test_date, 'DD Month YYYY') AS test_date,TO_CHAR(td.test_date, 'HH:MI AM') AS test_time,
  td.test_result_id,td.assessment_result as test_result,td.test_feedback  from dc.test_details td , dc.users u
    where td.user_id = u.user_id and td.status = 'complete' and test_result_id  = $1 `;
  let resp = await selectSql(sql,[testID]);
  res.send(resp);

})
router.get('/getMedicalRecords', async(req,res)=>{
  const userID = req.headers.user_id;

  let sql = `select patient_name,patient_age,patient_gender,TO_CHAR(test_date, 'DD Month YYYY') AS test_date,TO_CHAR(test_date, 'HH:MI AM') AS test_time,test_result_id from dc.test_details 
  where status = 'complete' and user_id = $1 order by test_result_id desc `;
  let resp = await selectSql(sql,[userID]);
  res.send(resp);

})

router.get('/searchRecords/:mobile', async(req,res)=>{
  const userID = req.headers.user_id;
  const mobileNumber = req.params.mobile;

  // check for records exist for mobilenumber searched 
  let sql = `select count(td.test_result_id) from dc.test_details td,dc.users u where td.user_id = u.user_id and  td.status = 'complete' and u.mobile = $1`;
  let resp = await selectSql(sql,[mobileNumber]);
  let count_ = resp.results[0].count;
  if(count_ == 0){
    res.status(401).send({ status_code: 'dc401', message: 'No reports found' });
  }
  else{
    // send OTP 
    let sendOTP = await generateOTP(mobileNumber,'search');
    res.status(200).send({ status_code: 'dc200',message:"success", results: `OTP send to ${mobileNumber}` });
  }

})

router.get('/getPatientRecords/:mobile/:otp', async(req,res)=>{
  const userID = req.headers.user_id;
  const mobileNumber = req.params.mobile;
  const OTP = req.params.otp;

  // validate otp 
  let validate = await validateOTP(mobileNumber,OTP,'search');
  if(validate == true){
    // get records by mobile number 
    let sql = `select td.patient_name,td.patient_age,td.patient_gender,TO_CHAR(td.test_date, 'DD Month YYYY') AS test_date,
    TO_CHAR(td.test_date, 'HH:MI AM') AS test_time,td.test_result_id
        from dc.test_details td, dc.users u  where td.user_id = u.user_id and td.status = 'complete' and u.mobile = $1 order by td.test_result_id desc`;
    let resp = await selectSql(sql,[mobileNumber]);
    res.send(resp);
  }else{
    res.status(401).send({ status_code: 'dc401', message: 'Invalid OTP' });
  }

})

router.get('/getQuestionList/:test_type_id',async(req,res) => {
  const userID = req.headers.user_id;
  const testID = req.params.test_type_id;
 //first validate user for payment then proceed
 
 if(testID == 1){
  res.status(200).send({ status_code: 'dc200', message: 'Success',results:question });
 }
 else if(testID == 2){
  res.status(200).send({ status_code: 'dc200', message: 'Success',results:questionCLD });
 }
 else{
  res.status(401).send({ status_code: 'dc401', message: 'No Test Questions'});
 }
  
    
})

router.post("/submitTest", async (req, res) => {
  const userID = req.headers.user_id;
  let { test_id, answers } = req.body;
  let externalAPI_response ='';
  // console.log("answers", answers);
  // console.log("testID", test_id);
  answers = answers.map((str) => parseInt(str));
  // console.log("answers", answers);
  try {
    //first check whether report already generated for this test_id or not
    let sql = `select count(*) from dc.test_details where status = 'complete' and test_result_id = $1`;
    let resp = await selectSql(sql, [test_id]);
    let count_check = resp.results[0].count;
    if (count_check == 0) {
      // first check whether more than 5 questions are answerred or not
      let makeAPICALL = answers.length;
      let finalResult = {};
      let prediction = [];
      let diagnosis = [];
      if (makeAPICALL <= 5) {
        finalResult.prediction = prediction;
        diagnosis.push(`You're probably not sick.`);
        diagnosis.push(`If your complaints persist, Kindly visit your family doctor or a general physician.`);
        finalResult.diagnose = diagnosis;
      } else {
        sql = `select test_type_id from dc.test_details where status = 'pending' and test_result_id = $1`;
        resp = await selectSql(sql, [test_id]);
        let test_type_id = resp.results[0].test_type_id;
        // console.log("testTYPEID --", test_type_id);
        if (test_type_id == 1) {
          const existingApiUrl = "http://3.89.196.64:8080/api/predict";
          const modifiedPayload = {};

          question.questions.forEach((q) => {
            const questionNoExists = answers.includes(q.question_no);
            // console.log(questionNoExists,q.question_no)
            modifiedPayload[`${q.question_english}`] = questionNoExists
              ? "PRESENT"
              : "ABSENT";
          });
          

          // now remove added extra questions for multiple choice
          delete modifiedPayload["Where do you have pain in your abdomen?"];
          delete modifiedPayload["What is the color of your vomit?"];

          //now add number
          const newObj = {};
          let count = 1;
          for (const key in modifiedPayload) {
            const newKey = count.toString().padStart(2, "0") + "_" + key;
            newObj[newKey] = modifiedPayload[key];
            count++;
          }
          const payload = JSON.stringify(newObj);
          // console.log(existingApiUrl);
          // console.log(payload);
          const response = await axios.post(existingApiUrl, payload);
          //console.log(response);
          externalAPI_response = response.data;
          let modifiedResponse = {
            ...response.data,
          };
          //console.log(modifiedResponse);
          // Calculate and round off the percentage values
          const result = {};
          let malignant_flag = false;
          let threshold_passed = false;
          let CAGB = false;
          let CBD = false;
          let GSD = false;
          let HPB = false;
          let PCA = false;
          Object.keys(modifiedResponse).forEach((key) => {
            const item = modifiedResponse[key];
            const classValues = item.class;
            const probabilities = item.probability.map((value) =>
              (value * 100).toFixed(2)
            );

            classValues.forEach((classValue, index) => {
              result[`${key}.${classValue}`] = probabilities[index];
              //console.log(`${key}.${classValue}`, probabilities[index]);
              if (`${key}.${classValue}` == "cagb.CAGB") {
                let percentage = probabilities[index];
                if (percentage >= 60) {
                  // prediction.push(
                  //   `Probability of ${classValue} is ${probabilities[index]}%`
                  // );
                  threshold_passed = true;
                  CAGB = true;
                }
              }
              if (`${key}.${classValue}` == "cbd.CBD") {
                let percentage = probabilities[index];
                if (percentage >= 50) {
                  // prediction.push(
                  //   `Probability of ${classValue} is ${probabilities[index]}%`
                  // );
                  threshold_passed = true;
                  CBD = true;
                }
              }
              if (`${key}.${classValue}` == "gsd.GSD") {
                let percentage = probabilities[index];
                if (percentage >= 50) {
                  // prediction.push(
                  //   `Probability of ${classValue} is ${probabilities[index]}%`
                  // );
                  threshold_passed = true;
                  GSD = true;
                }
              }
              if (`${key}.${classValue}` == "hpb.HPB") {
                let percentage = probabilities[index];
                if (percentage >= 70) {
                  // prediction.push(
                  //   `Probability of ${classValue} is ${probabilities[index]}%`
                  // );
                  threshold_passed = true;
                  HPB = true;
                }
              }
              if (`${key}.${classValue}` == "malignant.Malignant") {
                let percentage = probabilities[index];
                if (percentage >= 70) {
                  malignant_flag = true;
                }
              }
              if (`${key}.${classValue}` == "pca.PCA") {
                let percentage = probabilities[index];
                if (percentage >= 50) {
                  threshold_passed = true;
                  PCA = true;
                }
              }
            });
          });

          //console.log(prediction);
          // Print the result
// when threshold meets in any model
console.log("malignant-",malignant_flag,"threshold passed -",threshold_passed,"CAGB -",CAGB,"CBD-",CBD,"GSD -",GSD,"HPB -",HPB,"PCA -",PCA);
          if(threshold_passed == true){
            prediction.push(`You might be having Hepatopancreaticobiliary Disease`)
          }
// when threshold does not meets in any model
          else if(threshold_passed == false){
            diagnosis.push(`Your complaints are unlikely to be related to the diseases of  Liver Pancreas and Biliary system. However they need evaluation.`);
            diagnosis.push(`You must consider visiting a General physician / Family Doctor for a consultation.`)
          }

          finalResult.prediction = prediction;
          if (prediction.length > 0) {
            if (malignant_flag == true && HPB == true && (PCA == true || CAGB == true)) {
              diagnosis = [];
              diagnosis.push(
                `Based on your symptomatology index it may be a tumor. Kindly consult a surgical gastroenterologist at the earliest`
              );
              finalResult.diagnose = diagnosis;
            }
            if (malignant_flag == false && HPB == true) {
              diagnosis.push(
                `Based on your symptomatology index it might be a Benign Disease.`
              );
             if(GSD == true){
              diagnosis.push(
                `You may be having Gall Stone disease`
              );
             }
             if(CBD == true){
              diagnosis.push(
                `You may be having Common bile duct Stone`
              );
             }
              finalResult.diagnose = diagnosis;
            }
            diagnosis.push(
              `Kindly visit a Surgical/ Medical Gastroenterologist/Hepatologist at the earliest  convenient for further diagnosis and  management.`
            );
            finalResult.diagnose = diagnosis;
           
          } else {

          }
        } else if (test_type_id == 2) {
          const result = {};
          const existingApiUrl = "http://3.89.196.64:8080/api/predict/cld";
          const modifiedPayload = {};

          questionCLD.questions.forEach((q) => {
            const questionNoExists = answers.includes(q.question_no);
            modifiedPayload[`${q.question_english}`] = questionNoExists
              ? "PRESENT"
              : "ABSENT";
          });
          //now add number
          const newObj = {};
          let count = 1;
          for (const key in modifiedPayload) {
            const newKey = count.toString().padStart(2, "0") + "_" + key;
            newObj[newKey] = modifiedPayload[key];
            count++;
          }
          const payload = JSON.stringify(newObj);
          const response = await axios.post(existingApiUrl, payload);
          // console.log(response);
          externalAPI_response = response.data;
          let modifiedResponse = {
            ...response.data,
          };
          // console.log(modifiedResponse);
          // Extracting the probability values
          const cldProbability = modifiedResponse.probability[0][0];
          const normalProbability = modifiedResponse.probability[0][1];

          // Multiplying by 100 and rounding off to 2 decimal places
          const cldPercentage = (cldProbability * 100).toFixed(2);
          const normalPercentage = (normalProbability * 100).toFixed(2);

          if (cldPercentage >= 50) {
            prediction.push(`Your Liver is not Healthy!`);
          }
          finalResult.prediction = prediction;
          if (prediction.length > 0) {
            diagnosis.push(
              `You might be having Chronic Liver Disease`
            );
            diagnosis.push(
              `Kindly visit a Hepatologist/ Medical Gastroenterologist/ Surgical Gastroenterologist at the earliest convenient time for further evaluation and Management.`
            );
            finalResult.diagnose = diagnosis;
          } else {
            diagnosis.push(
              `You're probably not sick.`
            );
            diagnosis.push(
              `If your complaints persist, kindly visit your family doctor or a general physician.`
            );
            finalResult.diagnose = diagnosis;
          }
        }
      }
      //update database
      console.log(finalResult,test_id);
      sql = `update dc.test_details set assessment_answers = $1, assessment_result = $2, status = 'complete',api_response = $4 where test_result_id = $3 `;
      resp = updateSql(sql, [answers, finalResult, test_id,externalAPI_response]);
      res.status(200) .send({ status_code: "dc200", message: "success", results: finalResult}); }
     else {
      res.status(400) .send({
          status_code: "dc400",
          message: "Report already generated. Goto Report History Section",
          results: "Report already generated",
        });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get('/verifyTestStatus/:test_type_id', async(req,res)=>{
  const userID = req.headers.user_id;
  let test_type = req.params.test_type_id;

  let SuperUserAccount = await checkSuperUserAccount(userID);
  
    let sql = `select count(*) from dc.test_details where user_id = $1 and test_type_id = $2 and status = 'pending'`;
    let resp = await selectSql(sql,[userID,test_type]);
    let count = resp.results[0].count;
  
    console.log(count);
    if(count == 0 && SuperUserAccount == true){
     // INSERT INTO dc.test_details
     sql = `insert into dc.test_details (user_id,pg_id,status,test_type_id) values ($1,$2,$3,$4)`;
     resp = await selectSql(sql,[userID,-1,'pending',test_type]);
     
    }
    let result = {}
    if(count == 0 && SuperUserAccount == false){
        result.redirect_to = 'payment' 
    }
    else {
        sql = `select test_result_id from dc.test_details where user_id = $1 and test_type_id = $2 and status = 'pending'`;
        resp = await selectSql(sql,[userID,test_type]);
        let testID = resp.results[0].test_result_id;
        result.redirect_to = 'resume_test';
        result.testID =  testID;
    }
    res.status(200).send({ status_code: 'dc200', message: 'Success', results:result });

  

});

router.post('/updateFeedback', async(req,res)=>{
  const {test_id,feedback} = req.body;
  const userID = req.headers.user_id;

  let sql = `update dc.test_details set test_feedback = $1 where status ='complete' and test_result_id = $2`;
  let resp = await updateSql(sql,[feedback,test_id]);
  res.send(resp);

});

router.get("/generate_pdf/:report_id", async (req, res) => {
  let testID = req.params.report_id;
  const userID = req.headers.user_id;
//check userID
let sqlcheck = ` select ac_type_id from dc.users u where user_id = $1`;
let check_res = await selectSql(sqlcheck,[userID]);
let account_type = check_res.results[0].ac_type_id;

  let report_date = "";
  let name = "";
  let age = "";
  let mobile = "";
  let result_data;
  let sql = `select u.user_id,u.mobile,td.patient_name,td.patient_age,td.patient_gender,TO_CHAR(td.test_date, 'DD Month YYYY') AS test_date,TO_CHAR(td.test_date, 'HH:MI AM') AS test_time,
td.test_result_id,td.assessment_result as test_result,td.test_feedback  from dc.test_details td , dc.users u
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
});

router.post('/deleteAccount', async(req,res)=>{
  const userID = req.headers.user_id;
    let sql = `update dc.users set status = 'R' where user_id = $1`;
    let resp = await selectSql(sql,[userID]);
    res.send(resp);
});

//----------new endpoints -----------

router.get('/getUserSubscriptions', async(req,res)=>{
  const userID = req.headers.user_id;
  console.log(userID);
  let sql = `select count(*) from ai.user_subscription where status ='A' and user_id = $1`;
  let resp = await selectSql(sql,[userID]);
  let count = resp.results[0].count;
  sql = `SELECT COALESCE((upc.credit_balance), 0) as total_credit, sp.plan_name,sp.plan_id FROM ai.user_plan_credits upc,ai.subscription_plans sp 
  where upc.plan_id = sp.plan_id and upc.status = 'active' and upc.user_id = $1 order by upc.id desc limit 1`;
  resp = await selectSql(sql,[userID]);
  let credit = 0;let planName = ''; let planID = '';
  if(resp.results.length > 0){
    credit = resp.results[0].total_credit;
    planName = resp.results[0].plan_name;
    planID = resp.results[0].plan_id;
  }
  let data = {};
  if(count == 0 && credit == 0){
    data.result = "no";
  }
  else if(count == 0 && credit != 0){
    data.result = "credit";
    data.credit = credit;
    data.planName = planName;
    data.planID = planID;
  }
  else{
    data.result = "yes";
  }
  res.status(200).send({ status_code: 'ai200', message: 'Success', data:data });

})











 

export default router;

