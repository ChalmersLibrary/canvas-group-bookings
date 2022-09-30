'use strict'

function getDatePart(date) {
    const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
    console.log("Incoming: " + date);
    console.log("Outgoing: " + new Date(date).toLocaleDateString('sv-SE', dateOptions));
    return new Date(date).toLocaleDateString('sv-SE', dateOptions);
}
function getTimePart(date) {
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    return new Date(date).toLocaleTimeString('sv-SE', timeOptions);
}

module.exports = {
    getDatePart,
    getTimePart
}