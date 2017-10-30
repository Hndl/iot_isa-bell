"use strict";


const aws 		= require('aws-sdk');
const player		= require('play-sound')();
const util 		= require('util');
const readline		= require('readline');
const path		= require('path');
const fs 		= require('fs');
const exec		= require('child_process').exec;

const CMDLINE_AUTOPLAY		=	'defaults write com.apple.QuickTimePlayerX MGPlayMovieOnOpen 1';
const CMDLINE_AUTO 		=	'open -F ';
const LOG_TYPE			=	['[inf]','[err]','[war]'];
const LOG_INF			=	0;
const LOG_ERR			=	1;
const LOG_WAR			=	2;
const MEDIA_DIR			=	"media";
const CURR_DIR			=	".";
const CLICK 			= 	['single','double'];
const SINGLE 			=	0;
const DOUBLE 			=	1;

const EVT 			= ['SIGINT'];
const EVT_FS_SIGINT		= 0;
const SQS_OPTIONS		= 	{/* usr: iotButton */
				"accessKeyId"			: "", 
			 	"secretAccessKey"		: "", 
			 	"region"			: "eu-west-1"
					};

const SQS_RECEIVE_OPT	=	{
								"QueueUrl"				: "https://sqs.eu-west-1.amazonaws.com/?/?",
      							"MaxNumberOfMessages"	: 1
							};

const sqs 				=	new aws.SQS( SQS_OPTIONS );
const SQS_SLEEP			=	1000;

/**
 * func: deleteMessageSQSJSON
 * Desc: used as a simple way to construct JavaObjects that contain the relevant delete message instructions
 * params:
 *		msg JavaObject Of Type queued message
 *
 * returns: 
 *		JavaObject as Type Of Delete Instruction.
 */
function deleteMessageSQSJSON ( msg ){
	return (
			{
				QueueUrl: SQS_RECEIVE_OPT.QueueUrl,
      			ReceiptHandle: msg.ReceiptHandle
			}
		);
}

function report_error( func, subject, message ){
	util.log (`${LOG_TYPE[LOG_ERR]}-[${func}]-[${subject}]::${message}`);
}

function report_info( func, subject, message ){
	util.log (`${LOG_TYPE[LOG_INF]}[${func}]-[${subject}]::${message}`);
}


function hasMessages ( data ){
	const func = "hasMessages";
	var bHasMessages = false
	try{
		bHasMessages = data.Messages.length >= 0;
	}catch(err){
		util.log (`[inf][${func}]-[No_Messages]::${JSON.stringify(data)}`);
	}
	return ( bHasMessages)
}

function cmdline ( cmd ){

	exec(cmd, function ( err, stdout ){
		const func = "exec";
		if(err){
			report_error(func, 'onErr',err);
		} else {
			report_info(func, 'OnEyes','Now showing');
		}
	});//end exec
}

// NOTE: open %s works on osx and windows. Not sure about lynx[%variant]
// TODO: enable auto play only works on osx

function playTune () {
	const func = "playTune";
	try{
		
		cmdline (CMDLINE_AUTO + path.join(CURR_DIR,MEDIA_DIR,'isabell.mp4'));
		player.play(path.join(CURR_DIR,MEDIA_DIR	,'single.mpeg'), function(err){
			const func = "play";
			if(err){
				report_error(func, 'onErr',err);
			} else {
				report_info(func, 'OnEars','can you hear me now? can you hear me now?');
			}
		});//end func:play
	} catch ( err ){
		report_error(func, 'onErr','aint nothing going-on');
	}
}

function isSingleClick ( messageBody ) {
	return ( whichClick(messageBody) == CLICK[SINGLE]) ;
}

function isDoubleClick ( messageBody ) {
	return ( whichClick(messageBody) == CLICK[DOUBLE]) ;
}

function whichClick ( messageBody ) {
	return ( (messageBody.clickType).trim().toLowerCase() );
}

/**
 *
 *
 *
 */
function receiveMessage() {
	const func = "receiveMessage";
  	report_info(func,'query_sqs',SQS_RECEIVE_OPT.QueueUrl);
	
	/*
	 * Invoke receiveMessage to check for new messages on our queue.
	 *
	 */
	sqs.receiveMessage(SQS_RECEIVE_OPT, function(err, data) {
  		const func = "sqs.receiveMessage";
		if (err){
    		report_error(func,'receiveMessage',err);
    	} else {
    		try{
    			if ( hasMessages(data) ){
	    			data.Messages.forEach(function(message) {
	    				// used this to look at the message structure
						//report_info(func,'Payload:Received',`Msg[${JSON.stringify(message.Body)}]`);
	    				report_info(func,'Payload:Received',`Msg[${message.MessageId}]`);
	    				
	    				var body = JSON.parse(message.Body);
						report_info(func,'Payload:Message.Body',`[0]-${body.serialNumber},Battery:${body.batteryVoltage},Click:${body.clickType}..Single[${isSingleClick(body)}] Double[${isDoubleClick(body)}]`);
	    				
	    				report_info(func,'Payload:Prepare to Delete',`Msg[${message.MessageId}]`);
	    				
	    				/*
	    				 * Invoke the delete Message API
	    				 *	 - construct delete message JavaObject using deleteMessageSQSJSON
	    				 */
	    				sqs.deleteMessage(deleteMessageSQSJSON(message), function(err, data) {
	    					const func = "sqs.deleteMessage";
	    					if (err){
	    						report_error(func,'On::Delete::!',err);
	    					} else {
	    						report_info(func,'On::Delete::Done',JSON.stringify(data));
	    						playTune();
	    					}
	    				});//end func: sqs.deleteMessage
		    		});//end forEach
	    		}//endif: hasMessages
	    	}catch ( err ){
	    		report_error(func,'data.Messages[!]',err);
	    	}	
    	}//endif:err
  });//end sqs.receiveMessage
}//end func: receiveMessages


cmdline (CMDLINE_AUTOPLAY);

var button_click = setInterval (receiveMessage,SQS_SLEEP);

// Hook into the control-c... allows us to do some clean up...
var rl  = readline.createInterface( process.stdin, process.stdout);

 rl.on( EVT[EVT_FS_SIGINT], function ( stdin ){
	util.log(`control-c.... app stopping`);
	process.exit(0);
});

