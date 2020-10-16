// Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const { TABLE_NAME } = process.env;

exports.handler = async event => {

  console.log('CONNECTED Event: ', event)
  let connectionData;

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  });

  try {

    connectionData = await ddb.scan({ TableName: TABLE_NAME, ProjectionExpression: 'connectionId, userId' }).promise();

  } catch (e) {
    console.log("error:", e)
    return { statusCode: 500, body: e.stack };
  }
  console.log("All Connected users: ", connectionData.Items)

  const roomStats = {
    activeUsers: connectionData.Items.length,
    itemsSold: 0,
    currentDiscount: 0
  }

  const postCalls = connectionData.Items.map(async ({ connectionId, userId }) => {
    try {
        await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify(roomStats) }).promise();
    } catch (e) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb.delete({ TableName: TABLE_NAME, Key: { connectionId } }).promise();
      } else {
        console.log("Error sending a message: ", e)
        throw e;
      }
    }
  })

  return { statusCode: 200, body: 'Connected.' };
};
