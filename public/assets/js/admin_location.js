document.addEventListener("DOMContentLoaded", function(event) {
    const newLocationModal = document.getElementById("newLocation")
    const newLocationForm = document.getElementById("newLocationForm")
    const editLocationModal = document.getElementById("editLocation")
    const editLocationForm = document.getElementById("editLocationForm")
    const deleteLocationModal = document.getElementById("deleteLocation")
    const deleteLocationForm = document.getElementById("deleteLocationForm")

    /* The modal for new Location is shown */
    newLocationModal && newLocationModal.addEventListener("show.bs.modal", function(event) {
        let api_data = [];
        newLocationModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        newLocationModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        fetch("/api/admin/location")
        .then(response => response.json())
        .then(data => {
            console.log(data)
            if (data.success) {
                api_data = data // store the data as we need to reference it
                if (data.locations && data.locations.filter(l => l.mapped_to_canvas_course == false).length) {
                    newLocationModal.querySelector('#n_existing_location_id').replaceChildren()
                    document.getElementById('n_existing_location_id')[0] = new Option("Välj...", "", true, true)
                    data.locations.filter(ci => ci.mapped_to_canvas_course == false).forEach((i, key) => {
                        document.getElementById('n_existing_location_id')[key+1] = new Option(i.name, i.id)
                    })
                    document.getElementById('n_existing_location_id').addEventListener("change", function(event) {
                        if (event.target.selectedOptions[0].value != '') {
                            newLocationForm.querySelector('#n_location_name').required = false;
                            newLocationForm.querySelector('#n_disp_location_name').innerHTML = api_data.locations.filter(x => x.id == event.target.selectedOptions[0].value)[0].name
                            newLocationForm.querySelector('#n_disp_location_description').innerHTML = api_data.locations.filter(x => x.id == event.target.selectedOptions[0].value)[0].description
                            newLocationForm.querySelector('#n_disp_location_external_url').innerHTML = api_data.locations.filter(x => x.id == event.target.selectedOptions[0].value)[0].external_url
                            newLocationForm.querySelector('#n_disp_location_campus_maps_id').innerHTML = api_data.locations.filter(x => x.id == event.target.selectedOptions[0].value)[0].campus_maps_id
                            newLocationForm.querySelector('div.card.selected-location-details').style.display = "block"
                        }
                        else {
                            newLocationForm.querySelector('#n_location_name').required = true;
                            newLocationForm.querySelector('div.card.selected-location-details').style.display = "none"
                        }
                    })
                    document.getElementById('new-manual-tab').addEventListener("shown.bs.tab", function(event) {
                        document.getElementById('n_existing_location_id').value = ''
                        newLocationForm.querySelector('#n_location_name').required = true;
                        newLocationForm.querySelector('div.card.selected-location-details').style.display = "none"
                    })
                }
                else { // this would mean that ALL locations in db is added to this course...
                }

                document.getElementById('n_location_campus_maps_id').addEventListener("input", function(event) {
                    if (event.target.value.includes("https://maps.chalmers.se/#")) {
                        document.getElementById('n_location_campus_maps_id').value = event.target.value.replace("https://maps.chalmers.se/#", "")
                    }
                    else {
                        const regexUuid = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
                        if (!regexUuid.test(event.target.value)) {
                            document.getElementById('n_location_campus_maps_id').value = ""
                        }
                    }
                })
            }
            else {
                newLocationModal.querySelector('div.modal-body.content-error span').innerHTML = data.message
                newLocationModal.querySelector('#newLocationSaveButton').disabled = true
            }
            newLocationModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            newLocationModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
    })

    /* The form for new location is submitted */
    newLocationForm && newLocationForm.addEventListener("submit", function(event) {
        if (!newLocationForm.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            newLocationForm.classList.add('was-validated')
        }
        else {
            const submitButton = newLocationForm.querySelector('#newLocationSaveButton')
            const submitSpinner = submitButton.querySelector('span.spinner-border')
            submitButton.disabled = true
            submitSpinner.style.display = "inline-block"

            const requestOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    existing_location_id: newLocationForm.querySelector('#n_existing_location_id').value,
                    name: newLocationForm.querySelector('#n_location_name').value,
                    description: newLocationForm.querySelector('#n_location_description').value,
                    external_url: newLocationForm.querySelector('#n_location_external_url').value,
                    campus_maps_id: newLocationForm.querySelector('#n_location_campus_maps_id').value,
                    max_individuals: newLocationForm.querySelector('#n_location_max_individuals').value
                })
            }

            console.log(requestOptions)

            fetch("/api/admin/location", requestOptions)
            .then(response => {
                return response.text()
            })
            .then(data => { 
                console.log(data)
                try {
                    const responseBody = JSON.parse(data)
                    if (responseBody.success) {
                        window.location.assign("/admin/location")
                    }
                    else {
                        newLocationForm.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                        newLocationForm.querySelector('div.alert.alert-error').style.display = "block"
                        submitButton.disabled = false
                        submitSpinner.style.display = "none"
                    }
                }
                catch (error) {
                    if (data.includes("<pre>") && data.match(/<pre>(.*?)<\/pre>/)[1]) {
                        newLocationForm.querySelector('div.alert.alert-error span').innerText = error.message + ", " + data.match(/<pre>(.*?)<\/pre>/)[1]
                    }
                    else {
                        newLocationForm.querySelector('div.alert.alert-error span').innerText = error.message    
                    }
                    newLocationForm.querySelector('div.alert.alert-error').style.display = "block"
                    submitButton.disabled = false
                    submitSpinner.style.display = "none"
                }
            })
        }
        
        event.preventDefault()
        event.stopPropagation()
    })

    /* The modal for edit location is show */
    editLocationModal && editLocationModal.addEventListener('show.bs.modal', event => {
        editLocationModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        editLocationModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        const button = event.relatedTarget
        const location_id = button.getAttribute('data-bs-location-id')
        fetch(`/api/admin/location/${location_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
            editLocationForm.querySelector('#e_location_id').value = location_id
            editLocationForm.querySelector('#e_location_name').value = data.location.name
            editLocationForm.querySelector('#e_location_description').innerHTML = data.location.description
            editLocationForm.querySelector('#e_location_external_url').value = data.location.external_url
            editLocationForm.querySelector('#e_location_campus_maps_id').value = data.location.campus_maps_id
            editLocationForm.querySelector('#e_location_max_individuals').value = data.location.max_individuals

            document.getElementById('e_location_campus_maps_id').addEventListener("input", function(event) {
                if (event.target.value.includes("https://maps.chalmers.se/#")) {
                    document.getElementById('e_location_campus_maps_id').value = event.target.value.replace("https://maps.chalmers.se/#", "")
                }
                else {
                    const regexUuid = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
                    if (!regexUuid.test(event.target.value)) {
                        document.getElementById('e_location_campus_maps_id').value = ""
                    }
                }
            })
        })
        .then(finished => {
            editLocationModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            editLocationModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
    })

    /* The Edit Instructor Form is submitted */
    editLocationForm && editLocationForm.addEventListener("submit", function(event) {
        if (!editLocationForm.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            editLocationForm.classList.add('was-validated')
        }
        else {
            const submitButton = editLocationForm.querySelector('#editLocationSaveButton')
            const submitSpinner = submitButton.querySelector('span.spinner-border')
            submitButton.disabled = true
            submitSpinner.style.display = "inline-block"

            const requestOptions = {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editLocationForm.querySelector('#e_location_name').value,
                    description: editLocationForm.querySelector('#e_location_description').value,
                    external_url: editLocationForm.querySelector('#e_location_external_url').value,
                    campus_maps_id: editLocationForm.querySelector('#e_location_campus_maps_id').value,
                    max_individuals: editLocationForm.querySelector('#e_location_max_individuals').value
                })
            }
    
            console.log(requestOptions)
    
            const location_id = editLocationForm.querySelector('#e_location_id').value
    
            fetch(`/api/admin/location/${location_id}`, requestOptions)
            .then(response => {
                return response.text()
            })
            .then(data => { 
                console.log(data)
                try {
                    const responseBody = JSON.parse(data)
                    if (responseBody.success) {
                        window.location.assign("/admin/location")
                    }
                    else {
                        editLocationForm.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                        editLocationForm.querySelector('div.alert.alert-error').style.display = "block"
                        submitButton.disabled = false
                        submitSpinner.style.display = "none"
                    }   
                }
                catch (error) {
                    if (data.includes("<pre>") && data.match(/<pre>(.*?)<\/pre>/)[1]) {
                        editLocationForm.querySelector('div.alert.alert-error span').innerText = error.message + ", " + data.match(/<pre>(.*?)<\/pre>/)[1]
                    }
                    else {
                        editLocationForm.querySelector('div.alert.alert-error span').innerText = error.message    
                    }
                    editLocationForm.querySelector('div.alert.alert-error').style.display = "block"
                    submitButton.disabled = false
                    submitSpinner.style.display = "none"
                }
            })
            
            event.preventDefault()
            event.stopPropagation()    
        }
    })

    deleteLocationModal && deleteLocationModal.addEventListener('show.bs.modal', event => {
        deleteLocationModal.querySelector('div.modal-body.loading-spinner').style.display = "block"
        deleteLocationModal.querySelector('div.modal-body.loaded-content').style.display = "none"
        const button = event.relatedTarget
        const location_id = button.getAttribute('data-bs-location-id')
        fetch(`/api/admin/location/${location_id}`)
        .then(response => response.json())
        .then(data => {
            console.log(data)
            deleteLocationModal.querySelector('#d_location_id').value = location_id
            deleteLocationModal.querySelector('#d_location_name').innerHTML = data.location.name
            deleteLocationModal.querySelector('#d_replace_with_location').replaceChildren()
            document.getElementById('d_replace_with_location')[0] = new Option("Ingen ersättning", "")
            data.course_locations.filter(ci => ci.id != location_id).forEach((i, key) => {
                document.getElementById('d_replace_with_location')[key+1] = new Option("Ersätt med " + i.name, i.id)
            })
            if (data.location.slots > 0) {
                deleteLocationModal.querySelector('div.loaded-content div.location-deletable').style.display = "none"
                deleteLocationModal.querySelector('div.loaded-content div.location-replace').style.display = "block"
            }
            else {
                deleteLocationModal.querySelector('div.loaded-content div.location-deletable').style.display = "block"
                deleteLocationModal.querySelector('div.loaded-content div.location-replace').style.display = "none"
            }
        })
        .then(finished => {
            deleteLocationModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            deleteLocationModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
    })

    /* The form for deleting/replacing a location is submitted */
    deleteLocationForm && deleteLocationForm.addEventListener("submit", function(event) {
        if (!deleteLocationForm.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            deleteLocationForm.classList.add('was-validated')
        }
        else {
            const submitButton = deleteLocationForm.querySelector('#deleteLocationSaveButton')
            const submitSpinner = submitButton.querySelector('span.spinner-border')
            submitButton.disabled = true
            submitSpinner.style.display = "inline-block"

            const requestOptions = {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    replace_with_location_id: deleteLocationForm.querySelector('#d_replace_with_location').value
                })
            }

            console.log(requestOptions)

            const location_id = deleteLocationForm.querySelector('#d_location_id').value

            fetch(`/api/admin/location/${location_id}`, requestOptions)
            .then(response => {
                return response.text()
            })
            .then(data => { 
                console.log(data)
                try {
                    const responseBody = JSON.parse(data)
                    if (responseBody.success) {
                        window.location.assign("/admin/location")
                    }
                    else {
                        deleteLocationForm.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                        deleteLocationForm.querySelector('div.alert.alert-error').style.display = "block"
                        submitButton.disabled = false
                        submitSpinner.style.display = "none"
                    }  
                }
                catch (error) {
                    if (data.includes("<pre>") && data.match(/<pre>(.*?)<\/pre>/)[1]) {
                        deleteLocationForm.querySelector('div.alert.alert-error span').innerText = error.message + ", " + data.match(/<pre>(.*?)<\/pre>/)[1]
                    }
                    else {
                        deleteLocationForm.querySelector('div.alert.alert-error span').innerText = error.message    
                    }
                    deleteLocationForm.querySelector('div.alert.alert-error').style.display = "block"
                    submitButton.disabled = false
                    submitSpinner.style.display = "none"
                }
                
            })
            
            event.preventDefault()
            event.stopPropagation()
        }
    })
})
