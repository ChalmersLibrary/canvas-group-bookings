document.addEventListener("DOMContentLoaded", function(event) {
    const newCourseModal = document.getElementById("newCourse")
    const newCourseForm = document.getElementById("newCourseForm")
    const editCourseModal = document.getElementById("editCourse")
    const editCourseForm = document.getElementById("editCourseForm")
    const deleteCourseModal = document.getElementById("deleteCourse")
    const deleteCourseForm = document.getElementById("deleteCourseForm")

    /* The modal for new Course is shown */
    newCourseModal && newCourseModal.addEventListener("show.bs.modal", function(event) {
        newCourseModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        newCourseModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        fetch("/api/admin/course/")
        .then(response => response.json())
        .then(data => {
            console.log(data)
            bootstrap.Tab.getInstance(newCourseModal.querySelector('#newCourseTab li:first-child button')).show()
            newCourseModal.querySelector('#n_message_all_when_full').addEventListener('change', e => {
                e.target.checked == true ? newCourseModal.querySelector('#n_message_full_bodyPart').style.display = 'block' : newCourseModal.querySelector('#n_message_full_bodyPart').style.display = 'none'
            })
            newCourseModal.querySelector('#n_message_template_vars').replaceChildren()
            data.template_vars.forEach(v => {
                this_row = document.getElementById('n_message_template_vars').insertRow()
                this_cell_name = this_row.insertCell()
                this_cell_desc = this_row.insertCell()
                this_cell_name.innerHTML = "{{" + v.name + "}}"
                this_cell_desc.innerHTML = v.description
            })
            if (data.segments && data.segments.length) {
                newCourseModal.querySelector('#n_segment').replaceChildren()
                data.segments.forEach((s, key) => {
                    document.getElementById('n_segment')[key] = new Option(s.name, s.id)
                })
            }
            else {
                newCourseModal.querySelector('#n_segmentPart').classList.add('d-none')
            }
        })
        .then(finished => {
            newCourseModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            newCourseModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
    })

    /* The New Course Form is submitted */
    newCourseForm && newCourseForm.addEventListener("submit", function(event) {
        if (!newCourseForm.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            newCourseForm.classList.add('was-validated')
        }
        else {
            const submitButton = newCourseForm.querySelector('#newCourseSaveButton')
            const submitSpinner = submitButton.querySelector('span.spinner-border')
            submitButton.disabled = true
            submitSpinner.style.display = "inline-block"

            const requestOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segment_id: newCourseForm.querySelector('#n_segment').value ? newCourseForm.querySelector('#n_segment').value : null,
                    name: newCourseForm.querySelector('#n_name').value,
                    description: newCourseForm.querySelector('#n_description').value,
                    is_group: newCourseForm.querySelector('#n_type_is_group').checked ? true : false,
                    is_individual: newCourseForm.querySelector('#n_type_is_individual').checked ? true : false,
                    max_groups: newCourseForm.querySelector('#n_type_is_group').checked ? newCourseForm.querySelector('#n_max_number').value : null,
                    max_individuals: newCourseForm.querySelector('#n_type_is_individual').checked ? newCourseForm.querySelector('#n_max_number').value : null,
                    max_per_type: newCourseForm.querySelector('#n_max_per_type').value,
                    default_slot_duration_minutes: newCourseForm.querySelector('#n_default_slot_duration_minutes').value,
                    cancellation_policy_hours: newCourseForm.querySelector('#n_cancellation_policy_hours').value,
                    message_is_mandatory: newCourseForm.querySelector('#n_message_is_mandatory').checked ? true : false,
                    message_all_when_full: newCourseForm.querySelector('#n_message_all_when_full').checked ? true : false,
                    message_cc_instructor: newCourseForm.querySelector('#n_message_cc_instructor').checked ? true : false,
                    message_confirmation_body: newCourseForm.querySelector('#n_message_confirmation_body').value,
                    message_full_body: newCourseForm.querySelector('#n_message_full_body').value,
                    message_cancelled_body: newCourseForm.querySelector('#n_message_cancelled_body').value
                })
            }
    
            console.log(requestOptions)
    
            fetch("/api/admin/course", requestOptions)
            .then(response => {
                return response.text()
            })
            .then(data => { 
                console.log(data)
                try {
                    const responseBody = JSON.parse(data)
                    if (responseBody.success) {
                        window.location.assign("/admin/course")
                    }
                    else {
                        newCourseModal.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                        newCourseModal.querySelector('div.alert.alert-error').style.display = "block"
                        submitButton.disabled = false
                        submitSpinner.style.display = "none"
                    } 
                }
                catch (error) {
                    newCourseModal.querySelector('div.alert.alert-error span').innerText = error.message
                    newCourseModal.querySelector('div.alert.alert-error').style.display = "block"
                    submitButton.disabled = false
                    submitSpinner.style.display = "none"
                }
            })
            
            event.preventDefault()
            event.stopPropagation()
        }
    })

    /* The modal for editing a Course is shown */
    editCourseModal && editCourseModal.addEventListener('show.bs.modal', event => {
        editCourseModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        editCourseModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        const button = event.relatedTarget
        const course_id = button.getAttribute('data-bs-course-id')
        fetch(`/api/admin/course/${course_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
            bootstrap.Tab.getInstance(editCourseModal.querySelector('#editCourseTab li:first-child button')).show()
            editCourseModal.querySelector('#e_message_all_when_full').addEventListener('change', e => {
                e.target.checked == true ? editCourseModal.querySelector('#e_message_full_bodyPart').style.display = 'block' : editCourseModal.querySelector('#e_message_full_bodyPart').style.display = 'none'
            })
            editCourseModal.querySelector('#e_message_template_vars').replaceChildren()
            data.template_vars.forEach(v => {
                this_row = document.getElementById('e_message_template_vars').insertRow()
                this_cell_name = this_row.insertCell()
                this_cell_desc = this_row.insertCell()
                this_cell_name.innerHTML = "{{" + v.name + "}}"
                this_cell_desc.innerHTML = v.description
            })
            editCourseModal.querySelector('#e_course_id').value = data.course.id
            editCourseModal.querySelector('#e_canvas_course_id').value = data.course.canvas_course_id
            editCourseModal.querySelector('#e_name').value = data.course.name
            editCourseModal.querySelector('#e_description').innerHTML = data.course.description
            editCourseModal.querySelector('#e_type_is_group').checked = data.course.is_group
            editCourseModal.querySelector('#e_type_is_individual').checked = data.course.is_individual
            editCourseModal.querySelector('#e_max_number').value = data.course.is_group ? data.course.max_groups : data.course.max_individuals
            editCourseModal.querySelector('#e_max_per_type').value = data.course.max_per_type
            editCourseModal.querySelector('#e_cancellation_policy_hours').value = data.course.cancellation_policy_hours
            editCourseModal.querySelector('#e_default_slot_duration_minutes').value = data.course.default_slot_duration_minutes
            editCourseModal.querySelector('#e_message_is_mandatory').checked = data.course.message_is_mandatory ? true : null
            editCourseModal.querySelector('#e_message_all_when_full').checked = data.course.message_all_when_full ? true : null
            editCourseModal.querySelector('#e_message_all_when_full').checked == true ? editCourseModal.querySelector('#e_message_full_bodyPart').style.display = 'block' : editCourseModal.querySelector('#e_message_full_bodyPart').style.display = 'none'
            editCourseModal.querySelector('#e_message_cc_instructor').checked = data.course.message_cc_instructor ? true : null
            /* these parts should copy from template or not if empty in db, that is a question */
            editCourseModal.querySelector('#e_message_confirmation_body').innerHTML = data.course.message_confirmation_body != null ? data.course.message_confirmation_body : null
            editCourseModal.querySelector('#e_message_cancelled_body').innerHTML = data.course.message_cancelled_body != null ? data.course.message_cancelled_body : null
            editCourseModal.querySelector('#e_message_full_body').innerHTML = data.course.message_full_body != null ? data.course.message_full_body : null
            if (data.segments && data.segments.length) {
                editCourseModal.querySelector('#e_segment').replaceChildren()
                data.segments.forEach((s, key) => {
                    document.getElementById('e_segment')[key] = new Option(s.name, s.id, s.id == data.course.segment_id ? true : false, s.id == data.course.segment_id ? true : false)
                })
            }
            else {
                editCourseModal.querySelector('#e_segmentPart').classList.add('d-none')
            }
        })
        .then(finished => {
            editCourseModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            editCourseModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
    })

    /* The Edit Course Form is submitted */
    editCourseForm && editCourseForm.addEventListener("submit", function(event) {
        if (!editCourseForm.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            editCourseForm.classList.add('was-validated')
        }
        else {
            const submitButton = editCourseForm.querySelector('#editCourseSaveButton')
            const submitSpinner = submitButton.querySelector('span.spinner-border')
            submitButton.disabled = true
            submitSpinner.style.display = "inline-block"

            const requestOptions = {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segment_id: editCourseForm.querySelector('#e_segment').value ? editCourseForm.querySelector('#e_segment').value : null,
                    name: editCourseForm.querySelector('#e_name').value,
                    description: editCourseForm.querySelector('#e_description').value,
                    is_group: editCourseForm.querySelector('#e_type_is_group').checked ? true : false,
                    is_individual: editCourseForm.querySelector('#e_type_is_individual').checked ? true : false,
                    max_groups: editCourseForm.querySelector('#e_type_is_group').checked ? editCourseForm.querySelector('#e_max_number').value : null,
                    max_individuals: editCourseForm.querySelector('#e_type_is_individual').checked ? editCourseForm.querySelector('#e_max_number').value : null,
                    max_per_type: editCourseForm.querySelector('#e_max_per_type').value,
                    default_slot_duration_minutes: editCourseForm.querySelector('#e_default_slot_duration_minutes').value,
                    cancellation_policy_hours: editCourseForm.querySelector('#e_cancellation_policy_hours').value,
                    message_is_mandatory: editCourseForm.querySelector('#e_message_is_mandatory').checked ? true : false,
                    message_all_when_full: editCourseForm.querySelector('#e_message_all_when_full').checked ? true : false,
                    message_cc_instructor: editCourseForm.querySelector('#e_message_cc_instructor').checked ? true : false,
                    message_confirmation_body: editCourseForm.querySelector('#e_message_confirmation_body').value,
                    message_full_body: editCourseForm.querySelector('#e_message_full_body').value,
                    message_cancelled_body: editCourseForm.querySelector('#e_message_cancelled_body').value
                })
            }
    
            console.log(requestOptions)
    
            const course_id = editCourseForm.querySelector('#e_course_id').value
    
            fetch(`/api/admin/course/${course_id}`, requestOptions)
            .then(response => {
                return response.text()
            })
            .then(data => { 
                console.log(data)
                try {
                    const responseBody = JSON.parse(data)
                    if (responseBody.success) {
                        window.location.assign("/admin/course")
                    }
                    else {
                        editCourseModal.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                        editCourseModal.querySelector('div.alert.alert-error').style.display = "block"
                        submitButton.disabled = false
                        submitSpinner.style.display = "none"
                    } 
                }
                catch (error) {
                    editCourseModal.querySelector('div.alert.alert-error span').innerText = error.message
                    editCourseModal.querySelector('div.alert.alert-error').style.display = "block"
                    submitButton.disabled = false
                    submitSpinner.style.display = "none"
                }
            })
            
            event.preventDefault()
            event.stopPropagation()
        }
    })

    /* The delete course modal is shown */
    deleteCourseModal && deleteCourseModal.addEventListener('show.bs.modal', event => {
        deleteCourseModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        deleteCourseModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        const button = event.relatedTarget
        const course_id = button.getAttribute('data-bs-course-id')
        fetch(`/api/admin/course/${course_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
            deleteCourseModal.querySelector('#d_course_id').value = course_id
            deleteCourseModal.querySelector('#d_course_name').innerHTML = data.course.name
            deleteCourseModal.querySelector('#d_course_type').innerHTML = data.course.is_group ? "Gruppbokning" : "Individuell bokning"
            if (data.course.slots > 0) {
                deleteCourseModal.querySelector('div.loaded-content div.course-deletable').style.display = "none"
                deleteCourseModal.querySelector('div.loaded-content div.course-replace').style.display = "block"
                deleteCourseModal.querySelector('#deleteCourseSaveButton').disabled = true
            }
            else {
                deleteCourseModal.querySelector('div.loaded-content div.course-deletable').style.display = "block"
                deleteCourseModal.querySelector('div.loaded-content div.course-replace').style.display = "none"
                deleteCourseModal.querySelector('#deleteCourseSaveButton').disabled = false
            }
        })
        .then(finished => {
            deleteCourseModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            deleteCourseModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
    })

    /* The form for deleting a course is submitted */
    deleteCourseForm && deleteCourseForm.addEventListener("submit", function(event) {
        if (!deleteCourseForm.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            deleteCourseForm.classList.add('was-validated')
        }
        else {
            const submitButton = deleteCourseForm.querySelector('#deleteCourseSaveButton')
            const submitSpinner = submitButton.querySelector('span.spinner-border')
            submitButton.disabled = true
            submitSpinner.style.display = "inline-block"

            const requestOptions = {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' } /*,
                body: JSON.stringify({
                    replace_with_location_id: deleteLocationForm.querySelector('#d_replace_with_location').value
                }) */
            }

            console.log(requestOptions)

            const course_id = deleteCourseForm.querySelector('#d_course_id').value

            fetch(`/api/admin/course/${course_id}`, requestOptions)
            .then(response => {
                return response.text()
            })
            .then(data => { 
                console.log(data)
                try {
                    const responseBody = JSON.parse(data)
                    if (responseBody.success) {
                        window.location.assign("/admin/course")
                    }
                    else {
                        deleteCourseForm.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                        deleteCourseForm.querySelector('div.alert.alert-error').style.display = "block"
                        submitButton.disabled = false
                        submitSpinner.style.display = "none"
                    }  
                }
                catch (error) {
                    if (data.includes("<pre>") && data.match(/<pre>(.*?)<\/pre>/)[1]) {
                        deleteCourseForm.querySelector('div.alert.alert-error span').innerText = error.message + ", " + data.match(/<pre>(.*?)<\/pre>/)[1]
                    }
                    else {
                        deleteCourseForm.querySelector('div.alert.alert-error span').innerText = error.message    
                    }
                    deleteCourseForm.querySelector('div.alert.alert-error').style.display = "block"
                    submitButton.disabled = false
                    submitSpinner.style.display = "none"
                }
                
            })
            
            event.preventDefault()
            event.stopPropagation()
        }
    })
})
