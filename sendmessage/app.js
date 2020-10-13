// Copyright 2018-2020Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const { TABLE_NAME,  ROOMS } = process.env;

exports.handler = async event => {

  console.log(process.env)

  let connectionData;
  let rooms;
  
  const postData = JSON.parse(event.body).data;
  console.log(postData)

  // const message = JSON.parse(postData).message
  // const roomId = JSON.parse(postData).roomId
  // console.log(message, roomId)
  
  const message = postData.message
  const roomId = postData.roomId
  console.log(message, roomId)

  try {

    connectionData = await ddb.scan({ TableName: TABLE_NAME, ProjectionExpression: 'connectionId' }).promise();
    rooms = await ddb.scan({ TableName: ROOMS, FilterExpression : 'roomId = :roomId', ExpressionAttributeValues: {':roomId' : roomId} }).promise();
    console.log("rooms:", rooms);

  } catch (e) {
    console.log("error:", e)
    return { statusCode: 500, body: e.stack };
  }

  let room = rooms.Items[0]
  console.log(room)

  if(!room){
    room = {
      users:["1"],
      messages:["hello"],
      roomId: "2"
    } 
  }
  console.log(room)

  room.messages.push(message)

  const putParams = {
    TableName: ROOMS,
    Item: room
  };
  console.log('saving data:', putParams);

  try {
    await ddb.put(putParams).promise();
    console.log("saved")
  } catch (err) {
    console.log("errr", err)
    return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
  }
  
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  });
  
  const postCalls = connectionData.Items.map(async ({ connectionId }) => {
    try {
      await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify(postData) }).promise();
    } catch (e) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb.delete({ TableName: TABLE_NAME, Key: { connectionId } }).promise();
      } else {
        throw e;
      }
    }
  });
  
  try {
    await Promise.all(postCalls);
  } catch (e) {
    console.log("error:", e)
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: 'Data sent.' };
};
