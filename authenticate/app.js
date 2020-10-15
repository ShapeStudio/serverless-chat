// Copyright 2018-2020Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken')

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const { TABLE_NAME,  ROOMS, JWT_SECRET } = process.env;

exports.handler = async event => {

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
    await generateAllow(event, decoded.user.id);
  }else{
    await generateDeny('JWT error');
  }
  
};

var generateAllow = async function(event, userId) {

  const putParams = {
    TableName: TABLE_NAME,
    Item: {
      connectionId: event.requestContext.connectionId,
      timeStamp: Date.now(),
      userId
    }
  };

  try {
    await ddb.put(putParams).promise();
  } catch (err) {
    console.log("errr", err)
    return { statusCode: 500, body: 'Failed to connect to DB: ' + JSON.stringify(err) };
  }

  return { statusCode: 200, body: 'Authenticated.' };
}
   
var generateDeny = async function(message) {

  return { statusCode: 500, body: `Failed to Authenticate: ${message}` };

}
