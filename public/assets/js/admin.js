document.addEventListener("DOMContentLoaded", function(event) {
    const editFormCanvas = document.getElementById("editSettingsCanvas")
    const editCourseModal = document.getElementById("editCourse")

    /* The form Edit Settings for Canvas is submitted */
    editFormCanvas && editFormCanvas.addEventListener("submit", function(event) {
        const canvas_course_id = editFormCanvas.querySelector('#e_canvas_course_id').value

        const requestOptions = {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                group_category_mapping: Array.from(editFormCanvas.querySelectorAll('#e_group_category_mapping option:checked')).map(el => el.value)
            })
        };

        fetch(`/api/admin/canvas/${canvas_course_id}`, requestOptions)
        .then(response => {
            return response.text();
        })
        .then(data => { 
            const responseBody = JSON.parse(data)
            if (responseBody.success === false) {
                console.error(JSON.parse(data).message)
                editFormCanvas.querySelector('#editFormCanvasError.alert span').innerText = JSON.parse(data).message
                editFormCanvas.querySelector('#editFormCanvasError.alert').classList.remove("d-none")
                editFormCanvas.querySelector('#editFormCanvasError.alert').classList.add("d-block")
            }
            else {
                window.location.assign("/admin/canvas")
            }
        });
        
        event.preventDefault();
        event.stopPropagation();
    });

    /* The modal for editing a Course is shown */
    editCourseModal && editCourseModal.addEventListener('show.bs.modal', event => {
        const button = event.relatedTarget
        const course_id = button.getAttribute('data-bs-course-id')
        fetch(`/api/admin/course/${course_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
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
            editCourseModal.querySelector('#e_message_cc_instructor').checked = data.course.message_cc_instructor ? true : null
            editCourseModal.querySelector('#e_message_confirmation_body').innerHTML = data.course.message_confirmation_body != null ? data.course.message_confirmation_body : data.templates.done
            editCourseModal.querySelector('#e_message_cancelled_body').innerHTML = data.course.message_cancelled_body != null ? data.course.message_cancelled_body : data.templates.cancel
            editCourseModal.querySelector('#e_message_full_body').innerHTML = data.course.message_full_body != null ? data.course.message_full_body : data.templates.full
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
    });

});
