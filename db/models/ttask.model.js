const mongoose = require('mongoose');

const TtaskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        minlength: 1,
        trim: true
    },
    _timetableId: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    completed: {
        type: Boolean,
        default: false
    }
})

const Ttask = mongoose.model('Ttask', TtaskSchema);

module.exports = { Ttask }