// Copyright 2018-2020Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');

const {
  find
} = require('lodash')

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const { TABLE_NAME,  ROOMS } = process.env;

exports.handler = async event => {

  console.log("Process env:", process.env)

  let connectionData;
  let rooms;
  let message;
  let roomId;
  let userId;
  
  const postData = JSON.parse(event.body);
  console.log("Got data:", postData.data)

  if(!postData.data){
    message = JSON.parse(postData).message
    roomId = JSON.parse(postData).roomId
    userId = JSON.parse(postData).userId
  }else{
    message = postData.data.message
    roomId = postData.data.roomId
    userId = postData.data.userId
  }

  console.log(`Got message: ${message} from: ${userId} for room id: ${roomId}`)

  try {

    connectionData = await ddb.scan({ TableName: TABLE_NAME, ProjectionExpression: 'connectionId, userId' }).promise();
    rooms = await ddb.scan({ TableName: ROOMS, FilterExpression : 'roomId = :roomId', ExpressionAttributeValues: {':roomId' : roomId} }).promise();
    console.log("rooms:", rooms);

  } catch (e) {
    console.log("error:", e)
    return { statusCode: 500, body: e.stack };
  }
  console.log("Connected users: ", connectionData)

  let room = rooms.Items[0]
  console.log("Room: ", room)

  //TODO: remove this from sendMessage
  if(!room){
    room = {
      users:["1"],
      messages:["hello"],
      roomId: "2"
    } 
  }
  console.log("Current room: ", room)

  room.messages.push(message)

  const putParams = {
    TableName: ROOMS,
    Item: room
  };
  console.log('saving data:', putParams);

  try {
    //TODO: Check if user has a permission for this room (if he is in the room)
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
  
  //TODO: Important: Make better by only getting connections for room users
  const postCalls = connectionData.Items.map(async ({ connectionId, userId }) => {
    try {

      console.log("looped user: ", userId)
      const hit = find(room.users, uid => {
        return userId == uid
      })
      console.log(hit)

      // Check if userId is in the current room send
      if(hit){
        await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify({message, roomId, userId}) }).promise();
      }
      
    } catch (e) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb.delete({ TableName: TABLE_NAME, Key: { connectionId } }).promise();
      } else {
        console.log("Error sending a message: ", e)
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
