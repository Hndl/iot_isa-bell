"use strict";


const aws 		= require('aws-sdk');
const player	= require('play-sound')();
const util 		= require('util');
const readline	= require('readline');
const path		= require('path');
const fs 		= require('fs');
const exec		= require('child_process').exec;


const DOTW				=	['sun','mon','tue','wed','thur','fri','sat'];
const CMDLINE_AUTOPLAY	=	'defaults write com.apple.QuickTimePlayerX MGPlayMovieOnOpen 1';
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
const COMMA_DELIM		=	',';
const HYPHEN_DELIM		=	'-';
const EVT 				= ['SIGINT'];
const EVT_FS_SIGINT		= 0;
const WORKDAY_TRUE		= 99;

// IMP:[001] removed the security options and placed them in a json file.  Same format. Read in using aws.config.loadFromPath
//const SQS_OPTIONS		= 	
//
const AWS_CRED_FILE		= 'aws.cred.json';
const SQS_OPTIONS		= aws.config.loadFromPath ( path.join('.',AWS_CRED_FILE));

const SQS_RECEIVE_OPT	=	{
								"QueueUrl"				: "https://sqs.eu-west-1.amazonaws.com/381605567957/irl-iot-button-click",
      							"MaxNumberOfMessages"	: 1
							};

const sqs 				=	new aws.SQS( SQS_OPTIONS );
const SQS_SLEEP			=	1000;

var WorkingDayShedule	= {};
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

//IMP[002] due to the costs involved, we only want the app to work on days we are going to be in the office.
function isTimeToWork ( startTime, endTime){
	const HH=0;
	const MM=1;
	const currentHH = parseInt(((new Date()).getHours()));
	//const currentMM = parseInt(((new Date()).getMinutes()));
	
	var start_time = startTime.split(':');
	var end_time   = endTime.split(':');

	return ( (currentHH >= parseInt(start_time[HH]) ) && (currentHH <= parseInt(end_time[HH]) ) );
}

function isTodayAWorkingDay( listOfWorkingDays ){
	var i = 0;
	for ( i =0 ; i<listOfWorkingDays.length ; i++){

		
		if (workingToday ( listOfWorkingDays[i].trim().toLowerCase() )) {
			//console.log(`checked : ${listOfWorkingDays[i].trim().toLowerCase()} - today is a working day!`);
			i=(WORKDAY_TRUE-1);//subtract 1, as the i++ in the loop will increment.
		}
		
	}
	//console.log(`value of i=${i} workingday:${i===99}`);
	return ( i===WORKDAY_TRUE);
}
function workingToday(  dayOfTheWeek ) {
	return ( dayOfTheWeek.trim().toLowerCase() === (nameOfToday()).trim().toLowerCase() ) ;
}
function nameOfToday (){
	return (DOTW[(new Date()).getDay()]);
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
  	

  	/*
  	 * should I be working? 
  	 * // Hacking!  just check and terminate if it's not a working day!
  	 */
  	 if ( ( (isTodayAWorkingDay(WorkingDayShedule))===false) ){
  	 	util.log(`No work on ${nameOfToday()}. The working shedule is:${WorkingDayShedule}`);
  	 	return; // go back to sleep
  	 } 
  	 if ((isTimeToWork(WorkingHours[0],WorkingHours[1]) === false)){
  	 	util.log(`Not time to work yet ${nameOfToday()} @${WorkingHours[0]}-${WorkingHours[0]}`);
  	 	return; // go back to sleep
  	 }
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

var WorkingDayShedule = process.argv[2].split(COMMA_DELIM);
var WorkingHours = process.argv[3].split(HYPHEN_DELIM);
//console.log(`${WorkingHours} - ${WorkingHours[0]} - ${WorkingHours[1]}`);



var button_click = setInterval (receiveMessage,SQS_SLEEP);

// Hook into the control-c... allows us to do some clean up...
var rl  = readline.createInterface( process.stdin, process.stdout);

 rl.on( EVT[EVT_FS_SIGINT], function ( stdin ){
	util.log(`control-c.... app stopping`);
	process.exit(0);
});

