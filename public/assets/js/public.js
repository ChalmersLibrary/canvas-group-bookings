document.addEventListener("DOMContentLoaded", function(event) {
    const slotFilterCourse = document.getElementById('slotFilterCourse');
    const slots = document.querySelectorAll('#slots tbody tr');

    slotFilterCourse.addEventListener('change', function () {
        let value = slotFilterCourse.value;

        [...slots].forEach((slot) => {
            if (value === '') {
                slot.classList.remove('d-none');
            }
            else {
                const course_id = slot.dataset.course_id;
                if (!course_id || course_id !== value) {
                    slot.classList.add('d-none');
                }
                else {
                    slot.classList.remove('d-none');
                }
            }
        });
    });
})
