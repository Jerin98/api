const mongoose = require('mongoose');

const TimetableSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        minlength: 1,
        trim: true
    },
    // with auth
    _userId: {
        type: mongoose.Types.ObjectId,
        required: true
    }

})

const Timetable = mongoose.model('Timetable', TimetableSchema);

module.exports = { Timetable }