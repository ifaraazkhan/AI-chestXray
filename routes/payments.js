import express from 'express';
import { createAuthToken,verifyRazorpayPayment,sha256Hash,getMobileNumber,allotPlanCredits } from '../utils/helper.js';
import { insertSql, selectSql, updateSql } from '../utils/pg_helper.js';
import error_resp from '../constants/errors.js'
import EmailServices from '../utils/email_service.js';
import { validateToken } from '../utils/middlewares.js';
import md5 from 'md5';
import axios from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';


const router = express.Router();

const saltKey = process.env.PHONEPE_SALTKEY;
const saltIndex = process.env.PHONEPE_SALTINDEX;
const phonepe_api_url = process.env.PHONEPE_API;
const phonepe_MERCHANTID = process.env.PHONEPE_MERCHANTID;


function generateXHeader(data) {
  const encode = Buffer.from(JSON.stringify(data)).toString('base64');
  const string = `${encode}/pg/v1/pay${saltKey}`;
  const sha256 = crypto.createHash('sha256').update(string).digest('hex');
  return `${sha256}###${saltIndex}`;
}

router.post('/generatePaymentLink',async (req, res) => {
    const {plan_id} = req.body;
    const userID = req.headers.user_id;

    let sql =`select plan_cost from ai.subscription_plans where plan_id = $1`;
    let resp = await selectSql(sql,[plan_id]);
    if(resp.results.length>0){
    let test_amount = resp.results[0].plan_cost;
    let finalAmount = test_amount * 100;
     
    let Usermobile = await getMobileNumber(userID);

    let transactionId = uuidv4();
    transactionId = transactionId.replace(/-/g, '');
   
    const data = {
      merchantId: phonepe_MERCHANTID,
      merchantTransactionId: transactionId,
      merchantUserId: `UID_${userID}`,
      amount: finalAmount,
      redirectUrl: 'https://localhost:3000/dashboard',
      redirectMode: 'POST',
      callbackUrl: 'http://localhost:8000/auth/callback',
      mobileNumber: Usermobile,
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    };
  
    const finalXHeader = generateXHeader(data);
  
    const requestPayload = {
      request: Buffer.from(JSON.stringify(data)).toString('base64'),
    };
    
    console.log("payload ---> ",requestPayload);
    console.log("X-verify ----> ",finalXHeader);

    try {
      const response = await axios.post(`${phonepe_api_url}/pg/v1/pay`, requestPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': finalXHeader,
        },
      });
     // console.log(response);
      console.log(response.data);
      const redirectUrl = response.data.data.instrumentResponse.redirectInfo.url;
      console.log('Redirect URL:', redirectUrl);
      // Redirect the user to the 'redirectUrl'
//insert into DB
let sql_insert = `INSERT INTO ai.pg_payment (user_id, plan_id, pg_transaction_id, pg_amount, pg_payment_link, created_at,created_by)
VALUES ($1,$2,$3,$4,$5,now(),$6);`
let resp_ = await insertSql(sql_insert,[userID,plan_id,transactionId,finalAmount,redirectUrl,userID])
let result = {};
result.redirectUrl = redirectUrl;
result.transactionId = transactionId;
console.log(result);
      res.status(200).send({ status_code: 'dc200', message: 'Success', results:result });
    } catch (error) {
      console.error('Payment link Error:', error);
      res.status(500).send({ status_code: 'dc200', message: 'Error occured' });
    }
  }else{
    res.status(401).send({ status_code: 'dc200', message: 'Wrong Test Type' });
  }
    
});

router.post('/generateTestPaymentLink',async (req, res) => {
  const {plan_id} = req.body;
  const userID = req.headers.user_id;

  let sql =`select plan_cost from ai.subscription_plans where plan_id = $1`;
  let resp = await selectSql(sql,[plan_id]);
  if(resp.results.length>0){
  let test_amount = resp.results[0].plan_cost;
  let finalAmount = test_amount*100;
   
  let Usermobile = await getMobileNumber(userID);

  let transactionId = uuidv4();
  transactionId = transactionId.replace(/-/g, '');
 
  const data = {
    merchantId: "PGTESTPAYUAT",
    merchantTransactionId: "MT7850590068188104",
    merchantUserId: "MUID123",
    amount: finalAmount,
    redirectUrl: 'https://localhost:3000/dashboard',
    redirectMode: "REDIRECT",
    callbackUrl: 'http://localhost:8000/auth/callback',
    mobileNumber:"9999999999",
    paymentInstrument: {
      type: 'PAY_PAGE',
    },
  };

  const finalXHeader = generateXHeader(data);

  const requestPayload = {
    request: Buffer.from(JSON.stringify(data)).toString('base64'),
  };

  try {
    const response = await axios.post(`${phonepe_api_url}/pg/v1/pay`, requestPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': finalXHeader,
      },
    });
    const redirectUrl = response.data.data.instrumentResponse.redirectInfo.url;
//insert into DB
let sql_insert = `INSERT INTO ai.pg_payment (user_id, plan_id, pg_transaction_id, pg_amount, pg_payment_link, created_at,created_by)
VALUES ($1,$2,$3,$4,$5,now(),$6);`
let resp_ = await insertSql(sql_insert,[userID,plan_id,transactionId,test_amount,redirectUrl,userID])
//make credit avaiblable for user based on the payment and plan 
let allotCredits = allotPlanCredits(plan_id,finalAmount,userID,"1234");
let result = {};
result.redirectUrl = redirectUrl;
result.transactionId = transactionId;
    res.status(200).send({ status_code: 'dc200', message: 'Success', results:result });
  } catch (error) {
    console.error('Payment link Error:', error);
    res.status(500).send({ status_code: 'dc200', message: 'Error occured' });
  }
}else{
  res.status(401).send({ status_code: 'dc200', message: 'Wrong Test Type' });
}
  
});


