// Copyright 2018-2020Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken')

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const { TABLE_NAME,  ROOMS, JWT_SECRET } = process.env;

exports.handler = async (event, context, callback) => {

  // Retrieve request parameters from the Lambda function input:
  var headers = event.headers;
  var queryStringParameters = event.queryStringParameters;
  var stageVariables = event.stageVariables;
  var requestContext = event.requestContext;

  console.log('Headers: ', headers)
  console.log('QueryStringParameters: ', queryStringParameters)
  console.log('stageVariables: ', stageVariables)
  console.log('requestContext: ', requestContext)

  if (!queryStringParameters.Authorization) {
    generateDeny('Missing Authorization token');
  }

  var decoded = jwt.verify(queryStringParameters.Authorization, JWT_SECRET)

  console.log("Decoded token: ", decoded)

  if(decoded){

    const putParams = {
      TableName: TABLE_NAME,
      Item: {
        connectionId: event.requestContext.connectionId,
        timeStamp: Date.now(),
        userId: decoded.user.id
      }
    };
  
    try {
      await ddb.put(putParams).promise();
    } catch (err) {
      console.log("errr", err)
      return { statusCode: 500, body: 'Failed to connect to DB: ' + JSON.stringify(err) };
    }

    callback(null, generateAllow('me', event.methodArn));

  }else{
    callback("Unauthorized");
  }
  
};

var generatePolicy = function(principalId, effect, resource) {
  // Required output:
  var authResponse = {};
  authResponse.principalId = principalId;
  if (effect && resource) {
      var policyDocument = {};
      policyDocument.Version = '2012-10-17'; // default version
      policyDocument.Statement = [];
      var statementOne = {};
      statementOne.Action = 'execute-api:Invoke'; // default action
      statementOne.Effect = effect;
      statementOne.Resource = resource;
      policyDocument.Statement[0] = statementOne;
      authResponse.policyDocument = policyDocument;
  }
  
  /*
  authResponse.context = {
      "userId": "1"
  };
  */

  return authResponse;
}

var generateAllow = function(principalId, resource) {
  return generatePolicy(principalId, 'Allow', resource);
}
   
var generateDeny = function(principalId, resource) {
  return generatePolicy(principalId, 'Deny', resource);
}
