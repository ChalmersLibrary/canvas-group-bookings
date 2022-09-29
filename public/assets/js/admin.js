document.addEventListener("DOMContentLoaded", function(event) {
    document.getElementById("newSlotForm").addEventListener("submit", function(event) {
        console.log(event);
        console.log("Time to submit the form: newSlotForm");

        /* event.preventDefault();
        event.stopPropagation(); */
    });

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
        fetch(`/api/admin/slot/${slot_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
            editSlotModal.querySelector('#e_slot_id').value = data.id
            editSlotModal.querySelector('#e_course_id').value = data.course_id
            editSlotModal.querySelector('#e_instructor_id').value = data.instructor_id
            editSlotModal.querySelector('#e_location_id').value = data.location_id
            editSlotModal.querySelector('#e_slot_time_start').value = data.time_start.slice(0, -8)
            editSlotModal.querySelector('#e_slot_time_end').value = data.time_end.slice(0, -8)
            editSlotModal.querySelector('#reservations').replaceChildren()
            data.reservations.forEach(reservation => {
                const r = editSlotModal.querySelector('#reservations').appendChild(document.createElement('div'))
                r.innerText = reservation.created_at
                console.log(reservation)
            })
        })
        if(editSlotModal.querySelector('#editSlotError').classList.contains("d-block")) {
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
                time_start: editSlotModal.querySelector('#e_slot_time_start').value,
                time_end: editSlotModal.querySelector('#e_slot_time_end').value
            })
        };

        console.log(requestOptions);

        const slot_id = editSlotModal.querySelector('#e_slot_id').value

        fetch(`/api/admin/slot/${slot_id}`, requestOptions)
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

    document.getElementById("slot_new_slot").addEventListener("click", function(event) {
        const slots_container = document.getElementById("slots");
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

