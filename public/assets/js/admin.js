document.addEventListener("DOMContentLoaded", function(event) {
    document.getElementById("newSlotForm").addEventListener("change", function(event) {
        console.log(event);
        if(event.target === "course_part") {

        }
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

