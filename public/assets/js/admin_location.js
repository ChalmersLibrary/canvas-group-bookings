document.addEventListener("DOMContentLoaded", function(event) {
    const newLocationModal = document.getElementById("newLocation")
    const newLocationForm = document.getElementById("newLocationForm")
    const editLocationModal = document.getElementById("editLocation")
    const editLocationForm = document.getElementById("editLocationForm")
    const deleteLocationModal = document.getElementById("deleteLocation")
    const deleteLocationForm = document.getElementById("deleteLocationForm")

    /* The modal for new Location is shown, load users into select */
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
                        }
                        else {
                            newLocationForm.querySelector('#n_location_name').required = true;
                        }
                        newLocationForm.querySelector('#n_disp_location_name').innerHTML = api_data.locations.filter(x => x.id == event.target.selectedOptions[0].value)[0].name
                        newLocationForm.querySelector('#n_disp_location_description').innerHTML = api_data.locations.filter(x => x.id == event.target.selectedOptions[0].value)[0].description
                        newLocationForm.querySelector('#n_disp_location_external_url').innerHTML = api_data.locations.filter(x => x.id == event.target.selectedOptions[0].value)[0].external_url
                        newLocationForm.querySelector('#n_disp_location_campus_maps_id').innerHTML = api_data.locations.filter(x => x.id == event.target.selectedOptions[0].value)[0].campus_maps_id
                    })
                }
                else { // this would mean that ALL locations in db is added to this course...
                }
            }
            else {
                newLocationModal.querySelector('div.modal-body.content-error span').innerHTML = data.message
                newLocationModal.querySelector('#newLocationSaveButton').disabled = true
            }
            newLocationModal.querySelector('div.modal-body.loading-spinner').style.display = "none"
            newLocationModal.querySelector('div.modal-body.loaded-content').style.display = "block"
        })
        .then(finished => {
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
            const requestOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    existing_location_id: newLocationForm.querySelector('#n_existing_location_id').value,
                    name: newLocationForm.querySelector('#n_location_name').value,
                    description: newLocationForm.querySelector('#n_location_description').value,
                    external_url: newLocationForm.querySelector('#n_location_external_url').value,
                    campus_maps_id: newLocationForm.querySelector('#n_location_campus_maps_id').value
                })
            }

            console.log(requestOptions)

            fetch("/api/admin/location", requestOptions)
            .then(response => {
                return response.text()
            })
            .then(data => { 
                console.log(data)
                const responseBody = JSON.parse(data)
                if (responseBody.success === false) {
                    newLocationModal.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                    newLocationModal.querySelector('div.alert.alert-error').style.display = "block"
                }
                else {
                    window.location.assign("/admin/location")
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
            const requestOptions = {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editLocationForm.querySelector('#e_location_name').value,
                    description: editLocationForm.querySelector('#e_location_description').value,
                    external_url: editLocationForm.querySelector('#e_location_external_url').value,
                    campus_maps_id: editLocationForm.querySelector('#e_location_campus_maps_id').value
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
                const responseBody = JSON.parse(data)
                if (responseBody.success === false) {
                    editLocationModal.querySelector('div.alert.alert-error span').innerText = JSON.parse(data).message
                    editLocationModal.querySelector('div.alert.alert-error').style.display = "block"
                }
                else {
                    window.location.assign("/admin/location")
                }
            })
            
            event.preventDefault()
            event.stopPropagation()    
        }
    })
})
