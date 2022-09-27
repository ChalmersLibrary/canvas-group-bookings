document.addEventListener("DOMContentLoaded", function(event) {
    document.getElementById("newSlotForm").addEventListener("submit", function(event) {
        console.log(event);
        /* event.preventDefault();
        event.stopPropagation(); */
    });
    document.getElementById("slot_new_slot").addEventListener("click", function(event) {
        const slots_container = document.getElementById("slots");
        const slots_current = slots_container.querySelectorAll("div.slot");
        const template = document.getElementById("slot_template").cloneNode(true);
        const new_slot = slots_container.appendChild(template);
        new_slot.setAttribute("id", "slot_" + (slots_current.length + 1));
        new_slot.querySelectorAll("label").forEach((e) => {
            e.setAttribute("for", e.getAttribute("for") + (slots_current.length + 1));
        });
        new_slot.querySelectorAll("input.form-control").forEach((e) => {
            e.setAttribute("id", e.getAttribute("id") + (slots_current.length + 1));
            e.setAttribute("name", e.getAttribute("name") + (slots_current.length + 1));
        });
        new_slot.classList.remove("slot_template");
        new_slot.classList.add("slot");
    });

    /* Disables form submission if validation fails */
    (() => {
        'use strict'
      
        // Fetch all the forms we want to apply custom Bootstrap validation styles to
        const forms = document.querySelectorAll('.needs-validation')
      
        // Loop over them and prevent submission
        Array.from(forms).forEach(form => {
          form.addEventListener('submit', event => {
            if (!form.checkValidity()) {
              event.preventDefault()
              event.stopPropagation()
            }
      
            form.classList.add('was-validated')
          }, false)
        })
      })()
});

