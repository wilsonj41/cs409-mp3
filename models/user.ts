// Load required packages
import mongoose from 'mongoose';

// Define our user schema
var UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    pendingTasks: [String],
    dateCreated: {
        type: Date,
        default: Date.now,
        immutable: true
    }
});

// Export the Mongoose model
export default mongoose.model('User', UserSchema);
