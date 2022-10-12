document.addEventListener("DOMContentLoaded", function(event) {
    const slotFilterCourse = document.getElementById('slotFilterCourse');
    const slotFilterAvailable = document.getElementById('slotFilterAvailability');
    const slots = document.querySelectorAll('#slots tbody tr');

    if (slotFilterCourse) {
        slotFilterCourse.addEventListener('change', function () {
            let value = slotFilterCourse.value;
    
            [...slots].forEach((slot) => {
                if (value === '') {
                    slot.classList.remove('d-none');
                }
                else {
                    const course_id = slot.dataset.course_id;
                    if (!course_id || course_id !== value) {
                        slot.classList.add('d-none');
                    }
                    else {
                        slot.classList.remove('d-none');
                    }
                }
            });
        });    
    }
    if (slotFilterAvailable) {
        slotFilterAvailable.addEventListener('change', function () {
            let value = slotFilterAvailable.value;
            
            [...slots].forEach((slot) => {
                if (value === '2') {
                    slot.classList.remove('d-none');
                }
                else {
                    if (slot.dataset.available == 'true') {
                        slot.classList.remove('d-none');
                    }
                    else {
                        slot.classList.add('d-none');
                    }
                }
            });
        });    
    }

    /* Reserve Slot constants */
    const reserveSlotModal = document.getElementById('reserveSlot')
    const reserveSlotForm = document.getElementById("reserveSlotForm")

    /* The Reserve Slot Modal is shown */
    if (reserveSlotModal) {
        reserveSlotModal.addEventListener('show.bs.modal', event => {
            const button = event.relatedTarget
            const slot_id = button.getAttribute('data-bs-slot-id')
            fetch(`/api/slot/${slot_id}`)
            .then(response => response.json())
            .then(data => {
                console.log(data)
                reserveSlotModal.querySelector('#r_slot_id').value = data.id
                reserveSlotModal.querySelector('#r_type').value = data.type
                reserveSlotModal.querySelector('#r_message').value = ""
                reserveSlotModal.querySelector('#r_course_name').innerText = data.course_name
                reserveSlotModal.querySelector('#r_instructor_name').innerText = data.instructor_name
                reserveSlotModal.querySelector('#r_location_name').innerText = data.location_name
                reserveSlotModal.querySelector('#r_slot_time').innerText = data.shortcut.start_date + " kl " + data.shortcut.start_time + "--" + data.shortcut.end_time
                if (data.type === "individual") {
                    if (reserveSlotModal.querySelector('#reserveSlotGroupNotice').classList.contains("d-block")) {
                        reserveSlotModal.querySelector('#reserveSlotGroupNotice').classList.remove("d-block")
                        reserveSlotModal.querySelector('#reserveSlotGroupNotice').classList.add("d-none")
                    }
                    reserveSlotModal.querySelector('#reserveSlotIndividualBlock').classList.remove("d-none")
                    reserveSlotModal.querySelector('#reserveSlotIndividualBlock').classList.add("d-block")
                    reserveSlotModal.querySelector('#reserveSlotGroupBlock').classList.remove("d-block")
                    reserveSlotModal.querySelector('#reserveSlotGroupBlock').classList.add("d-none")
                }
                else {
                    if (reserveSlotModal.querySelector('#reserveSlotGroupNotice').classList.contains("d-none")) {
                        reserveSlotModal.querySelector('#reserveSlotGroupNotice').classList.remove("d-none")
                        reserveSlotModal.querySelector('#reserveSlotGroupNotice').classList.add("d-block")
                    }
                    reserveSlotModal.querySelector('#reservations').replaceChildren()
                    if (data.reservations && data.reservations.length > 0) {
                        data.reservations.forEach(reservation => {
                            const r = reserveSlotModal.querySelector('#reservations').appendChild(document.createElement('div'))
                            r.innerText = reservation.canvas_group_name
                            reserveSlotModal.querySelector('#reservationsCurrent').classList.remove("d-none")
                            reserveSlotModal.querySelector('#reservationsCurrent').classList.add("d-block")
                            console.log(reservation)
                        })
                        reserveSlotModal.querySelector('#reserveSlotWarning').classList.remove("d-none")
                        reserveSlotModal.querySelector('#reserveSlotWarning').classList.add("d-block")
                    }
                }
            })
            if (reserveSlotModal.querySelector('#reserveSlotError').classList.contains("d-block")) {
                reserveSlotModal.querySelector('#reserveSlotError').classList.remove("d-block")
                reserveSlotModal.querySelector('#reserveSlotError').classList.add("d-none")
            }
        });
    }
    

    /* The Reserve Slot Modal Form is submitted */
    if (reserveSlotForm) {
        reserveSlotForm.addEventListener("submit", function(event) {
            console.log(event);
            console.log("Time to submit the form: reserveSlotForm");
    
            if (!reserveSlotForm.checkValidity()) {
                event.preventDefault()
                event.stopPropagation()
                reserveSlotForm.classList.add('was-validated')
            }
            else {
                reserveSlotForm.classList.add('was-validated')
    
                const requestOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        slot_id: reserveSlotModal.querySelector('#r_slot_id').value,
                        group_id: reserveSlotModal.querySelector('#r_group_id').value,
                        user_id: reserveSlotModal.querySelector('#r_user_id').value,
                        message: reserveSlotModal.querySelector('#r_message').value
                    })
                };
        
                console.log(requestOptions);
        
                fetch(`/api/reservation`, requestOptions)
                .then(response => {
                    return response.text();
                })
                .then(data => { 
                    console.log(data)
                    const responseBody = JSON.parse(data)
                    if (responseBody.success === false) {
                        console.error(responseBody.message)
                        reserveSlotModal.querySelector('#reserveSlotError .alert span').innerText = JSON.parse(data).message
                        reserveSlotModal.querySelector('#reserveSlotError').classList.remove("d-none")
                        reserveSlotModal.querySelector('#reserveSlotError').classList.add("d-block")
                    }
                    else {
                        window.location.assign("/reservations?reservationDone=true&reservationId=" + responseBody.reservation_id)
                    }
                });
            }
    
            event.preventDefault();
            event.stopPropagation();
        });
    }

    /* Cancel Reservation constants */
    const deleteReservationModal = document.getElementById('deleteReservation')
    const deleteReservationForm = document.getElementById("deleteReservationForm")

    /* The Cancel Reservation Modal is shown */
    if (deleteReservationModal) {
        deleteReservationModal.addEventListener('show.bs.modal', event => {
            const button = event.relatedTarget
            const reservation_id = button.getAttribute('data-bs-reservation-id')

            if (deleteReservationModal.querySelector("#deleteReservationWarning").classList.contains("d-block")) {
                deleteReservationModal.querySelector("#deleteReservationWarning").classList.remove("d-block")
                deleteReservationModal.querySelector("#deleteReservationWarning").classList.add("d-none")
            }

            fetch(`/api/reservation/${reservation_id}`)
            .then(response => response.json())
            .then(data => {
                console.log(data)
                deleteReservationModal.querySelector('#d_reservation_id').value = data.id
                deleteReservationModal.querySelector('#d_course_name').innerText = data.course_name
                deleteReservationModal.querySelector('#d_instructor_name').innerText = data.instructor_name
                deleteReservationModal.querySelector('#d_location_name').innerText = data.location_name
                deleteReservationModal.querySelector('#d_slot_time').innerText = data.time_human_readable_sv

                if (data.is_group) {
                    if (deleteReservationModal.querySelector("#deleteReservationWarning").classList.contains("d-none")) {
                        deleteReservationModal.querySelector("#deleteReservationWarning").classList.remove("d-none")
                        deleteReservationModal.querySelector("#deleteReservationWarning").classList.add("d-block")
                    }
                }
            })
        });    
    }

    /* The Cancel Reservation Form is submitted */
    if (deleteReservationForm) {
        deleteReservationForm.addEventListener("submit", function(event) {
            console.log(event);
            console.log("Time to submit the form: deleteReservationForm");
    
            const requestOptions = {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            };
    
            console.log(requestOptions);
    
            const r_id = deleteReservationModal.querySelector('#d_reservation_id').value
            const r_course = deleteReservationModal.querySelector('#d_course_name').innerText

            fetch(`/api/reservation/${r_id}`, requestOptions)
            .then(response => {
                return response.text();
            })
            .then(data => { 
                console.log(data)
                const responseBody = JSON.parse(data)
                if (responseBody.success === false) {
                    console.error(JSON.parse(data).message)
                    deleteReservationModal.querySelector('#deleteReservationError .alert span').innerText = JSON.parse(data).message
                    deleteReservationModal.querySelector('#deleteReservationError').classList.remove("d-none")
                    deleteReservationModal.querySelector('#deleteReservationError').classList.add("d-block")
                }
                else {
                    window.location.assign("/reservations?reservationDeleted=true&reservationTitle=" + r_course)
                }
            });
            
            event.preventDefault();
            event.stopPropagation();
        });
    }
})
