document.addEventListener("DOMContentLoaded", function(event) {
    /* Counters */
    const reservationsCounter = document.getElementById('statsReservationsCount');
    reservationsCounter && fetch('/api/statistics').then((response) => response.json()).then((data) => { reservationsCounter.innerHTML = `(${data.counters.reservations_upcoming})` })

    /* Reserve Slot constants */
    const reserveSlotModal = document.getElementById('reserveSlot')
    const reserveSlotForm = document.getElementById("reserveSlotForm")

    /* The Reserve Slot Modal is shown */
    reserveSlotModal && reserveSlotModal.addEventListener('show.bs.modal', event => {
        const button = event.relatedTarget
        const submitButton = reserveSlotModal.querySelector('#reserveSlotSubmitButton')
        const slot_id = button.getAttribute('data-bs-slot-id')
        submitButton.disabled = true
        reserveSlotModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        reserveSlotModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        fetch(`/api/slot/${slot_id}`)
        .then((response) => response.json())
        .then((data) => {
            if (data.success == false) {
                reserveSlotModal.querySelector('#reserveSlotError div.alert span').innerText = data.message
                reserveSlotModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
                reserveSlotModal.querySelector('div.modal-body.loaded-content').style.display = "block"
                reserveSlotModal.querySelector('#reserveSlotError').style.display = "block"
            }
            else {
                reserveSlotModal.querySelector('#r_slot_id').value = data.id
                reserveSlotModal.querySelector('#r_type').value = data.type
                reserveSlotModal.querySelector('#r_message').value = ""
                reserveSlotModal.querySelector('#r_course_name').innerText = data.course_name
                reserveSlotModal.querySelector('#r_instructor_name').innerText = data.instructor_name
                reserveSlotModal.querySelector('#r_location_name').innerText = data.location_name
                reserveSlotModal.querySelector('#r_slot_time').innerText = data.time_human_readable_sv

                if (data.course_message_required == false) {
                    reserveSlotModal.querySelector("#r_message").removeAttribute("required")
                }
                if (data.course_description !== '') {
                    reserveSlotModal.querySelector('#r_course_description').innerText = data.course_description
                    reserveSlotModal.querySelector('#r_course_description').classList.remove("d-none")
                }

                if (data.type === "individual") {
                    reserveSlotModal.querySelector('#reserveSlotGroupConnectNotice').style.display = "none"
                    reserveSlotModal.querySelector('#reserveSlotGroupNotice').style.display = "none"
                    reserveSlotModal.querySelector('#reserveSlotIndividualBlock').style.display = "block"
                    reserveSlotModal.querySelector('#reserveSlotGroupBlock').style.display = "none"
                    reserveSlotModal.querySelector('#reserveSlotUserNotInGroup').style.display = "none"
                    submitButton.disabled = false
                }
                else {
                    reserveSlotModal.querySelector('#reserveSlotIndividualBlock').style.display = "none"
                    reserveSlotModal.querySelector('#reserveSlotGroupBlock').style.display = "block"
                    
                    if (reserveSlotModal.querySelector('#r_group_string').value == '') {
                        reserveSlotModal.querySelector('#reserveSlotUserNotInGroup').style.display = "block"
                    }
                    else {
                        reserveSlotModal.querySelector('#reservations').replaceChildren()
                        if (data.reservations && data.reservations.length > 0) {
                            data.reservations.forEach(reservation => {
                                const r = reserveSlotModal.querySelector('#reservations').appendChild(document.createElement('div'))
                                r.innerText = reservation.canvas_group_name
                            })
                            if (data.res_now == (data.res_max - 1) && data.course_message_all_when_full) {
                                reserveSlotModal.querySelector('#reserveSlotGroupConnectNotice').style.display = "block"
                                reserveSlotModal.querySelector('#reserveSlotGroupNotice').style.display = "none"
                            }
                            else {
                                reserveSlotModal.querySelector('#reserveSlotGroupConnectNotice').style.display = "none"
                                reserveSlotModal.querySelector('#reserveSlotGroupNotice').style.display = "block"
                            }
                            reserveSlotModal.querySelector('#reservationsContainer').style.display = "block"
                        }
                        else {
                            reserveSlotModal.querySelector('#reserveSlotGroupConnectNotice').style.display = "none"
                            reserveSlotModal.querySelector('#reserveSlotGroupNotice').style.display = "block"
                            reserveSlotModal.querySelector('#reservationsContainer').style.display = "none"
                        }
                        submitButton.disabled = false
                    }
                }

                reserveSlotModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
                reserveSlotModal.querySelector('div.modal-body.loaded-content').style.display = "block"
                reserveSlotModal.querySelector('#reserveSlotError').style.display = "none"
            }
        })
        .catch((error) => {
            reserveSlotModal.querySelector('#reserveSlotError').innerText = error.message
            reserveSlotModal.querySelector('#reserveSlotError').style.display = "block"
        })
    })
    

    /* The Reserve Slot Modal Form is submitted */
    if (reserveSlotForm) {
        reserveSlotForm.addEventListener("submit", function(event) {
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

                const submitButton = reserveSlotModal.querySelector('#reserveSlotSubmitButton')
                const submitSpinner = submitButton.querySelector('span.spinner-border')

                submitButton.disabled = true
                submitSpinner.style.display = "inline-block"

                fetch(`/api/reservation`, requestOptions)
                .then(response => {
                    return response.text();
                })
                .then(data => { 
                    const responseBody = JSON.parse(data)
                    if (responseBody.success === false) {
                        reserveSlotModal.querySelector('#reserveSlotError .alert span').innerText = JSON.parse(data).message
                        reserveSlotModal.querySelector('#reserveSlotError').classList.remove("d-none")
                        reserveSlotModal.querySelector('#reserveSlotError').classList.add("d-block")
                        submitButton.disabled = false
                    }
                    else {
                        window.location.assign("/reservations?reservationDone=true" + (reserveSlotModal.querySelector('#r_type').value == 'group' ? "&reservationGroup=true" : "") + "&reservationId=" + responseBody.reservation_id)
                    }
                    submitSpinner.classList.remove("d-inline-block")        
                    submitSpinner.classList.add("d-none")
                })
                .catch(error => {
                    reserveSlotModal.querySelector('#reserveSlotError .alert span').innerText = error
                    reserveSlotModal.querySelector('#reserveSlotError').classList.remove("d-none")
                    reserveSlotModal.querySelector('#reserveSlotError').classList.add("d-block")
                    submitButton.disabled = false
                    submitSpinner.classList.remove("d-inline-block")        
                    submitSpinner.classList.add("d-none")
                })
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
            const submitButton = deleteReservationModal.querySelector("#deleteReservationSubmitButton")

            if (deleteReservationModal.querySelector("#deleteReservationWarning").classList.contains("d-block")) {
                deleteReservationModal.querySelector("#deleteReservationWarning").classList.remove("d-block")
                deleteReservationModal.querySelector("#deleteReservationWarning").classList.add("d-none")
            }
            if (deleteReservationModal.querySelector('#deleteReservationError').classList.contains("d-block")) {
                deleteReservationModal.querySelector('#deleteReservationError').classList.remove("d-block")
                deleteReservationModal.querySelector('#deleteReservationError').classList.add("d-none")
            }

            fetch(`/api/reservation/${reservation_id}`)
            .then(response => response.json())
            .then(data => {
                deleteReservationModal.querySelector('#d_reservation_id').value = data.id
                deleteReservationModal.querySelector('#d_reservation_type').value = data.is_group ? "group" : "individual"
                deleteReservationModal.querySelector('#d_course_name').innerText = data.course_name
                deleteReservationModal.querySelector('#d_instructor_name').innerText = data.instructor_name
                deleteReservationModal.querySelector('#d_location_name').innerText = data.location_name
                deleteReservationModal.querySelector('#d_slot_time').innerText = data.time_human_readable_sv

                submitButton.disabled = false;

                if (!data.is_cancelable) {
                    if (deleteReservationModal.querySelector("#deleteReservationNotCancelable").classList.contains("d-none")) {
                        deleteReservationModal.querySelector("#deleteReservationNotCancelable").classList.remove("d-none")
                        deleteReservationModal.querySelector("#deleteReservationNotCancelable").classList.add("d-block")
                    }
                    submitButton.disabled = true;
                }
                else {
                    if (data.is_group) {
                        if (deleteReservationModal.querySelector("#deleteReservationWarning").classList.contains("d-none")) {
                            deleteReservationModal.querySelector("#deleteReservationWarning").classList.remove("d-none")
                            deleteReservationModal.querySelector("#deleteReservationWarning").classList.add("d-block")
                        }
                    }    
                }
            })
        });    
    }

    /* The Cancel Reservation Form is submitted */
    if (deleteReservationForm) {
        deleteReservationForm.addEventListener("submit", function(event) {
            const requestOptions = {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            };
        
            const r_id = deleteReservationModal.querySelector('#d_reservation_id').value
            const r_type = deleteReservationModal.querySelector('#d_reservation_type').value
            const r_course = deleteReservationModal.querySelector('#d_course_name').innerText

            const submitButton = deleteReservationModal.querySelector('#deleteReservationSubmitButton')
            const submitSpinner = submitButton.querySelector('span.spinner-border')

            submitButton.disabled = true
            submitSpinner.classList.remove("d-none")
            submitSpinner.classList.add("d-inline-block")

            fetch(`/api/reservation/${r_id}`, requestOptions)
            .then(response => {
                return response.text();
            })
            .then(data => { 
                const responseBody = JSON.parse(data)
                if (responseBody.success === false) {
                    deleteReservationModal.querySelector('#deleteReservationError .alert span').innerText = JSON.parse(data).message
                    deleteReservationModal.querySelector('#deleteReservationError').classList.remove("d-none")
                    deleteReservationModal.querySelector('#deleteReservationError').classList.add("d-block")
                    submitButton.disabled = false
                }
                else {
                    window.location.assign("/reservations?reservationDeleted=true" + (r_type == 'group' ? "&reservationGroup=true" : "") + "&reservationTitle=" + r_course)
                }
                submitSpinner.classList.remove("d-inline-block")        
                submitSpinner.classList.add("d-none")
            })
            .catch(error => {
                deleteReservationModal.querySelector('#deleteReservationError .alert span').innerText = error
                deleteReservationModal.querySelector('#deleteReservationError').classList.remove("d-none")
                deleteReservationModal.querySelector('#deleteReservationError').classList.add("d-block")
                submitButton.disabled = false
                submitSpinner.classList.remove("d-inline-block")        
                submitSpinner.classList.add("d-none")
            });
            
            event.preventDefault();
            event.stopPropagation();
        });
    }
})
