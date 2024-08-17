import { Socket } from "socket.io";
import createMessage from "./controllers/MessageCreate";

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
        if(Number.isInteger(result)) {
            data["messageNumber"] = result
        // Emit a 'newMessage' event to all sockets in the channel except the sender
        socket.to(data.channel).emit('newMessage', { ...data, "sender": id });
        console.log(`Message Number ${data["messageNumber"]}`)
        }
        //TODO Handle ERROR
    })
    // Listen for a 'seen' event over the socket
    socket.on('seen', (data) => {
        // Join the socket to the channel associated with the seen message
        socket.join(data.channel)
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
