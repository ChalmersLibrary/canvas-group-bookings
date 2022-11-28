document.addEventListener("DOMContentLoaded", function(event) {
    const newInstructorModal = document.getElementById("newInstructor")
    const newInstructorForm = document.getElementById("newInstructorForm")
    const editInstructorModal = document.getElementById("editInstructor")
    const editInstructorForm = document.getElementById("editInstructorForm")
    const deleteInstructorModal = document.getElementById("deleteInstructor")
    const deleteInstructorForm = document.getElementById("deleteInstructorForm")

    /* The modal for new Instructor is shown, load users into select */
    newInstructorModal && newInstructorModal.addEventListener("show.bs.modal", function(event) {
        let api_data = [];
        newInstructorModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        newInstructorModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        fetch("/api/admin/instructor")
        .then(response => response.json())
        .then(data => {
            console.log(data)
            if (data.success) {
                api_data = data // store the data as we need to reference it
                if (data.canvas_instructors && data.canvas_instructors.filter(ci => ci.mapped_to_canvas_course == false).length) {
                    newInstructorModal.querySelector('#n_instructor_canvas_id').replaceChildren()
                    data.canvas_instructors.filter(ci => ci.mapped_to_canvas_course == false).forEach((i, key) => {
                        document.getElementById('n_instructor_canvas_id')[key] = new Option(i.name, i.id)
                    })
                    document.getElementById('n_instructor_canvas_id').addEventListener("change", function(event) {
                        if (api_data.all_instructors.map(x => x.canvas_user_id).includes(parseInt(event.target.selectedOptions[0].value))) {
                            newInstructorForm.querySelector('#n_instructor_existing_id').value = api_data.all_instructors.filter(x => x.canvas_user_id == event.target.selectedOptions[0].value)[0].id
                        }
                        else {
                            newInstructorForm.querySelector('#n_instructor_existing_id').value = null
                        }
                        newInstructorForm.querySelector('#n_instructor_name').value = api_data.canvas_instructors.filter(x => x.id == event.target.selectedOptions[0].value)[0].name
                        newInstructorForm.querySelector('#n_instructor_email').value = api_data.canvas_instructors.filter(x => x.id == event.target.selectedOptions[0].value)[0].email
                    })
                    newInstructorForm.querySelector('#n_instructor_name').value = api_data.canvas_instructors.filter(x => x.id == document.getElementById('n_instructor_canvas_id').value)[0].name
                    newInstructorForm.querySelector('#n_instructor_email').value = api_data.canvas_instructors.filter(x => x.id == document.getElementById('n_instructor_canvas_id').value)[0].email
                    if (api_data.all_instructors.map(i => i.canvas_user_id).includes(parseInt(document.getElementById('n_instructor_canvas_id').value))) {
                        newInstructorForm.querySelector('#n_instructor_existing_id').value = api_data.all_instructors.filter(x => x.canvas_user_id == document.getElementById('n_instructor_canvas_id').value)[0].id
                    }
                }
                else {
                    newInstructorModal.querySelector('#n_instructor_addPart').style.display = "none"
                    newInstructorModal.querySelector('#n_instructor_all_addedPart').style.display = "block"
                    newInstructorModal.querySelector('#newInstructorSaveButton').disabled = true
                }
                newInstructorModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
                newInstructorModal.querySelector('div.modal-body.loaded-content').style.display = "block"
            }
            else {
                newInstructorModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
                newInstructorModal.querySelector('div.modal-body.content-error').style.display = "block"
                newInstructorModal.querySelector('div.modal-body.content-error span').innerHTML = data.message
                newInstructorModal.querySelector('#newInstructorSaveButton').disabled = true
            }
        })
        .then(finished => {
        })
    })

    /* The New Instructor Form is submitted */
    newInstructorForm && newInstructorForm.addEventListener("submit", function(event) {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                existing_user_id: newInstructorForm.querySelector('#n_instructor_existing_id').value,
                canvas_user_id: newInstructorForm.querySelector('#n_instructor_canvas_id').value,
                name: newInstructorForm.querySelector('#n_instructor_name').value,
                email: newInstructorForm.querySelector('#n_instructor_email').value
            })
        }

        console.log(requestOptions)

        fetch("/api/admin/instructor", requestOptions)
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
                window.location.assign("/admin/instructor")
            }
        })
        
        event.preventDefault()
        event.stopPropagation()
    })

    /* The modal for editing an Instructor is shown */
    editInstructorModal && editInstructorModal.addEventListener('show.bs.modal', event => {
        editInstructorModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        editInstructorModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        const button = event.relatedTarget
        const instructor_id = button.getAttribute('data-bs-instructor-id')
        fetch(`/api/admin/instructor/${instructor_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
        })
        .then(finished => {
            editInstructorModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            editInstructorModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
    })

    /* The Edit Instructor Form is submitted */
    editInstructorForm && editInstructorForm.addEventListener("submit", function(event) {
        const requestOptions = {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            })
        }

        console.log(requestOptions)

        const instructor_id = editInstructorForm.querySelector('#e_instructor_id').value

        fetch(`/api/admin/instructor/${instructor_id}`, requestOptions)
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
                window.location.assign("/admin/instructor")
            }
        })
        
        event.preventDefault()
        event.stopPropagation()
    })

    /* The modal for deleting/replacing an instructor is shown */
    deleteInstructorModal && deleteInstructorModal.addEventListener('show.bs.modal', event => {
        deleteInstructorModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        deleteInstructorModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        const button = event.relatedTarget
        const instructor_id = button.getAttribute('data-bs-instructor-id')
        fetch(`/api/admin/instructor/${instructor_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
            deleteInstructorModal.querySelector('#d_instructor_id').value = instructor_id
            deleteInstructorModal.querySelector('#d_name').innerHTML = data.instructor.name
            deleteInstructorModal.querySelector('#d_email').innerHTML = data.instructor.email
            deleteInstructorModal.querySelector('#d_replace_with_instructor').replaceChildren()
            document.getElementById('d_replace_with_instructor')[0] = new Option("Ingen ersättning", "")
            data.course_instructors.filter(ci => ci.id != instructor_id).forEach((i, key) => {
                document.getElementById('d_replace_with_instructor')[key+1] = new Option("Ersätt med " + i.name, i.id)
            })
            if (data.instructor.slots > 0) {
                deleteInstructorModal.querySelector('div.loaded-content div.instructor-deletable').style.display = "none"
                deleteInstructorModal.querySelector('div.loaded-content div.instructor-replace').style.display = "block"
            }
            else {
                deleteInstructorModal.querySelector('div.loaded-content div.instructor-deletable').style.display = "block"
                deleteInstructorModal.querySelector('div.loaded-content div.instructor-replace').style.display = "none"
            }
        })
        .then(finished => {
            deleteInstructorModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            deleteInstructorModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
    })

    /* The form for deleting/replacing an instructor is submitted */
    deleteInstructorForm && deleteInstructorForm.addEventListener("submit", function(event) {
        const requestOptions = {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                replace_with_instructor_id: deleteInstructorForm.querySelector('#d_replace_with_instructor').value
            })
        }

        console.log(requestOptions)

        const instructor_id = deleteInstructorForm.querySelector('#d_instructor_id').value

        fetch(`/api/admin/instructor/${instructor_id}`, requestOptions)
        .then(response => {
            return response.text()
        })
        .then(data => { 
            console.log(data)
            const responseBody = JSON.parse(data)
            if (responseBody.success === false) {
                deleteInstructorForm.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                deleteInstructorForm.querySelector('div.alert.alert-error').style.display = "block"
            }
            else {
                window.location.assign("/admin/instructor")
            }
        })
        
        event.preventDefault()
        event.stopPropagation()
    })
})
