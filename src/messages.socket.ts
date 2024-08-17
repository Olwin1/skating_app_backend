import { Socket } from "socket.io";
import createMessage from "./controllers/MessageCreate";
import { Worker } from 'snowflake-uuid'; // Import a unique ID generator library
import prisma from "./db/postgres";

// Create a unique ID generator instance
const generator = new Worker(0, 1, {
    workerIdBits: 5,
    datacenterIdBits: 5,
    sequenceBits: 12,
});

// Define a function to handle a new connection to the socket
const handleConnection = (socket: Socket, payload: any) => {
    console.log("Connecting new client to socket.")
    const { _id } = payload

    // Call the sendEvent function when a new connection is established
    sendEvent(socket, _id)
}

// Define a function to send a new event over the socket
function sendEvent(socket: Socket, id: string) {
    // Listen for a 'message' event over the socket
    socket.on('message', async (e) => {
        // Parse the message data from the incoming event
        //if(e.)
        //const data = JSON.parse(e)
        const data = e
        // Check if the message has an image and replace empty strings with null
        data.img == '' ? data.img = null : null
        // Join the socket to the channel associated with the message
        socket.join(data.channel)
        // Call the createMessage function to save the message in the database
        const result = await createMessage(BigInt(id), data.channel, data.content, data.img)
        if('message_number' in result) {
            data["messageNumber"] = result.message_number
            data["messageId"] = result.message_id

        // Emit a 'newMessage' event to all sockets in the channel except the sender
        socket.to(data.channel).emit('newMessage', { ...data, "sender": id });
        socket.emit('delivered', { ...data, "sender": id });
        console.log(`Message Number ${data["messageNumber"]} Message Id ${data["messageId"]}`)
        }
        //TODO Handle ERROR
    })
    // Listen for a 'seen' event over the socket
    socket.on('seen', async (data) => {
        // Join the socket to the channel associated with the seen message
        socket.join(data.channel)
        const readerId = generator.nextId();
        
        const result = await prisma.message_readers.create({data: {
            message_reader_id: readerId,
            message_id: BigInt(data.messageId),
            user_id: BigInt(id),
            timestamp: new Date()
        }})

        // Emit a 'newSeen' event to all sockets in the channel except the sender
        socket.to(data.channel).emit('newSeen', {...data, "sender": id});
    })
    // Listen for a 'typing' event over the socket
    socket.on('typing', (data) => {
        // Join the socket to the channel associated with the typing indicator
        socket.join(data.channel)
        // Emit a 'newTyping' event to all sockets in the channel except the sender
        socket.to(data.channel).emit('newTyping', { "id": id, "started": data.started });
    })
    socket.on('joinChannel', (e: String) => {
        console.log(e)
        console.log(e)
        console.log(e)
        try {
            if (e) {
                // Parse the typing data from the incoming event
                let channels = e as string;
                // Join the socket to the channel associated with the typing indicator
                console.log(channels);
                socket.join(channels)
            }
        }
        catch (e: any) {
            console.log(e)
            console.log(e.message);
        }
    })

    socket.onAny((e: String) => {
        console.log(`Recieved Event: ${e}`)
    })
}

// Export the handleConnection function
export default handleConnection;
