const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const request = require('superagent');

const DRIFT_TOKEN = process.env.BOT_API_TOKEN

const SF_USER = process.env.SF_USER
const SF_PASS = process.env.SF_PASS

const CONVERSATION_API_BASE = 'https://driftapi.com/conversations'
const CONTACT_API_BASE = 'https://driftapi.com/contacts'

// Set this to true if you want to automatically lookup users for new conversations where we have an email address
const AUTO_LOOKUP = true;


function handleMessage(orgId, data) {
  if (data.type === 'private_note') {
    const messageBody = data.body
    const conversationId = data.conversationId

    if (messageBody.startsWith('/lookup')) {
      console.log("Yeah! We found a /lookup message!")
      return getContactId(conversationId, GetContactId, orgId)
    }
  }
}

function handleConversation(orgId, data) {

    const messageBody = data.body
    const conversationId = data.id
    console.log("Yeah! We found a new conversation!")
      return getContactId(conversationId, GetContactId, orgId)
}


// request function
function getContactId(conversationId, callbackFn, orgId) {

// Get the contact from Drift
  request
   .get(CONVERSATION_API_BASE + `${conversationId}`)
    .set('Content-Type', 'application/json')
    .set(`Authorization`, `bearer ${DRIFT_TOKEN}`)
   .end(function(err, res){
       callbackFn(res.body.data.contactId, conversationId, orgId)
     });
}

// call back function
function GetContactId(contactId, conversationId, orgId) { 
    return getContactEmail(contactId, GetContactEmail, conversationId, orgId);
}

function getContactEmail (contactId, callbackFn, conversationId, orgId) {

// Get the email address from Drift
request
  .get(CONTACT_API_BASE + `${contactId}`)
  .set(`Authorization`, `bearer ${DRIFT_TOKEN}`)
  .set('Content-Type', 'application/json')
  .end(function (err, res) {
        callbackFn(res.body.data.attributes.email, conversationId, orgId)
     });
}

// call back function
function GetContactEmail(emailAddress, conversationId, orgId) { 
    return returnSFAccessToken(emailAddress, ReturnSFAccessToken, conversationId, orgId)
}

function returnSFAccessToken(emailAddress, callbackFn, conversationId, orgId) {

var jsforce = require('jsforce');
var conn = new jsforce.Connection({
  // you can change loginUrl to connect to sandbox or prerelease env.
  // loginUrl : 'https://test.salesforce.com'
});

conn.login(SF_USER, SF_PASS, function(err, userInfo) {
  if (err) { return console.error(err); }
  callbackFn(emailAddress, conn.accessToken, conversationId, orgId)
  
});
}

function ReturnSFAccessToken(emailAddress, accessToken, conversationId, orgId) {
    return querySalesforce(emailAddress, accessToken, postMessage, conversationId, orgId)
}


function querySalesforce(emailAddress, accessToken, callbackFn, conversationId, orgId) {


 if (typeof emailAddress != 'undefined') {

		var jsforce = require('jsforce');
		var conn = new jsforce.Connection({
		  instanceUrl : 'https://na52.salesforce.com',
		  accessToken : accessToken
		});

		
	    var records = [];
	

		// Customize this to change the fields you return from the Lead object
		conn.query("SELECT Id, Email, FirstName, LastName, Company, Country, Academics__c, Total_RM_Studio_starts__c, Last_RM_Studio_usage__c FROM Lead where Email = '" + emailAddress + "'", function(err, result) {
		  
		  if (err) { 
		  	  console.log ("salesforce query error")
			  body = "Oops, we don't have an email address or the user isn't in Salesforce yet"
			  callbackFn(body, conversationId, orgId)	
		      return console.error(err);     
		  }

		  var firstName = result.records[0].FirstName;
		  var lastName = result.records[0].LastName;
		  var Id = result.records[0].Id;
		  var Company = result.records[0].Company;
		  var Country = result.records[0].Country;
  
  console.log ("debug 1")
  
		  if (result.records[0].Last_RM_Studio_usage__c != null) {
			var lastStudioUsage = result.records[0].Last_RM_Studio_usage__c
			lastStudioUsage = str.slice(0,9)
			
		  } else {
			lastStudioUsage = "None"
		  }
  
		  if (result.records[0].Total_RM_Studio_starts__c != null) {
			var totalStudioStarts = result.records[0].Total_RM_Studio_starts__c
		  } else {
			totalStudioStarts = "None"
		  }	  
  
		  if (result.records[0].Academics__c != "") {
			Academic = "Yeah"
		  } else {
			Academic = "Nope"
		  }
  	  
    console.log ("debug 2")	  
  
		  // Built the Drift reply body
		  body = "<a target='_blank' href=https://na52.salesforce.com/" + Id + ">" + firstName + " " + lastName + "</a> | " + Company + " | " + Country + "<br/>Total RM Studio Starts: " + totalStudioStarts + " | Last RM Studio Usage: " + lastStudioUsage + "<br/>Academic: " + Academic
		  callbackFn(body, conversationId, orgId)
		     }); 


	} else {
		// No email address was found
		console.log ("email is undefined" + emailAddress)
		body = "Oops, we don't have an email address or the user isn't in Salesforce yet"
		callbackFn(body, conversationId, orgId)
		}
		
  console.log ("debug 3")		
	
}

function postMessage(body, conversationId, orgId) { 
    const message = {
    'orgId': orgId,
    'body': body,
    'type': false ? 'edit' : 'private_prompt',
  }
  
  	// Send the message
    return request.post(CONVERSATION_API_BASE + `/${conversationId}/messages`)
    .set('Content-Type', 'application/json')
    .set(`Authorization`, `bearer ${DRIFT_TOKEN}`)
    .send(message)
    .catch(err => console.log(err))
    
}


app.use(bodyParser.json())
app.listen(process.env.PORT || 3000, () => console.log('Example app listening on port 3000!'))
app.post('/api', (req, res) => {
  
  if (req.body.type === 'new_message') {
    handleMessage(req.body.orgId, req.body.data);  
  }
  if ((req.body.type === 'new_conversation') && AUTO_LOOKUP ) {
      handleConversation(req.body.orgId, req.body.data);  
  }
  
  return res.send('ok')
})
