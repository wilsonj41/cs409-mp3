import mongoose, { mongo } from "mongoose";

var TaskSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    deadline: {
        type: Date,
        required: true
    },
    completed: {
        type: Boolean,
        default: false
    }

});

export default mongoose.model('Task', TaskSchema);