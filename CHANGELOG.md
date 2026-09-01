# CHANGELOG

## Version 1.2.7

2026-09-01. Messages that were silently not sent, a launch that could be re-used, and a session failure that stopped the tool.

* Fixed a fault where a course with an empty message text sent no messages at all. Leaving the text empty is meant to fall back to the standard template, but confirmations and cancellations were skipped instead: the booking or cancellation itself succeeded, the person was told nothing, and nothing appeared in the sent messages log.
* The message templates that ship with the tool are now found wherever it is started from, rather than only when it is started from its own directory.
* A launch from Canvas can no longer be used more than once. Every launch carries a one-time value, and the tool now remembers the ones it has seen, so a launch that has been captured cannot be sent again to open the tool as that person. Previously each launch was checked against an empty memory, which is the same as not checking at all.
* A session that cannot be stored is now reported on the one request it affects. Previously it stopped the whole application, which interrupted everyone who happened to be using the tool at that moment, and the restart was the only sign it had happened.
* Signing in to Canvas no longer answers twice when the token cannot be stored, and the message shown on a failed sign-in no longer includes Canvas's own response.
* Applying a database migration now reports which file was applied, instead of also sending the database driver internal result object to the log collector.
* Corrected the starting instructions in the README, and documented how to run the tests.
* Added tests for how the message body of a course is chosen, for the templates the tool ships with, for repeated launches, and for the sign-in callback, which had no coverage at all.

## Version 1.2.6

2026-08-24. Sign-in fixes, security updates and a large dependency upgrade.

* Fixed the error page that some users met after signing in to Canvas. The session cookie is now partitioned, which browsers increasingly require of a tool running in an iframe, and a cookie that is not stored means no session at all.
* When that error does still happen, the log now records what actually failed — whether the cookie arrived, and which browser — instead of assuming the cause.
* Fixed a fault where one launch could inherit details from the previous launch handled by the same server, which could show the wrong course, title or enrolment state.
* A launch from a Canvas that the installation is not set up for is now reported in the log, and can optionally be refused.
* The tool now states at startup which Canvas, which database, which runtime version and which log destination it is running with. A wrong setting previously looked exactly like a correct one.
* Long-lived Canvas credentials and authorization codes are no longer written to any log file.
* The tool can now restrict which sites are allowed to embed it, via a new `CSP_FRAME_ANCESTORS` setting naming the Canvas hosts. Left unset, any site may embed it, which is how it behaved before.
* The Swedish error page for session problems is now reachable; it was previously always shown in English.
* Remote logging now includes the structured detail of an entry, not only its message, so it can replace the log files rather than summarise them.
* Dependency upgrades: the LTI, web framework, OAuth, security header, session store, logging and configuration libraries all moved to current major versions, and four dependencies that were no longer needed were removed. All reported vulnerabilities are now cleared.
* The tool no longer rewrites its own translation files when a text is missing, and finds them wherever it is started from.
* Changes made through the administration and instructor pages are now logged, with the course each change applied to, the user who made it and whether it succeeded. Previously only student bookings and cancellations were logged, so nothing recorded what an administrator had changed or where.
* Example configuration files for setting the tool up: `.env_example` lists every setting the tool reads, and `mock-lti_example.json` is a starting point for running it locally without Canvas. See the README.
* Tested with Node 22 LTS and Node 24 LTS.
* Added an automated test suite, run with `npm test`, covering LTI launches and their refusal paths, the session cookie, OAuth token storage and refresh, log redaction, remote logging, the startup report and the headers that let Canvas embed the tool.

## Version 1.2.5

2025-02-24. Failed messages log and error handling.

* The sent messages log now includes if an error occured with Canvas API. Most likely this is because the conversation robot account is missing in the course.
* Canvas API calls are now better logged with errors and handled better in code.
* (Experimental) Elastic/Logstash connection, logs to remote endpoint with HTTP POST.
* Tested with Node 22 LTS.

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
