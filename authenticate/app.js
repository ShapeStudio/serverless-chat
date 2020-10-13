// Copyright 2018-2020Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const { TABLE_NAME,  ROOMS } = process.env;

exports.handler = async event => {

  console.log('CONNECTED: ', event.body)

  /*

  const postData = JSON.parse(event.body).data;

  const userId = postData.userId;

  const putParams = {
    TableName: process.env.TABLE_NAME,
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
    return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
  }
  */

  return { statusCode: 200, body: 'Authenticated.' };
};
