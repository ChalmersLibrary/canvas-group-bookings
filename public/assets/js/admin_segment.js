document.addEventListener("DOMContentLoaded", function(event) {
    const newSegmentModal = document.getElementById("newSegment")
    const newSegmentForm = document.getElementById("newSegmentForm")
    const editSegmentModal = document.getElementById("editSegment")
    const editSegmentForm = document.getElementById("editSegmentForm")
    const deleteSegmentModal = document.getElementById("deleteSegment")
    const deleteSegmentForm = document.getElementById("deleteSegmentForm")

    /* The modal for new Segment is shown */
    newSegmentModal && newSegmentModal.addEventListener("show.bs.modal", function(event) {
        const button = event.relatedTarget
        const existing_segments = button.getAttribute('data-bs-existing-segments')

        if (existing_segments == 0) {
            newSegmentModal.querySelector("div.alert.alert-first-segment").style.display = "block"
        }
        else {
            newSegmentModal.querySelector("div.alert.alert-first-segment").style.display = "none"
        }
    })

    /* The form for new Segment is submitted */
    newSegmentForm && newSegmentForm.addEventListener("submit", function(event) {
        if (!newSegmentForm.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            newSegmentForm.classList.add('was-validated')
        }
        else {
            const submitButton = newSegmentForm.querySelector('#newSegmentSaveButton')
            const submitSpinner = submitButton.querySelector('span.spinner-border')
            submitButton.disabled = true
            submitSpinner.style.display = "inline-block"

            const requestOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newSegmentForm.querySelector('#n_segment_name').value,
                    sign: newSegmentForm.querySelector('#n_segment_sign').value,
                    description: newSegmentForm.querySelector('#n_segment_description').value
                })
            }

            console.log(requestOptions)

            fetch("/api/admin/segment", requestOptions)
            .then(response => {
                return response.text()
            })
            .then(data => { 
                console.log(data)
                try {
                    const responseBody = JSON.parse(data)
                    if (responseBody.success) {
                        window.location.assign("/admin/segment")
                    }
                    else {
                        newSegmentForm.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                        newSegmentForm.querySelector('div.alert.alert-error').style.display = "block"
                        submitButton.disabled = false
                        submitSpinner.style.display = "none"
                    }
                }
                catch (error) {
                    if (data.includes("<pre>") && data.match(/<pre>(.*?)<\/pre>/)[1]) {
                        newSegmentForm.querySelector('div.alert.alert-error span').innerText = error.message + ", " + data.match(/<pre>(.*?)<\/pre>/)[1]
                    }
                    else {
                        newSegmentForm.querySelector('div.alert.alert-error span').innerText = error.message    
                    }
                    newSegmentForm.querySelector('div.alert.alert-error').style.display = "block"
                    submitButton.disabled = false
                    submitSpinner.style.display = "none"
                }
            })
        }
        
        event.preventDefault()
        event.stopPropagation()
    })

    /* The modal for edit Segment is show */
    editSegmentModal && editSegmentModal.addEventListener('show.bs.modal', event => {
        editSegmentModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        editSegmentModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        const button = event.relatedTarget
        const segment_id = button.getAttribute('data-bs-segment-id')
        fetch(`/api/admin/segment/${segment_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
            editSegmentModal.querySelector('#e_segment_id').value = segment_id
            editSegmentModal.querySelector('#e_segment_name').value = data.segment.name
            editSegmentModal.querySelector('#e_segment_sign').value = data.segment.sign
            editSegmentModal.querySelector('#e_segment_description').innerHTML = data.segment.description
        })
        .then(finished => {
            editSegmentModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            editSegmentModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
    })

    /* The Edit Instructor Form is submitted */
    editSegmentForm && editSegmentForm.addEventListener("submit", function(event) {
        if (!editSegmentForm.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            editSegmentForm.classList.add('was-validated')
        }
        else {
            const submitButton = editSegmentForm.querySelector('#editSegmentSaveButton')
            const submitSpinner = submitButton.querySelector('span.spinner-border')
            submitButton.disabled = true
            submitSpinner.style.display = "inline-block"

            const requestOptions = {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editSegmentForm.querySelector('#e_segment_name').value,
                    sign: editSegmentForm.querySelector('#e_segment_sign').value,
                    description: editSegmentForm.querySelector('#e_segment_description').value
                })
            }
    
            console.log(requestOptions)
    
            const segment_id = editSegmentForm.querySelector('#e_segment_id').value
    
            fetch(`/api/admin/segment/${segment_id}`, requestOptions)
            .then(response => {
                return response.text()
            })
            .then(data => { 
                console.log(data)
                try {
                    const responseBody = JSON.parse(data)
                    if (responseBody.success) {
                        window.location.assign("/admin/segment")
                    }
                    else {
                        editSegmentForm.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                        editSegmentForm.querySelector('div.alert.alert-error').style.display = "block"
                        submitButton.disabled = false
                        submitSpinner.style.display = "none"
                    }   
                }
                catch (error) {
                    if (data.includes("<pre>") && data.match(/<pre>(.*?)<\/pre>/)[1]) {
                        editSegmentForm.querySelector('div.alert.alert-error span').innerText = error.message + ", " + data.match(/<pre>(.*?)<\/pre>/)[1]
                    }
                    else {
                        editSegmentForm.querySelector('div.alert.alert-error span').innerText = error.message    
                    }
                    editSegmentForm.querySelector('div.alert.alert-error').style.display = "block"
                    submitButton.disabled = false
                    submitSpinner.style.display = "none"
                }
            })
            
            event.preventDefault()
            event.stopPropagation()    
        }
    })

    /* The delete Segment modal is shown */
    deleteSegmentModal && deleteSegmentModal.addEventListener('show.bs.modal', event => {
        deleteSegmentModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        deleteSegmentModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        const button = event.relatedTarget
        const segment_id = button.getAttribute('data-bs-segment-id')
        fetch(`/api/admin/segment/${segment_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
            deleteSegmentModal.querySelector('#d_segment_id').value = segment_id
            deleteSegmentModal.querySelector('#d_segment_name').innerHTML = data.segment.name
            deleteSegmentModal.querySelector('#d_replace_with_segment').replaceChildren()
            data.course_segments.filter(s => s.id != segment_id).forEach((segment, key) => {
                document.getElementById('d_replace_with_segment')[key] = new Option("Ersätt med " + segment.name, segment.id)
            })
            if (data.segment.courses > 0) {
                if (data.course_segments.filter(s => s.id != segment_id).length == 0) {
                    deleteSegmentModal.querySelector('div.loaded-content div.segment-deletable').style.display = "none"
                    deleteSegmentModal.querySelector('div.loaded-content div.segment-replace').style.display = "none"    
                    deleteSegmentModal.querySelector('div.loaded-content div.segment-delete-final').style.display = "block"
                    document.getElementById('d_replace_with_segment')[0] = new Option("Final segment", segment_id, true, true)
                }
                else {
                    deleteSegmentModal.querySelector('div.loaded-content div.segment-deletable').style.display = "none"
                    deleteSegmentModal.querySelector('div.loaded-content div.segment-replace').style.display = "block"    
                    deleteSegmentModal.querySelector('div.loaded-content div.segment-delete-final').style.display = "none"    
                }
            }
            else {
                deleteSegmentModal.querySelector('div.loaded-content div.segment-deletable').style.display = "block"
                deleteSegmentModal.querySelector('div.loaded-content div.segment-replace').style.display = "none"
                deleteSegmentModal.querySelector('div.loaded-content div.segment-delete-final').style.display = "none"    
            }
        })
        .then(finished => {
            deleteSegmentModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            deleteSegmentModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
    })

    /* The form for deleting/replacing a segment is submitted */
    deleteSegmentForm && deleteSegmentForm.addEventListener("submit", function(event) {
        if (!deleteSegmentForm.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            deleteSegmentForm.classList.add('was-validated')
        }
        else {
            const submitButton = deleteSegmentForm.querySelector('#deleteSegmentSaveButton')
            const submitSpinner = submitButton.querySelector('span.spinner-border')
            submitButton.disabled = true
            submitSpinner.style.display = "inline-block"

            const requestOptions = {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    replace_with_segment_id: deleteSegmentForm.querySelector('#d_replace_with_segment').value
                })
            }

            console.log(requestOptions)

            const segment_id = deleteSegmentForm.querySelector('#d_segment_id').value

            fetch(`/api/admin/segment/${segment_id}`, requestOptions)
            .then(response => {
                return response.text()
            })
            .then(data => { 
                console.log(data)
                try {
                    const responseBody = JSON.parse(data)
                    if (responseBody.success) {
                        window.location.assign("/admin/segment")
                    }
                    else {
                        deleteSegmentForm.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                        deleteSegmentForm.querySelector('div.alert.alert-error').style.display = "block"
                        submitButton.disabled = false
                        submitSpinner.style.display = "none"
                    }  
                }
                catch (error) {
                    if (data.includes("<pre>") && data.match(/<pre>(.*?)<\/pre>/)[1]) {
                        deleteSegmentForm.querySelector('div.alert.alert-error span').innerText = error.message + ", " + data.match(/<pre>(.*?)<\/pre>/)[1]
                    }
                    else {
                        deleteSegmentForm.querySelector('div.alert.alert-error span').innerText = error.message    
                    }
                    deleteSegmentForm.querySelector('div.alert.alert-error').style.display = "block"
                    submitButton.disabled = false
                    submitSpinner.style.display = "none"
                }
                
            })
            
            event.preventDefault()
            event.stopPropagation()
        }
    })
})
