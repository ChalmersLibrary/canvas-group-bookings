'use strict';

require('dotenv').config();

// Default is to send unsent confirmation mails to user and group users, every 1 minute
const MAIL_TO_USER_INTERVAL = process.env.MAIL_TO_USER_INTERVAL ? process.env.MAIL_TO_USER_INTERVAL : 60000;

// Default is to send unsent mail to all groups in a fully booked slot, every 30 minutes
const MAIL_TO_FULL_GROUP_INTERVAL = process.env.MAIL_TO_FULL_GROUP_INTERVAL ? process.env.MAIL_TO_FULL_GROUP_INTERVAL : 1800000;

// In development, force all mail to a development address regardless of recipients
if (process.env.NODE_ENV == "development") {
    const MAIL_FORCE_TO = process.env.MAIL_FORCE_TO ? process.env.MAIL_FORCE_TO : "undeliverable@not-a-valid-domain";
}

async function sendConfirmationMailToUser(name, email, cc_instructor_email, cc_instructor_name, subject, body) {
    if (process.env.MAIL_ONLY_LOG) {
        console.log("Debug mode, only logging mails.");

        if (process.env.NODE_ENV == "development") {
            email = process.env.MAIL_FORCE_TO ? process.env.MAIL_FORCE_TO : email;
    
            if (cc_instructor_email) {
                cc_instructor_email = process.env.MAIL_FORCE_TO ? process.env.MAIL_FORCE_TO : "";
            }
        }
        if (email !== "") {
            console.log("To: " + email + " (" + name + ")");
            if (cc_instructor_email) {
                console.log("Cc: " + cc_instructor_email + " (" + cc_instructor_name + ")");
            }
            console.log("Subject: " + subject + "\n");
            console.log(body);
        }
        else {
            throw new Error("E-postadress för mottagare saknas.");
        }
    }
    else {
        console.log("No debug here, sending real emails to real people!");
    }
}

module.exports = {
    sendConfirmationMailToUser
}
