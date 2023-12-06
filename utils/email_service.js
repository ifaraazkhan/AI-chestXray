import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const Send = (emailArgs) => {
    const smtpEndpoint = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const smtpUsername = process.env.AWS_ACCESS_KEY_ID;
    const smtpPassword = process.env.AWS_SECRET_ACCESS_KEY;

    let transporter = nodemailer.createTransport({
        host: smtpEndpoint,
        port: port,
        secure: true, // true for 465, false for other ports
        auth: {
            user: smtpUsername,
            pass: smtpPassword
        }
    });
    // let info = await transporter.sendMail(emailArgs);
    return new Promise((resolve, reject) => {
        transporter.sendMail(emailArgs, (err, info) => {
          if (err) {
            console.log('error sending email', {err, info});
            reject({ status_code: 'tv404', message: err});
          }
          else {
            resolve({ status_code: 'tv200', message: 'Email sent succesfully'});
          }
        });
      });
    // console.log("Message sent! Message ID: ", info.messageId);
};

export default {
    Send
};