router.get('/checkPaymentStatus/:transactionID',async (req, res) => {
  let transactionID = req.params.transactionID;
  const userID = req.headers.user_id;

  let sql = `select pg_status,test_type_id from dc.pg_payment where user_id = $1 and pg_transaction_id =$2`;
  let resp = await selectSql(sql,[userID,transactionID]);
  if(resp.results.length>0){
    let status = resp.results[0].pg_status;
    let testTypeID = resp.results[0].test_type_id

    if (status == 'PAYMENT_SUCCESS'){

      let sql = `select test_result_id from dc.test_details where user_id = $1 and test_type_id = $2 and status = 'pending'`;
      let resp = await selectSql(sql,[userID,testTypeID]);
      let testID = resp.results[0].test_result_id;
      let result = {};
      result.testID =  testID;
      res.status(200).send({ status_code: 'dc200', message: 'PAYMENT_SUCCESS',results:result });
    }
    else if (status == 'PAYMENT_ERROR'){
      res.status(401).send({ status_code: 'dc401', message: 'PAYMENT_ERROR' });
    }
    else if (status == 'PAYMENT_PENDING'){
      scheduleStatusChecks(transactionID)
      res.status(200).send({ status_code: 'dc200', message: 'PAYMENT_PENDING' });
    }
    else if (status == 'innitiated'){
      res.status(401).send({ status_code: 'dc401', message: 'Incomplete' });
    }
  }
  else{
    res.status(401).send({ status_code: 'dc401', message: 'Payment ID not found' });
  }


});

let intervalId; // Store the interval ID to clear it when needed

function scheduleStatusChecks(transactionId) {
  let elapsedSeconds = 0;

  intervalId = setInterval(async () => {
    elapsedSeconds += 3;

    // Check the elapsed time and update the status accordingly
    if (elapsedSeconds <= 30) {
      await checkPaymentStatus(transactionId);
    } else if (elapsedSeconds <= 90) {
      await checkPaymentStatus(transactionId);
      clearInterval(intervalId);
      intervalId = setInterval(() => checkPaymentStatus(transactionId), 6000);
    } else if (elapsedSeconds <= 150) {
      await checkPaymentStatus(transactionId);
      clearInterval(intervalId);
      intervalId = setInterval(() => checkPaymentStatus(transactionId), 10000);
    } else if (elapsedSeconds <= 270) {
      await checkPaymentStatus(transactionId);
      clearInterval(intervalId);
      intervalId = setInterval(() => checkPaymentStatus(transactionId), 30000);
    } else if (elapsedSeconds <= 900) {
      await checkPaymentStatus(transactionId);
      clearInterval(intervalId);
      intervalId = setInterval(() => checkPaymentStatus(transactionId), 60000);
    } else {
      // Timeout reached, handle accordingly (e.g., mark as expired)
      clearInterval(intervalId);
      handleTimeout(transactionId);
    }
  }, 3000);
}


async function checkPaymentStatus(transactionId) {

  let merchantId = phonepe_MERCHANTID;

  const finalXHeader = crypto.createHash('sha256')
  .update(`/pg/v1/status/${merchantId}/${transactionId}${saltKey}`)
  .digest('hex') + '###' + saltIndex;

try {
  const response = await axios.get(`${phonepe_api_url}/pg/v1/status/${merchantId}/${transactionId}`, {
    headers: {
      'Content-Type': 'application/json',
      'accept': 'application/json',
      'X-VERIFY': finalXHeader,
      'X-MERCHANT-ID': transactionId,
    },
  });

 // console.log('Response:', response);
  let ResData = response.data;
  let ResData2 = response.data.data;
    // Handle the payment status (e.g., update in database, notify user, etc.)
    if (ResData.success == true && ResData.code == "PAYMENT_SUCCESS") {
      // Handle the response
      let sql;
      let resp;
        //update dc.pg_payment
        sql = `update dc.pg_payment set pg_status = 'PAYMENT_SUCCESS', status = 'success' where pg_transaction_id = $1 RETURNING user_id,test_type_id;`;
        resp = await selectSql(sql,[transactionId]);
        // console.log(resp);
        let userID = resp.results[0].user_id;
        let test_type_id = resp.results[0].test_type_id;
        
        //insert into pgdeatils
        sql = `INSERT INTO dc.payment_details (pg_transaction_id, user_id, p_state, p_transactionId, p_amount, p_type, p_created_at)
        VALUES ($1, $2, $3, $4, $5, $6, now())`
        resp = await insertSql(sql,[transactionId,userID,ResData2.state,ResData2.transactionId,ResData2.amount,ResData2.paymentInstrument.type])

        // insert into  dc.test_details
        sql = `insert into dc.test_details (user_id,pg_id,status,test_type_id) values ($1,$2,$3,$4)`;
        resp = await selectSql(sql,[userID,transactionId,'pending',test_type_id]);

      // Stop the timer as the payment status is now "SUCCESS"
      clearInterval(intervalId);

    } else if (ResData.code === 'PAYMENT_PENDING') {
      // Continue waiting
      // Code block intentionally left empty
    } else {
      // Handle other status (e.g., failure)
      sql = `update dc.pg_payment set pg_status = 'PAYMENT_ERROR', status = 'failed' where pg_transaction_id = $1;`;
            resp = await updateSql(sql,[transactionId]);
      clearInterval(intervalId);
    }
  } catch (error) {
    // Handle API request error
    console.error('Error checking payment status:', error);
  }
}


export default router;