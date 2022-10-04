document.addEventListener("DOMContentLoaded", function(event) {
    const slotFilterCourse = document.getElementById('slotFilterCourse');
    const slots = document.querySelectorAll('#slots tbody tr');

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

    /* Reserve Slot constants */
    const reserveSlotModal = document.getElementById('reserveSlot')
    const reserveSlotForm = document.getElementById("reserveSlotForm")

    /* The Reserve Slot Modal is shown */
    reserveSlotModal.addEventListener('show.bs.modal', event => {
        const button = event.relatedTarget
        const slot_id = button.getAttribute('data-bs-slot-id')
        fetch(`/api/slot/${slot_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
            reserveSlotModal.querySelector('#r_slot_id').value = data.id
            reserveSlotModal.querySelector('#r_message').value = ""
            reserveSlotModal.querySelector('#r_course_name').innerText = data.course_name
            reserveSlotModal.querySelector('#r_instructor_name').innerText = data.instructor_name
            reserveSlotModal.querySelector('#r_location_name').innerText = data.location_name
            reserveSlotModal.querySelector('#r_slot_time').innerText = data.shortcut.start_date + " kl " + data.shortcut.start_time + "--" + data.shortcut.end_time
            reserveSlotModal.querySelector('#reservations').replaceChildren()
            if (data.reservations && data.reservations.length > 0) {
                data.reservations.forEach(reservation => {
                    const r = reserveSlotModal.querySelector('#reservations').appendChild(document.createElement('div'))
                    r.innerText = reservation.created_at
                    reserveSlotModal.querySelector('#reservationsCurrent').classList.remove("d-none")
                    reserveSlotModal.querySelector('#reservationsCurrent').classList.add("d-block")
                    console.log(reservation)
                })
                reserveSlotModal.querySelector('#reserveSlotWarning').classList.remove("d-none")
                reserveSlotModal.querySelector('#reserveSlotWarning').classList.add("d-block")
            }
        })
        if(reserveSlotModal.querySelector('#reserveSlotError').classList.contains("d-block")) {
            reserveSlotModal.querySelector('#reserveSlotError').classList.remove("d-block")
            reserveSlotModal.querySelector('#reserveSlotError').classList.add("d-none")
        }
    });

    /* The Reserve Slot Modal Form is submitted */
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
                    slot_id: reserveSlotModal.querySelector('#r_slot_id').value
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
})
