const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const request = require('superagent');

const DRIFT_TOKEN = process.env.BOT_API_TOKEN

const CONVERSATION_API_BASE = 'https://driftapi.com/conversations'
const CONTACT_API_BASE = 'https://driftapi.com/contacts'

function handleMessage(orgId, data) {
	
// Only look for Drift Private Notes. See https://devdocs.drift.com/docs/message-model for a list of all of the possible message types.
  if (data.type === 'private_note') {
    const messageBody = data.body
    const conversationId = data.conversationId
    
    
// This is the slash command your app will use.
    if (messageBody.startsWith('/weather')) {
      console.log("Found a Drift slash command")
      return getContactId(messageBody, conversationId, orgId, GetContactId)
    }
  }
}


// Get a contact ID from Drift. See https://devdocs.drift.com/docs/contact-model for the complete Contact Model
function getContactId(messageBody, conversationId, orgId, callbackFn) {
  request
   .get(CONVERSATION_API_BASE + `${conversationId}`)
    .set('Content-Type', 'application/json')
    .set(`Authorization`, `bearer ${DRIFT_TOKEN}`)
   .end(function(err, res){
       callbackFn(messageBody, res.body.data.contactId, conversationId, orgId)
     });
}


function GetContactId(messageBody, contactId, conversationId, orgId) { 
    return getContactEmail(messageBody, contactId, conversationId, orgId, GetContactEmail);
}

// Get the email address from Drift
function getContactEmail (messageBody, contactId, conversationId, orgId, callbackFn) {

	request
	  .get(CONTACT_API_BASE + `${contactId}`)
	  .set(`Authorization`, `bearer ${DRIFT_TOKEN}`)
	  .set('Content-Type', 'application/json')
	  .end(function (err, res) {
	  	  
	  if (typeof res.body.data.attributes.email != 'undefined') {
	  	emailAddress = res.body.data.attributes.email
	  	}	  	
		callbackFn(messageBody, emailAddress, conversationId, orgId)
		 });
}

function GetContactEmail(messageBody, emailAddress, conversationId, orgId) { 
    return doSomething(messageBody, emailAddress, conversationId, orgId, DoSomething)
}


// This is where your app will do something.
function doSomething(messageBody, emailAddress, conversationId, orgId, callbackFn) {

    var driftMessage = "Testing 1-2-3"	
    callbackFn(driftMessage, conversationId, orgId)
	
}

function DoSomething(driftMessage, conversationId, orgId) {
    return postMessage(driftMessage, conversationId, orgId)
}

function postMessage(driftMessage, conversationId, orgId) { 

    // Here's a standard Private Note message format
    const message = {
    'orgId': orgId,
    'body': driftMessage,
    'type': 'private_prompt',
    }
  
    
    // Send the message to Drift. See https://devdocs.drift.com/docs/creating-a-message for complete documentation 
    request
    .post(CONVERSATION_API_BASE + `/${conversationId}/messages`)
    .set('Content-Type', 'application/json')
    .set(`Authorization`, `bearer ${DRIFT_TOKEN}`)
    .send(message)
    .catch(err => console.log(err))
       
}

app.use(bodyParser.json())
app.listen(process.env.PORT || 3000, () => console.log('drift-app-template listening on port 3000!'))
app.post('/api', (req, res) => {
  
  if (req.body.type === 'new_message') {
    handleMessage(req.body.orgId, req.body.data);  
  }
  
  return res.send('ok')
})
