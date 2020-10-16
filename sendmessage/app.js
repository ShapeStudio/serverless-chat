// Copyright 2018-2020Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const {
  find, filter
} = require('lodash')

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const { TABLE_NAME,  ROOMS, MESSAGES } = process.env;

exports.handler = async event => {

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  });

  console.log("Process env:", process.env);

  let now = Date.now();
  let connectionData;
  let rooms;
  let room;
  let message = {
    roomId: "",
    userId: "",
    createdAt: now,
    text: "",
    assetId: "",
    messageId: uuidv4()
  };
  let response = {}
  
  const postData = JSON.parse(event.body);
  console.log("Got data:", postData.data);

  if(!postData.data){
    message.text = JSON.parse(postData).message
    message.roomId = JSON.parse(postData).roomId
    message.userId = JSON.parse(postData).userId
  }else{
    message.text = postData.data.message
    message.roomId = postData.data.roomId
    message.userId = postData.data.userId
  }

  console.log(`Got message: ${message.text} from: ${message.userId} for room id: ${message.roomId}`);

  try {

    // READ 1
    rooms = await ddb.scan({ TableName: ROOMS, FilterExpression : 'roomId = :roomId', ExpressionAttributeValues: {':roomId' : message.roomId} }).promise();
    room = rooms.Items[0]

    //TODO: If there is no room add it. Remove this later on
    if(!room){
      room = {
        users:[ `${message.userId}` ],
        createdAt: now,
        roomId: message.roomId
      } 
    }
    console.log("Selected room: ", room)

     // READ 2
    connectionData = await ddb.scan({ TableName: TABLE_NAME, ProjectionExpression: 'connectionId, userId' }).promise();
    console.log("rooms:", rooms);

  } catch (e) {
    console.log("error:", e)
    return { statusCode: 500, body: e.stack };
  }
  console.log("All Connected users: ", connectionData.Items)

  // SAVE MESSAGE
  const newMessage = {
    TableName: MESSAGES,
    Item: message
  };

  try {
    await ddb.put(newMessage).promise();
  } catch (err) {
    console.log("errr", err)
    return { statusCode: 500, body: 'Failed to connect to DB: ' + JSON.stringify(err) };
  }

  room.updatedAt = now
  
  //Add user if its not in the room
  const hit = find(room.users, uid => { return uid === message.userId.toString() })
  console.log(`hit: ${hit}`)
  if(!hit){
    room.users.push(message.userId)
  }

  const newRoom = {
    TableName: ROOMS,
    Item: room
  };
  console.log('Saving new room:', newRoom);
  //TODO: Check if user has a permission for this room
  // WRITE 1
  try {
    await ddb.put(newRoom).promise();
    console.log("New room saved")
  } catch (err) {
    console.log("errr", err)
    return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
  }

  let hitt = false
  const currentlyConnected = filter(connectionData.Items, Item => {

    // console.log("users - current", room.users, Item.userId.toString())

    hitt = (find(room.users, uid => { return uid === Item.userId.toString() })) ? true : false
    // console.log(hitt)

    return hitt
  })
  console.log(`currentlyConnected in the room: ${currentlyConnected}`)

  response = {
    type: "NEW_MESSAGE",
    message,
    createdAt: now
  }
  
  const postCalls = currentlyConnected.map(async ({ connectionId, userId }) => {
    try {
      await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify(response)}).promise(); 
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
