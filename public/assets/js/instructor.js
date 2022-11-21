document.addEventListener("DOMContentLoaded", function(event) {
    document.getElementById("newSlotForm").addEventListener("submit", function(event) {
        console.log(event);
        console.log("Time to submit the form: newSlotForm");

        /* event.preventDefault();
        event.stopPropagation(); */
    });

    /* Edit Slot constants */
    const editSlotModal = document.getElementById('editSlot')
    const editSlotForm = document.getElementById("editSlotForm")

    /* The Edit Slot Modal is shown */
    editSlotModal.addEventListener('show.bs.modal', event => {
        // Button that triggered the modal
        const button = event.relatedTarget
        // Extract info from data-bs-* attributes
        const slot_id = button.getAttribute('data-bs-slot-id')
        // If necessary, you could initiate an AJAX request here
        // and then do the updating in a callback.
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
        })
        if (editSlotModal.querySelector('#editSlotError').classList.contains("d-block")) {
            editSlotModal.querySelector('#editSlotError').classList.remove("d-block")
            editSlotModal.querySelector('#editSlotError').classList.add("d-none")
        }
    });

    /* The Edit Slot Modal Form is submitted */
    editSlotForm.addEventListener("submit", function(event) {
        console.log(event);
        console.log("Time to submit the form: editSlotForm");

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
            if (responseBody.success === false) {
                console.error(JSON.parse(data).message)
                editSlotModal.querySelector('#editSlotError .alert span').innerText = JSON.parse(data).message
                editSlotModal.querySelector('#editSlotError').classList.remove("d-none")
                editSlotModal.querySelector('#editSlotError').classList.add("d-block")
            }
            else {
                window.location.assign("/")
            }
        });
        
        event.preventDefault();
        event.stopPropagation();
    });

    /* Delete slot constants */
    const deleteSlotModal = document.getElementById('deleteSlot')
    const deleteSlotForm = document.getElementById("deleteSlotForm")

    /* The Delete Slot Modal is shown */
    deleteSlotModal.addEventListener('show.bs.modal', event => {
        // Button that triggered the modal
        const button = event.relatedTarget
        // Extract info from data-bs-* attributes
        const slot_id = button.getAttribute('data-bs-slot-id')
        // If necessary, you could initiate an AJAX request here
        // and then do the updating in a callback.
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
        if(deleteSlotModal.querySelector('#deleteSlotError').classList.contains("d-block")) {
            deleteSlotModal.querySelector('#deleteSlotError').classList.remove("d-block")
            deleteSlotModal.querySelector('#deleteSlotError').classList.add("d-none")
        }
    });

    /* The Delete Slot Modal Form is submitted */

    deleteSlotForm.addEventListener("submit", function(event) {
        console.log(event);
        console.log("Time to submit the form: deleteSlotForm");

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
            if (responseBody.success === false) {
                console.error(JSON.parse(data).message)
                deleteSlotModal.querySelector('#deleteSlotError .alert span').innerText = JSON.parse(data).message
                deleteSlotModal.querySelector('#deleteSlotError').classList.remove("d-none")
                deleteSlotModal.querySelector('#deleteSlotError').classList.add("d-block")
            }
            else {
                window.location.assign("/")
            }
        });
        
        event.preventDefault();
        event.stopPropagation();
    });

    /* The New Slot Form is shown */

    document.getElementById("slot_new_slot").addEventListener("click", function(event) {
        const slots_container = document.getElementById("slot_times");
        const slots_current = slots_container.querySelectorAll("div.slot");
        const template = document.getElementById("slot_template").cloneNode(true);
        const new_slot = slots_container.appendChild(template);
        new_slot.setAttribute("id", "slot_" + (slots_current.length + 1));
        new_slot.querySelectorAll("label").forEach((e) => {
            e.setAttribute("for", e.getAttribute("for") + (slots_current.length + 1));
        });
        new_slot.querySelectorAll("input.form-control").forEach((e) => {
            e.setAttribute("id", e.getAttribute("id") + (slots_current.length + 1));
            e.setAttribute("name", e.getAttribute("name") + (slots_current.length + 1));
        });
        new_slot.querySelector("input.form-control[type='date']").setAttribute("value", slots_container.querySelector("#slot_date_" + (slots_current.length)).value);
        new_slot.classList.remove("slot_template");
        new_slot.classList.add("slot");
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
            }
        
            form.classList.add('was-validated')
            }, false)
        })
    })()
    
});

