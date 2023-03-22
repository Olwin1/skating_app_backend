import mongoose from "../db/connection" // import Schema & model

// .Todo Schema
const TodoSchema = new mongoose.Schema({
    username: {type: String, required: true},
    reminder: {type: String, required: true},
    completed: {type: Boolean, required: true, default: false}
})

// .Todo model
const Todo = mongoose.model("Todo", TodoSchema)

export default Todo;