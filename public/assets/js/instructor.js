document.addEventListener("DOMContentLoaded", function(event) {
    /* Modal and form references */
    const slotDetailsOffcanvas = document.getElementById("offcanvasSlotDetails")
    const slotDetailsOffcanvasMessaging = document.getElementById("offcanvasSlotDetailsMessaging")
    const slotDetailsOffcanvasMessagingButton = document.getElementById("offcanvasSlotDetails_send_message")
    const slotDetailsOffcanvasMessagingCancel = document.getElementById("offcanvasSlotDetailsMessaging_cancel")
    const newSlotModal = document.getElementById("newSlotSeries")
    const newSlotForm = document.getElementById("newSlotForm")
    const editSlotModal = document.getElementById("editSlot")
    const editSlotForm = document.getElementById("editSlotForm")
    const deleteSlotModal = document.getElementById("deleteSlot")
    const deleteSlotForm = document.getElementById("deleteSlotForm")
    const messagingForm = document.getElementById("offcanvasSlotDetailsMessaging_form")

    /* The slot details pane (offcanvas) is shown, load information */
    slotDetailsOffcanvas && slotDetailsOffcanvas.addEventListener('show.bs.offcanvas', event => {
        const button = event.relatedTarget
        const this_id = button.getAttribute('data-bs-slot-id')
        slotDetailsOffcanvas.querySelector('div.offcanvas-body.loading-spinner').style.display = "block"
        slotDetailsOffcanvas.querySelector('div.offcanvas-body.loaded-content').style.display = "none"

        fetch(`/api/instructor/slot/${this_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsLabel').innerHTML = data.course_name
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetails_time').innerHTML = data.time_human_readable
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetails_location').innerHTML = data.location_name
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetails_type_details').innerHTML = data.type_details_human_readable
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetails_ical_button').setAttribute('href', "/api/instructor/slot/" + this_id + "/entry.ics")
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetails_ical_button').setAttribute('download', data.ics_file_name)
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetails_reservations').replaceChildren()
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_receivers').replaceChildren()
            if (data.reservations && data.reservations.length) {
                data.reservations.forEach(reservation => {
                    const r = slotDetailsOffcanvas.querySelector('#offcanvasSlotDetails_reservations').appendChild(document.createElement('div'))
                    const rm = slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_receivers').appendChild(document.createElement('div'))
                    if (reservation.is_group) {
                        r.innerText = reservation.canvas_group_name + " (" + reservation.canvas_user_name + "), " + reservation.created_at.substring(0, 10)
                        rm.innerText = reservation.canvas_group_name
                    }
                    else {
                        r.innerText = reservation.canvas_user_name + ", " + reservation.created_at.substring(0, 10)
                        rm.innerText = reservation.canvas_user_name
                    }
                })
                messagingForm.setAttribute('action', `/api/instructor/slot/${this_id}/message`)
                messagingForm.querySelector('#message_text').value = ''
                messagingForm.querySelector('#message_text').disabled = false
                slotDetailsOffcanvasMessagingButton.removeAttribute("disabled")
            }
            else {
                const r = slotDetailsOffcanvas.querySelector('#offcanvasSlotDetails_reservations').appendChild(document.createElement('div'))
                r.innerText = slotDetailsOffcanvas.querySelector('#offcanvasSlotDetails_reservations').getAttribute("data-default-text")
                messagingForm.setAttribute('action', '')
                slotDetailsOffcanvasMessagingButton.setAttribute("disabled", true)
            }
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetails_sentMessages').replaceChildren()
            if (data.messages && data.messages.length) {
                data.messages.forEach(msg => {
                    const md = slotDetailsOffcanvas.querySelector('#offcanvasSlotDetails_sentMessages').appendChild(document.createElement('div'))
                    md.innerText = msg.created_at.substring(0, 10) + ", " + msg.message_subject 
                })
            }
            else {
                const mn = slotDetailsOffcanvas.querySelector('#offcanvasSlotDetails_sentMessages').appendChild(document.createElement('div'))
                mn.innerText = slotDetailsOffcanvas.querySelector('#offcanvasSlotDetails_sentMessages').getAttribute("data-default-text")
            }
        })            
        .then(finished => {
            slotDetailsOffcanvas.querySelector('div.offcanvas-body.loading-spinner').style.display = "none"
            slotDetailsOffcanvas.querySelector('div.offcanvas-body.loaded-content').style.display = "block"
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_success').classList.remove("d-block")
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_success').classList.add("d-none")
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_error').classList.remove("d-block")
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_error').classList.add("d-none")
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_actionButtons').classList.remove("d-none")
            slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_actionButtons').classList.add("d-block")
            slotDetailsOffcanvasMessaging.style.display = "none"
        })

        
    })

    /* Offcanvas: send message: open message dialog */
    slotDetailsOffcanvas && slotDetailsOffcanvasMessaging && slotDetailsOffcanvasMessagingButton && slotDetailsOffcanvasMessagingButton.addEventListener('click', event => {
        slotDetailsOffcanvasMessaging.style.display = "block"
    })

    /* Offcanvas: send message: close message dialog */
    slotDetailsOffcanvas && slotDetailsOffcanvasMessaging && slotDetailsOffcanvasMessagingButton && slotDetailsOffcanvasMessagingCancel.addEventListener('click', event => {
        slotDetailsOffcanvasMessaging.style.display = "none"
    })

    /* Offcanvas: send message: submit the message to send */
    slotDetailsOffcanvas && slotDetailsOffcanvasMessaging && messagingForm && messagingForm.addEventListener('submit', event => {
        const submitButton = messagingForm.querySelector('#offcanvasSlotDetailsMessaging_submit')
        const submitSpinner = messagingForm.querySelector('span.spinner-border')
        submitButton.disabled = true
        submitSpinner.style.display = "inline-block"

        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message_text: slotDetailsOffcanvasMessaging.querySelector('#message_text').value
            })
        };

        console.log(requestOptions);

        fetch(messagingForm.getAttribute('action'), requestOptions)
        .then(response => {
            return response.text();
        })
        .then(data => { 
            console.log(data)
            const responseBody = JSON.parse(data)
            if (responseBody.success) {
                slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_success .alert span').innerText = JSON.parse(data).message
                slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_success').classList.remove("d-none")
                slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_success').classList.add("d-block")
                slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_error').classList.remove("d-block")
                slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_error').classList.add("d-none")
                slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_actionButtons').classList.remove("d-block")
                slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_actionButtons').classList.add("d-none")
                submitButton.disabled = false
                submitSpinner.style.display = "none"
                messagingForm.querySelector('#message_text').disabled = true
            }
            else {
                slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_error .alert span').innerText = JSON.parse(data).message
                slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_error').classList.remove("d-none")
                slotDetailsOffcanvas.querySelector('#offcanvasSlotDetailsMessaging_error').classList.add("d-block")
                submitButton.disabled = false
                submitSpinner.style.display = "none"
            }
        });
        
        event.preventDefault();
        event.stopPropagation();
    })
    
    /* The new slot modal is shown, handle add/delete rows for times */
    newSlotModal && newSlotModal.addEventListener('show.bs.modal', event => {
        // var xx = new Date(document.getElementById("slot_date_1").value + "T" + document.getElementById("slot_time_start_1").value)
        // xx.setMinutes(xx.getMinutes() + 90)
        // must load default_slot_duration_minutes when course select changes...
        /* document.getElementById("slot_time_start_" + (slots_current.length + 1)).addEventListener("change", e => {
        })
           document.getElementById("slot_time_start_1").addEventListener("change", e => {
              console.log(e.srcElement.value)
        }) */
        document.getElementById("course_id").addEventListener("change", function(event) {
            console.log(event.target.value)
            fetch(`/api/instructor/course/${event.target.value}`)
            .then(response => response.json())
            .then(data => {
                console.log(data)
                if (data.success) {
                    document.getElementById("course_id").setAttribute("data-course-type", data.course.is_group ? "group" : "individual")
                    document.getElementById("course_id").setAttribute("data-course-max-individuals", data.course.is_individual ? data.course.max_individuals : "")
                }
                newSlotModal.querySelector('#slot_status_message .status_course').innerHTML = data.course.is_group ? "Gruppbokning, max " + data.course.max_groups + " st" : "Individuell bokning, max " + data.course.max_individuals + " personer"
                if (document.getElementById("course_id").getAttribute("data-course-type") == "individual" &&
                    document.getElementById("location_id").getAttribute("data-location-max-individuals") != "" &&
                    document.getElementById("location_id").getAttribute("data-location-max-individuals") != null &&
                    parseInt(document.getElementById("location_id").getAttribute("data-location-max-individuals")) < parseInt(document.getElementById("course_id").getAttribute("data-course-max-individuals"))) {
                    newSlotModal.querySelector('#slot_status_message .status_location').innerHTML = ", lokalen medger max " + document.getElementById("location_id").getAttribute("data-location-max-individuals") + " personer"
                }
                else {
                    newSlotModal.querySelector('#slot_status_message .status_location').innerHTML = ""
                }
            })
        })
        document.getElementById("location_id").addEventListener("change", function(event) {
            console.log(event.target.value)
            fetch(`/api/instructor/location/${event.target.value}`)
            .then(response => response.json())
            .then(data => {
                console.log(data)
                if (data.success) {
                    document.getElementById("location_id").setAttribute("data-location-max-individuals", data.location.max_individuals ? data.location.max_individuals : "")
                }
                if (document.getElementById("course_id").getAttribute("data-course-type") == "individual" &&
                    document.getElementById("location_id").getAttribute("data-location-max-individuals") != "" &&
                    document.getElementById("location_id").getAttribute("data-location-max-individuals") != null &&
                    parseInt(document.getElementById("location_id").getAttribute("data-location-max-individuals")) < parseInt(document.getElementById("course_id").getAttribute("data-course-max-individuals"))) {
                        newSlotModal.querySelector('#slot_status_message .status_location').innerHTML = ", lokalen medger max " + document.getElementById("location_id").getAttribute("data-location-max-individuals") + " personer"
                }
                else {
                    newSlotModal.querySelector('#slot_status_message .status_location').innerHTML = ""
                }
            })
        })
        document.getElementById("slot_new_slot").addEventListener("click", function(event) {
            const slots_container = document.getElementById("slot_times")
            const slots_current = slots_container.querySelectorAll("div.slot")
            const template = document.getElementById("slot_template").cloneNode(true)
            const new_slot = slots_container.appendChild(template)
            new_slot.setAttribute("id", "slot_" + (slots_current.length + 1))
            /* new_slot.querySelectorAll("label").forEach((e) => {
                e.setAttribute("for", e.getAttribute("for") + (slots_current.length + 1))
            }); */
            new_slot.querySelectorAll("input.form-control").forEach((e) => {
                e.setAttribute("id", e.getAttribute("id") + (slots_current.length + 1))
                e.setAttribute("name", e.getAttribute("name") + (slots_current.length + 1))
                e.setAttribute("required", "")
            })
            new_slot.querySelectorAll("button").forEach((e) => {
                e.setAttribute("id", e.getAttribute("id") + (slots_current.length + 1))
                e.setAttribute("data-slot", "slot_" + (slots_current.length + 1))
                document.getElementById(e.getAttribute("id")).addEventListener("click", function (event) {
                    if (window.confirm("Vill du verkligen radera tiden?")) {
                        const removed_slot_e = document.getElementById(document.getElementById(event.target.id).getAttribute("data-slot"))
                        removed_slot_e.remove()
                        slots_container.querySelectorAll("div.slot").forEach((slot, index) => {
                            slot.setAttribute("id", "slot_" + (index + 1))
                            slot.querySelectorAll("input.form-control").forEach((slot_input) => {
                                slot_input.setAttribute("id", slot_input.getAttribute("id").substr(0, slot_input.getAttribute("id").length - 1) + (index + 1))
                                slot_input.setAttribute("name", slot_input.getAttribute("name").substr(0, slot_input.getAttribute("name").length - 1) + (index + 1))
                            })
                            slot.querySelectorAll("button").forEach((slot_button) => {
                                slot_button.setAttribute("id", slot_button.getAttribute("id").substr(0, slot_button.getAttribute("id").length - 1) + (index + 1))
                                slot_button.setAttribute("data-slot", "slot_" + (index + 1))
                            })
                        })
                    }
                })
            })
            new_slot.querySelector("input.form-control[type='date']").setAttribute("value", slots_container.querySelector("#slot_date_" + (slots_current.length)).value)
            new_slot.classList.remove("slot_template")
            new_slot.classList.add("slot")
            new_slot.classList.add("d-flex")
        })
    })

    /* The new slot form is submitted, NOTE: needs to be rewritten if we should use spinner on button */
    /* newSlotForm && newSlotForm.addEventListener("submit", event => {
        console.log("Should start spinner in button, but we post to real server action.")
    }) */

    /* The Edit Slot Modal is shown */
    editSlotModal && editSlotModal.addEventListener('show.bs.modal', event => {
        const button = event.relatedTarget
        const slot_id = button.getAttribute('data-bs-slot-id')
        editSlotModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        editSlotModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        
        fetch(`/api/instructor/slot/${slot_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
            editSlotModal.querySelector('#e_slot_id').value = data.id
            editSlotModal.querySelector('#e_course_id').value = data.course_id
            editSlotModal.querySelector('#e_instructor_id').value = data.instructor_id
            editSlotModal.querySelector('#e_location_id').value = data.location_id
            editSlotModal.querySelector('#e_slot_date').value = data.shortcut.start_date
            editSlotModal.querySelector('#e_slot_time_start').value = data.shortcut.start_time
            editSlotModal.querySelector('#e_slot_time_end').value = data.shortcut.end_time
            if (editSlotModal.querySelector('#reservations')) {
                editSlotModal.querySelector('#reservations').replaceChildren()
                if (data.reservations && data.reservations.length) {
                    data.reservations.forEach(reservation => {
                        const r = editSlotModal.querySelector('#reservations').appendChild(document.createElement('div'))
                        if (reservation.is_group) {
                            r.innerText = reservation.canvas_group_name + " (" + reservation.canvas_user_name + "), " + reservation.created_at.substring(0, 10);
                        }
                        else {
                            r.innerText = reservation.canvas_user_name + ", " + reservation.created_at.substring(0, 10)
                        }
                    })
    
                    if (editSlotModal.querySelector('#editSlotWarning').classList.contains("d-none")) {
                        editSlotModal.querySelector('#editSlotWarning').classList.remove("d-none")
                        editSlotModal.querySelector('#editSlotWarning').classList.add("d-block")
                    }
                }
                else {
                    const r = editSlotModal.querySelector('#reservations').appendChild(document.createElement('div'))
                    r.innerText = editSlotModal.querySelector('#reservations').getAttribute("data-default-text")
    
                    if (editSlotModal.querySelector('#editSlotWarning').classList.contains("d-block")) {
                        editSlotModal.querySelector('#editSlotWarning').classList.remove("d-block")
                        editSlotModal.querySelector('#editSlotWarning').classList.add("d-none")
                    }
                }
            }
            else {
                if (data.reservations && data.reservations.length) {
                    if (editSlotModal.querySelector('#editSlotWarning').classList.contains("d-none")) {
                        editSlotModal.querySelector('#editSlotWarning').classList.remove("d-none")
                        editSlotModal.querySelector('#editSlotWarning').classList.add("d-block")
                    }
                }
                else {
                    if (editSlotModal.querySelector('#editSlotWarning').classList.contains("d-block")) {
                        editSlotModal.querySelector('#editSlotWarning').classList.remove("d-block")
                        editSlotModal.querySelector('#editSlotWarning').classList.add("d-none")
                    }
                }
            }
        })
        .then(finished => {
            editSlotModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            editSlotModal.querySelector('div.modal-body.loaded-content').style.display = "block"    
        })
        if (editSlotModal.querySelector('#editSlotError').classList.contains("d-block")) {
            editSlotModal.querySelector('#editSlotError').classList.remove("d-block")
            editSlotModal.querySelector('#editSlotError').classList.add("d-none")
        }
    });

    /* The Edit Slot Modal Form is submitted */
    editSlotForm && editSlotForm.addEventListener("submit", function(event) {
        const submitButton = editSlotForm.querySelector('#editSlotSaveButton')
        const submitSpinner = submitButton.querySelector('span.spinner-border')
        submitButton.disabled = true
        submitSpinner.style.display = "inline-block"

        const requestOptions = {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                course_id: editSlotModal.querySelector('#e_course_id').value,
                instructor_id: editSlotModal.querySelector('#e_instructor_id').value,
                location_id: editSlotModal.querySelector('#e_location_id').value,
                time_start: editSlotModal.querySelector('#e_slot_date').value + "T" + editSlotModal.querySelector('#e_slot_time_start').value,
                time_end: editSlotModal.querySelector('#e_slot_date').value + "T" + editSlotModal.querySelector('#e_slot_time_end').value
            })
        };

        console.log(requestOptions);

        const slot_id = editSlotModal.querySelector('#e_slot_id').value

        fetch(`/api/instructor/slot/${slot_id}`, requestOptions)
        .then(response => {
            return response.text();
        })
        .then(data => { 
            console.log(data)
            const responseBody = JSON.parse(data)
            if (responseBody.success) {
                window.location.assign("/")
            }
            else {
                console.error(JSON.parse(data).message)
                editSlotModal.querySelector('#editSlotError .alert span').innerText = JSON.parse(data).message
                editSlotModal.querySelector('#editSlotError').classList.remove("d-none")
                editSlotModal.querySelector('#editSlotError').classList.add("d-block")
                submitButton.disabled = true
                submitSpinner.style.display = "none"
            }
        });
        
        event.preventDefault();
        event.stopPropagation();
    });

    /* The Delete Slot Modal is shown */
    deleteSlotModal && deleteSlotModal.addEventListener('show.bs.modal', event => {
        const button = event.relatedTarget
        const slot_id = button.getAttribute('data-bs-slot-id')

        deleteSlotModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        deleteSlotModal.querySelector('div.modal-body.loaded-content').style.display = "none"

        fetch(`/api/instructor/slot/${slot_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
            deleteSlotModal.querySelector('#d_slot_id').value = data.id
            deleteSlotModal.querySelector('#d_course_name').innerText = data.course_name
            deleteSlotModal.querySelector('#d_instructor_name').innerText = data.instructor_name
            deleteSlotModal.querySelector('#d_location_name').innerText = data.location_name
            deleteSlotModal.querySelector('#d_slot_time').innerText = data.shortcut.start_date + " kl " + data.shortcut.start_time + "-" + data.shortcut.end_time
            deleteSlotModal.querySelector('#reservations').replaceChildren()
            if (data.reservations && data.reservations.length) {
                data.reservations.forEach(reservation => {
                    const r = deleteSlotModal.querySelector('#reservations').appendChild(document.createElement('div'))
                    if (reservation.is_group) {
                        r.innerText = reservation.canvas_group_name + " (" + reservation.canvas_user_name + "), " + reservation.created_at.substring(0, 10);
                    }
                    else {
                        r.innerText = reservation.canvas_user_name + ", " + reservation.created_at.substring(0, 10)
                    }
                })

                if (deleteSlotModal.querySelector('#deleteSlotWarning').classList.contains("d-none")) {
                    deleteSlotModal.querySelector('#deleteSlotWarning').classList.remove("d-none")
                    deleteSlotModal.querySelector('#deleteSlotWarning').classList.add("d-block")
                }
            }
            else {
                const r = deleteSlotModal.querySelector('#reservations').appendChild(document.createElement('div'))
                r.innerText = deleteSlotModal.querySelector('#reservations').getAttribute("data-default-text")

                if (deleteSlotModal.querySelector('#deleteSlotWarning').classList.contains("d-block")) {
                    deleteSlotModal.querySelector('#deleteSlotWarning').classList.remove("d-block")
                    deleteSlotModal.querySelector('#deleteSlotWarning').classList.add("d-none")
                }
            }
        })
        .then(finished => {
            deleteSlotModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            deleteSlotModal.querySelector('div.modal-body.loaded-content').style.display = "block"    
        })
        if(deleteSlotModal.querySelector('#deleteSlotError').classList.contains("d-block")) {
            deleteSlotModal.querySelector('#deleteSlotError').classList.remove("d-block")
            deleteSlotModal.querySelector('#deleteSlotError').classList.add("d-none")
        }
    });

    /* The Delete Slot Modal Form is submitted */
    deleteSlotForm && deleteSlotForm.addEventListener("submit", function(event) {
        const submitButton = deleteSlotForm.querySelector('#deleteSlotDeleteButton')
        const submitSpinner = deleteSlotForm.querySelector('span.spinner-border')
        submitButton.disabled = true
        submitSpinner.style.display = "inline-block"

        const requestOptions = {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        };

        console.log(requestOptions);

        const slot_id = deleteSlotModal.querySelector('#d_slot_id').value

        fetch(`/api/instructor/slot/${slot_id}`, requestOptions)
        .then(response => {
            return response.text();
        })
        .then(data => { 
            console.log(data)
            const responseBody = JSON.parse(data)
            if (responseBody.success) {
                window.location.assign("/")
            }
            else {
                console.error(JSON.parse(data).message)
                deleteSlotModal.querySelector('#deleteSlotError .alert span').innerText = JSON.parse(data).message
                deleteSlotModal.querySelector('#deleteSlotError').classList.remove("d-none")
                deleteSlotModal.querySelector('#deleteSlotError').classList.add("d-block")
                submitButton.disabled = true
                submitSpinner.style.display = "inline-block"
            }
        });
        
        event.preventDefault();
        event.stopPropagation();
    });

    /* Disables form submission if validation fails */
    (() => {
        'use strict'
        
        // Fetch all the forms we want to apply custom Bootstrap validation styles to
        const forms = document.querySelectorAll('.needs-validation')
        
        // Loop over them and prevent submission
        Array.from(forms).forEach(form => {
            form.addEventListener('submit', event => {
            if (!form.checkValidity()) {
                event.preventDefault()
                event.stopPropagation()
                console.error("checkValidity: preventDefault & stopPropagation")
            }
        
            form.classList.add('was-validated')
            }, false)
        })
    })()
    
});

