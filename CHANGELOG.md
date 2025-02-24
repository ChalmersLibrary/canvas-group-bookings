# CHANGELOG

## Version 1.2.5

2025-02-24. Failed messages log and error handling.

* The sent messages log now includes if an error occured with Canvas API. Most likely this is because the conversation robot account is missing in the course.
* Canvas API calls are now better logged with errors and handled better in code.
* (Experimental) Elastic/Logstash connection, logs to remote endpoint with HTTP POST.

## Version 1.2.4

2025-01-20. Responsive re-design of filters and better message log. 

* When the screen size is smaller, filters are displayed in an offcanvas dialog accessible via a button. This improves usability for mobile and app users.
* The sent messages log in slot details for instructors has better design and now includes the whole message itself as an expandable option.
* Administrators can now edit the name and email address of added instructors. This makes it easier to have correct or alternative information from Canvas.
* Security updates of Dependabot issues with some packages.

## Version 1.2.3

2024-10-01. Security updates of Dependabot issues with some packages. Also provides admin with new functionality to export some data into tab separated text files for import in Excel or other software.

## Version 1.2.2

2024-02-13. This release contains small bug fixes and security updates of Dependabot issues with some packages.

## Version 1.2.1

2023-11-21. This release adds support for iCalendar files and manual messages from instructor to reserved groups and individuals.

* Support for downloading iCalendar (ics) entry for importing into local calendar software, both for instructor (slot) and user (reservation).
* Support for sending manual messages to reserved groups/individuals on a slot. The conversation robot is the sender, to enable sending to people that are not enrolled in a course (for courses that are open for institution), however the instructor/sender is added as recipient to make further communication easier.
* Instructor can see the log of sent messages in slot details pane.
* (Admin) When adding instructors to course, only list people that are active (ie. accepted invitation) in the course so that the email address is correct.
* (Layout) Slot listings are put in a card to appear visually like the rest of the page.

## Version 1.2.0

2023-10-04. This release adds language and locale support, and some other changes listed below.

* Language and locale support using i18n, included translations for English and Swedish, based on LTI presentation locale.
* Fixes default full locales for Canvas missing, ie "sv-SE" when Canvas only returns "sv".
* Support for simple configuration parameters in db, bound to Canvas courses.
* Configurable hiding of filter facets in a specific Canvas course.
* If student is not a part of any group, just be silent after logged in user name in header.
* Slot availability phrases now always reflect the available number of seats.
* Fixes a bug where logged in instructor was not matched to db id (in my slots view) due to a type mismatch.

## Earlier versions

Versions before this are not covered by this file.
