document.addEventListener("DOMContentLoaded", function(event) {
    const editFormCanvas = document.getElementById("editSettingsCanvas")

    /* The form Edit Settings for Canvas is submitted */
    editFormCanvas && editFormCanvas.addEventListener("submit", function(event) {
        const canvas_course_id = editFormCanvas.querySelector('#e_canvas_course_id').value

        const requestOptions = {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                group_category_mapping: Array.from(editFormCanvas.querySelectorAll('#e_group_category_mapping option:checked')).map(el => el.value)
            })
        }

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
        })
        
        event.preventDefault();
        event.stopPropagation();
    })
})
