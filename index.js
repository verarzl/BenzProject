const Alexa = require('ask-sdk');
const fetch = require('node-fetch'); 
const async = require('async');

const LockCarHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'LaunchRequest'
      || (request.type === 'IntentRequest'
        && request.intent.name === 'LockMBenz');
  },

  async handle(handlerInput) {
    const client_id = "49f2732b-2951-48f2-8a24-78afa4e619d2";
    const client_secret = "e94b45d0-03f5-4a41-8606-852f82db8f2c";
    const credential = Buffer.from(client_id + ':' + client_secret).toString('base64');

    // this authorization_code has to be changed every time
    var authorization_code = 'b2837d38-5614-4bde-8fc7-1bd4214f195d';
    var access_token;
    var vehicle_id;
    var status = false;

    async function getAuthToken() {
      var res = await fetch('https://api.secure.mercedes-benz.com/oidc10/auth/oauth/v2/token', {
        method: 'post',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + credential
        },
        body: 'grant_type=authorization_code&code=' + authorization_code + '&redirect_uri=http://localhost:3000/'
      }
      )
      var result = await res.json();
      console.log(result);
      if (result.error == 'invalid_grant') {
          console.log(result.error_description);
          return 'Sorry we couldnt connect to your car. Please lock your car by yourself'
        } else {
          access_token = result.access_token;
          vehicle_id = await getVehicleID();
          var status = await getDoorInfo();
          if(status == true){
            return 'Your car is locked.';
          }else {
            return 'Please close all doors first';
          }
        }
    }
    
    async function getVehicleID() {
      var res = await fetch('https://api.mercedes-benz.com/experimental/connectedvehicle/v1/vehicles', {
        method: 'get',
        headers: {
          'accept': 'application/json',
          'Authorization': 'Bearer ' + access_token
        }
      })
      var result = await res.json();
      console.log(result);
      return result[0]['id'];
    }

    async function getDoorInfo() {
      var res = await fetch('https://api.mercedes-benz.com/experimental/connectedvehicle/v1/vehicles/' + vehicle_id + '/doors', {
        method: 'get',
        headers: {
          'accept': 'application/json',
          'Authorization': 'Bearer ' + access_token
        }
      })
        var result = await res.json();
        console.log(result);
        if (result.doorlockstatusvehicle.value == 'LOCKED') {
          status = true;
          return true;
        } 
        else {
          if (result.doorstatusfrontleft.value == 'OPEN' || result.doorstatusfrontright.value == 'OPEN' || result.doorstatusrearright.value == 'OPEN' || result.doorstatusrearleft.value == 'OPEN') {
            return false;
          } 
          else{
            return await lockDoor();
          } 
        }
      }
    
    async function lockDoor() {
      var res = await fetch('https://api.mercedes-benz.com/experimental/connectedvehicle/v1/vehicles/' + vehicle_id + '/doors', {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + access_token
        },
        body: '{ \"command\": \"LOCK\"}'
      })
        var result = await res.json();
        console.log(result);
        if (result.status == 'INITIATED'){
          return await getDoorInfo();
        }else{
          return false;
        }
      }

    const speechOutput = await getAuthToken();
    return handlerInput.responseBuilder
      .speak(speechOutput)
      .getResponse();
  },
};

const HelpHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(HELP_MESSAGE)
      .getResponse();
  },
};

const ExitHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request.intent.name === 'AMAZON.CancelIntent'
        || request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);
    return handlerInput.responseBuilder
      .speak(ERROR_MESSAGE)
      .getResponse();
  },
};

const ERROR_MESSAGE = 'Sorry, lock error, plese lock the car by person.';
const HELP_MESSAGE = 'You can say lock my car to lock your mercedes-benz.';

const skillBuilder = Alexa.SkillBuilders.standard();
exports.handler = skillBuilder
  .addRequestHandlers(
    LockCarHandler,
    HelpHandler,
    ExitHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();