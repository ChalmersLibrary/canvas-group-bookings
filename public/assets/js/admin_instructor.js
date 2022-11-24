document.addEventListener("DOMContentLoaded", function(event) {
    const newInstructorModal = document.getElementById("newInstructor")
    const newInstructorForm = document.getElementById("newInstructorForm")
    const editInstructorModal = document.getElementById("editInstructor")
    const editInstructorForm = document.getElementById("editInstructorForm")
    const deleteInstructorModal = document.getElementById("deleteInstructor")
    const deleteInstructorForm = document.getElementById("deleteInstructorForm")

    /* The modal for new Instructor is shown, load users into select */
    newInstructorModal && newInstructorModal.addEventListener("show.bs.modal", function(event) {
        newInstructorModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        newInstructorModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        fetch("/api/admin/instructor")
        .then(response => response.json())
        .then(data => {
            console.log(data)
            if (data.canvas_instructors && data.canvas_instructors.filter(ci => ci.mapped_to_canvas_course == false).length) {
                newInstructorModal.querySelector('#n_instructor_canvas_id').replaceChildren()
                data.canvas_instructors.filter(ci => ci.mapped_to_canvas_course == false).forEach((i, key) => {
                    document.getElementById('n_instructor_canvas_id')[key] = new Option(i.name, i.id)
                })
            }
            else {
                newInstructorModal.querySelector('#n_instructor_addPart').style.display = "none"
                newInstructorModal.querySelector('#n_instructor_all_addedPart').style.display = "block"
                newInstructorModal.querySelector('#newInstructorSaveButton').disabled = true
            }
        })
        .then(finished => {
            newInstructorModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            newInstructorModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
    })

    /* The New Course Form is submitted */
    newInstructorForm && newInstructorForm.addEventListener("submit", function(event) {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                segment_id: newInstructorForm.querySelector('#n_segment').value ? newInstructorForm.querySelector('#n_segment').value : null,
                name: newInstructorForm.querySelector('#n_name').value,
                description: newInstructorForm.querySelector('#n_description').value,
                is_group: newInstructorForm.querySelector('#n_type_is_group').checked ? true : false,
                is_individual: newInstructorForm.querySelector('#n_type_is_individual').checked ? true : false,
                max_groups: newInstructorForm.querySelector('#n_type_is_group').checked ? newInstructorForm.querySelector('#n_max_number').value : null,
                max_individuals: newInstructorForm.querySelector('#n_type_is_individual').checked ? newInstructorForm.querySelector('#n_max_number').value : null,
                max_per_type: newInstructorForm.querySelector('#n_max_per_type').value,
                default_slot_duration_minutes: newInstructorForm.querySelector('#n_default_slot_duration_minutes').value,
                cancellation_policy_hours: newInstructorForm.querySelector('#n_cancellation_policy_hours').value,
                message_is_mandatory: newInstructorForm.querySelector('#n_message_is_mandatory').checked ? true : false,
                message_all_when_full: newInstructorForm.querySelector('#n_message_all_when_full').checked ? true : false,
                message_cc_instructor: newInstructorForm.querySelector('#n_message_cc_instructor').checked ? true : false,
                message_confirmation_body: newInstructorForm.querySelector('#n_message_confirmation_body').value,
                message_full_body: newInstructorForm.querySelector('#n_message_full_body').value,
                message_cancelled_body: newInstructorForm.querySelector('#n_message_cancelled_body').value
            })
        }

        console.log(requestOptions)

        fetch("/api/admin/course", requestOptions)
        .then(response => {
            return response.text()
        })
        .then(data => { 
            console.log(data)
            const responseBody = JSON.parse(data)
            if (responseBody.success === false) {
                newInstructorModal.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                newInstructorModal.querySelector('div.alert.alert-error').style.display = "block"
            }
            else {
                window.location.assign("/admin/course")
            }
        })
        
        event.preventDefault()
        event.stopPropagation()
    })

    /* The modal for editing a Course is shown */
    editInstructorModal && editInstructorModal.addEventListener('show.bs.modal', event => {
        editInstructorModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        editInstructorModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        const button = event.relatedTarget
        const course_id = button.getAttribute('data-bs-course-id')
        fetch(`/api/admin/course/${course_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
            bootstrap.Tab.getInstance(editInstructorModal.querySelector('#editInstructorTab li:first-child button')).show()
            editInstructorModal.querySelector('#e_message_all_when_full').addEventListener('change', e => {
                e.target.checked == true ? editInstructorModal.querySelector('#e_message_full_bodyPart').style.display = 'block' : editInstructorModal.querySelector('#e_message_full_bodyPart').style.display = 'none'
            })
            editInstructorModal.querySelector('#e_message_template_vars').replaceChildren()
            data.template_vars.forEach(v => {
                this_row = document.getElementById('e_message_template_vars').insertRow()
                this_cell_name = this_row.insertCell()
                this_cell_desc = this_row.insertCell()
                this_cell_name.innerHTML = "{{" + v.name + "}}"
                this_cell_desc.innerHTML = v.description
            })
            editInstructorModal.querySelector('#e_course_id').value = data.course.id
            editInstructorModal.querySelector('#e_canvas_course_id').value = data.course.canvas_course_id
            editInstructorModal.querySelector('#e_name').value = data.course.name
            editInstructorModal.querySelector('#e_description').innerHTML = data.course.description
            editInstructorModal.querySelector('#e_type_is_group').checked = data.course.is_group
            editInstructorModal.querySelector('#e_type_is_individual').checked = data.course.is_individual
            editInstructorModal.querySelector('#e_max_number').value = data.course.is_group ? data.course.max_groups : data.course.max_individuals
            editInstructorModal.querySelector('#e_max_per_type').value = data.course.max_per_type
            editInstructorModal.querySelector('#e_cancellation_policy_hours').value = data.course.cancellation_policy_hours
            editInstructorModal.querySelector('#e_default_slot_duration_minutes').value = data.course.default_slot_duration_minutes
            editInstructorModal.querySelector('#e_message_is_mandatory').checked = data.course.message_is_mandatory ? true : null
            editInstructorModal.querySelector('#e_message_all_when_full').checked = data.course.message_all_when_full ? true : null
            editInstructorModal.querySelector('#e_message_all_when_full').checked == true ? editInstructorModal.querySelector('#e_message_full_bodyPart').style.display = 'block' : editInstructorModal.querySelector('#e_message_full_bodyPart').style.display = 'none'
            editInstructorModal.querySelector('#e_message_cc_instructor').checked = data.course.message_cc_instructor ? true : null
            /* these parts should copy from template or not if empty in db, that is a question */
            editInstructorModal.querySelector('#e_message_confirmation_body').innerHTML = data.course.message_confirmation_body != null ? data.course.message_confirmation_body : null
            editInstructorModal.querySelector('#e_message_cancelled_body').innerHTML = data.course.message_cancelled_body != null ? data.course.message_cancelled_body : null
            editInstructorModal.querySelector('#e_message_full_body').innerHTML = data.course.message_full_body != null ? data.course.message_full_body : null
            if (data.segments && data.segments.length) {
                editInstructorModal.querySelector('#e_segment').replaceChildren()
                data.segments.forEach((s, key) => {
                    document.getElementById('e_segment')[key] = new Option(s.name, s.id, s.id == data.course.segment_id ? true : false, s.id == data.course.segment_id ? true : false)
                })
            }
            else {
                editInstructorModal.querySelector('#e_segmentPart').classList.add('d-none')
            }
        })
        .then(finished => {
            editInstructorModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            editInstructorModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
    })

    /* The Edit Course Form is submitted */
    editInstructorForm && editInstructorForm.addEventListener("submit", function(event) {
        const requestOptions = {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                segment_id: editInstructorForm.querySelector('#e_segment').value ? editInstructorForm.querySelector('#e_segment').value : null,
                name: editInstructorForm.querySelector('#e_name').value,
                description: editInstructorForm.querySelector('#e_description').value,
                is_group: editInstructorForm.querySelector('#e_type_is_group').checked ? true : false,
                is_individual: editInstructorForm.querySelector('#e_type_is_individual').checked ? true : false,
                max_groups: editInstructorForm.querySelector('#e_type_is_group').checked ? editInstructorForm.querySelector('#e_max_number').value : null,
                max_individuals: editInstructorForm.querySelector('#e_type_is_individual').checked ? editInstructorForm.querySelector('#e_max_number').value : null,
                max_per_type: editInstructorForm.querySelector('#e_max_per_type').value,
                default_slot_duration_minutes: editInstructorForm.querySelector('#e_default_slot_duration_minutes').value,
                cancellation_policy_hours: editInstructorForm.querySelector('#e_cancellation_policy_hours').value,
                message_is_mandatory: editInstructorForm.querySelector('#e_message_is_mandatory').checked ? true : false,
                message_all_when_full: editInstructorForm.querySelector('#e_message_all_when_full').checked ? true : false,
                message_cc_instructor: editInstructorForm.querySelector('#e_message_cc_instructor').checked ? true : false,
                message_confirmation_body: editInstructorForm.querySelector('#e_message_confirmation_body').value,
                message_full_body: editInstructorForm.querySelector('#e_message_full_body').value,
                message_cancelled_body: editInstructorForm.querySelector('#e_message_cancelled_body').value
            })
        }

        console.log(requestOptions)

        const course_id = editInstructorForm.querySelector('#e_course_id').value

        fetch(`/api/admin/course/${course_id}`, requestOptions)
        .then(response => {
            return response.text()
        })
        .then(data => { 
            console.log(data)
            const responseBody = JSON.parse(data)
            if (responseBody.success === false) {
                editInstructorModal.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                editInstructorModal.querySelector('div.alert.alert-error').style.display = "block"
            }
            else {
                window.location.assign("/admin/course")
            }
        })
        
        event.preventDefault()
        event.stopPropagation()
    })
})
