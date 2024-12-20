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
                        if (api_data.all_instructors.map(x => x.canvas_user_id).includes(event.target.selectedOptions[0].value)) {
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
                    if (api_data.all_instructors.map(i => i.canvas_user_id).includes(document.getElementById('n_instructor_canvas_id').value)) {
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
    })

    /* The New Instructor Form is submitted */
    newInstructorForm && newInstructorForm.addEventListener("submit", function(event) {
        if (!newInstructorForm.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            newInstructorForm.classList.add('was-validated')
        }
        else {
            const submitButton = newInstructorForm.querySelector('#newInstructorSaveButton')
            const submitSpinner = submitButton.querySelector('span.spinner-border')
            submitButton.disabled = true
            submitSpinner.style.display = "inline-block"

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
                try {
                    const responseBody = JSON.parse(data)
                    if (responseBody.success) {
                        window.location.assign("/admin/instructor")
                    }
                    else {
                        newInstructorModal.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                        newInstructorModal.querySelector('div.alert.alert-error').style.display = "block"
                        submitButton.disabled = false
                        submitSpinner.style.display = "none"
                    }
                }
                catch (error) {
                    if (data.includes("<pre>") && data.match(/<pre>(.*?)<\/pre>/)[1]) {
                        newInstructorModal.querySelector('div.alert.alert-error span').innerText = error.message + ", " + data.match(/<pre>(.*?)<\/pre>/)[1]
                    }
                    else {
                        newInstructorModal.querySelector('div.alert.alert-error span').innerText = error.message    
                    }
                    newInstructorModal.querySelector('div.alert.alert-error').style.display = "block"
                    submitButton.disabled = false
                    submitSpinner.style.display = "none" 
                }
            })
            
            event.preventDefault()
            event.stopPropagation()
        }
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
            editInstructorForm.querySelector('#e_instructor_id').value = data.instructor.id
            editInstructorForm.querySelector('#e_instructor_name').value = data.instructor.name
            editInstructorForm.querySelector('#e_instructor_email').value = data.instructor.email
            if (data.canvas_instructors.map(x => x.id.toString()).includes(data.instructor.canvas_user_id)) {
                editInstructorForm.querySelector('#e_instructor_name_canvas').value = data.canvas_instructors.find(x => x.id.toString() == data.instructor.canvas_user_id).name
                editInstructorForm.querySelector('#e_instructor_email_canvas').value = data.canvas_instructors.find(x => x.id.toString() == data.instructor.canvas_user_id).email
            }
        })
        .then(finished => {
            editInstructorModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            editInstructorModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
    })

    /* The Edit Instructor Form is submitted */
    editInstructorForm && editInstructorForm.addEventListener("submit", function(event) {
        if (!editInstructorForm.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            editInstructorForm.classList.add('was-validated')
        }
        else {
            const submitButton = editInstructorForm.querySelector('#editInstructorSaveButton')
            const submitSpinner = submitButton.querySelector('span.spinner-border')
            submitButton.disabled = true
            submitSpinner.style.display = "inline-block"

            const requestOptions = {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editInstructorForm.querySelector('#e_instructor_name').value,
                    email: editInstructorForm.querySelector('#e_instructor_email').value
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
                try {
                    const responseBody = JSON.parse(data)
                    if (responseBody.success) {
                        window.location.assign("/admin/instructor")
                    }
                    else {
                        editInstructorModal.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                        editInstructorModal.querySelector('div.alert.alert-error').style.display = "block"
                        submitButton.disabled = false
                        submitSpinner.style.display = "none"
                    } 
                }
                catch (error) {
                    editInstructorModal.querySelector('div.alert.alert-error span').innerText = error.message
                    editInstructorModal.querySelector('div.alert.alert-error').style.display = "block"
                    submitButton.disabled = false
                    submitSpinner.style.display = "none"
                }
                
            })
            
            event.preventDefault()
            event.stopPropagation()
        }
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
            document.getElementById('d_replace_with_instructor')[0] = new Option(document.getElementById('d_replace_with_instructor').getAttribute("data-default-text"), "")
            data.course_instructors.filter(ci => ci.id != instructor_id).forEach((i, key) => {
                document.getElementById('d_replace_with_instructor')[key+1] = new Option(i.name, i.id)
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
        if (!deleteInstructorForm.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            deleteInstructorForm.classList.add('was-validated')
        }
        else {
            const submitButton = deleteInstructorForm.querySelector('#deleteInstructorSaveButton')
            const submitSpinner = submitButton.querySelector('span.spinner-border')
            submitButton.disabled = true
            submitSpinner.style.display = "inline-block"

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
                try {
                    const responseBody = JSON.parse(data)
                    if (responseBody.success) {
                        window.location.assign("/admin/instructor")
                    }
                    else {
                        deleteInstructorForm.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                        deleteInstructorForm.querySelector('div.alert.alert-error').style.display = "block"
                        submitButton.disabled = false
                        submitSpinner.style.display = "none"
                    }
                }
                catch (error) {
                    if (data.includes("<pre>") && data.match(/<pre>(.*?)<\/pre>/)[1]) {
                        deleteInstructorForm.querySelector('div.alert.alert-error span').innerText = error.message + ", " + data.match(/<pre>(.*?)<\/pre>/)[1]
                    }
                    else {
                        deleteInstructorForm.querySelector('div.alert.alert-error span').innerText = error.message    
                    }
                    deleteInstructorForm.querySelector('div.alert.alert-error').style.display = "block"
                    submitButton.disabled = false
                    submitSpinner.style.display = "none"
                }
            })
            
            event.preventDefault()
            event.stopPropagation()
        }
    })
})
