class ServerError extends Error {
    constructor(message: string) {
        super(message); // Call the constructor of the base class `Error`
        this.name = "ServerError"; // Set the error name to your custom error class name
// Set the prototype explicitly to maintain the correct prototype chain
        Object.setPrototypeOf(this, ServerError.prototype);
    }
}
export default ServerError;