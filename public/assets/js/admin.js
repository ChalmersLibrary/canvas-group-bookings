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
        })
    });

});
