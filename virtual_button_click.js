"use strict";


const aws 		= require('aws-sdk');
const path      = require('path');

const util 		= require('util');

const LOG_TYPE			=	['[inf]','[err]','[war]'];
const LOG_INF			=	0;
const LOG_ERR			=	1;
const LOG_WAR			=	2;


const AWS_CRED_FILE		= 'aws.cred.json';
const SQS_OPTIONS		= aws.config.loadFromPath ( path.join('.',AWS_CRED_FILE));

const SQS_RECEIVE_OPT	=	{
								"QueueUrl"				: "https://sqs.eu-west-1.amazonaws.com/381605567957/irl-iot-button-click",
      							"MaxNumberOfMessages"	: 1
							};

const sqs 				=	new aws.SQS( SQS_OPTIONS );
const SQS_SLEEP			=	1000;


function buttonClickMessageSQSJSON (  ){
	return (
			{
				DelaySeconds: 10,
				MessageAttributes: 
					{
					  "Title": {
					    DataType: "String",
					    StringValue: "VirtualButtonClick"
					   },
					  "Author": {
					    DataType: "String",
					    StringValue: "cgb"
					   },
					  "WeeksOn": {
					    DataType: "Number",
					    StringValue: "6"
					   }
 					},
 					MessageBody: "virtual_button_click.",
 					QueueUrl: SQS_RECEIVE_OPT.QueueUrl
			}
		);
}

function report_error( func, subject, message ){
	util.log (`${LOG_TYPE[LOG_ERR]}-[${func}]-[${subject}]::${message}`);
}

function report_info( func, subject, message ){
	util.log (`${LOG_TYPE[LOG_INF]}[${func}]-[${subject}]::${message}`);
}

sqs.sendMessage(buttonClickMessageSQSJSON(), function(err, data) {
  if (err) {
    console.log("Error", err);
  } else {
    console.log("Success", data.MessageId);
  }
});

