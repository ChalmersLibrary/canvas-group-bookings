#!/bin/bash

# Load tests for Bokningsverktyg, requires curl and python3

# NOTE: DISABLE CANVAS CONVERSATION ROBOT BEFORE RUNNING!
# NOTE: There are still some hard coded values below for making reservation, which slot, user and group id.
# Most important is that there are separate session ids for separate users.

user=$1
loop_end=$2
loop_now=1

# configuration variables for session ids and baseurl
#cookie_user_01=""
#cookie_user_02=""
#cookie_user_03=""
#server_url=""

# or use .env file in root with same format:
export $(grep -v '^#' ../../.env | xargs)

while [ $loop_now -le $loop_end ]
do
    echo "[$user][$loop_now/$loop_end]"

    if [ "$user" == "user01" ]; then
        # User, admin, loads page with own times
        curl --silent --cookie "${cookie_user_01}" "${server_url}/" > /dev/null
        curl --silent --cookie "${cookie_user_01}" "${server_url}/?instructor=1&availability=1" > /dev/null
        curl --silent --cookie "${cookie_user_01}" "${server_url}/?location=3&start_date=2022-12-24&end_date=2022-12-30" > /dev/null
    fi

    if [ "$user" == "user02" ]; then
        # TstStud01 lists times
        curl --silent --cookie "${cookie_user_02}" "${server_url}" > /dev/null
        curl --silent --cookie "${cookie_user_02}" "${server_url}/?location=3&start_date=2022-12-24&end_date=2022-12-30" > /dev/null
        # TstStud01 GET /api/slot/1027
        curl --silent --cookie "${cookie_user_02}" "${server_url}/api/slot/1027" > /dev/null
        # TstStud01 reserves a slot (API)
        reservation_id_01=$(curl --silent -X POST -H "Content-Type: application/json" --data '{"slot_id":"1027","group_id":"143042","user_id":"31640","message":"test from load tester 1"}' --cookie "${cookie_user_02}" "${server_url}/api/reservation" | python3 -c "import sys, json; print(json.load(sys.stdin)['reservation_id'])")
        # Wait
        sleep 1
        # TstStud01 cancels the above reserved slot (API)
        curl --silent -X DELETE --cookie "${cookie_user_02}" "${server_url}/api/reservation/${reservation_id_01}" > /dev/null
    fi

    if [ "$user" == "user03" ]; then
        # TstStud02 lists times
        curl --silent --cookie "${cookie_user_03}" "${server_url}" > /dev/null
        curl --silent --cookie "${cookie_user_03}" "${server_url}/?location=3&start_date=2022-12-24&end_date=2022-12-30" > /dev/null
        # TstStud02 GET /api/slot/1049
        curl --silent --cookie "${cookie_user_03}" "${server_url}/api/slot/1049" > /dev/null
        # TstStud02 reserves a slot (API)
        reservation_id_02=$(curl --silent -X POST -H "Content-Type: application/json" --data '{"slot_id":"1049","group_id":"143043","user_id":"31641","message":"test from load tester 2"}' --cookie "${cookie_user_03}" "${server_url}/api/reservation" | python3 -c "import sys, json; print(json.load(sys.stdin)['reservation_id'])")
        # Wait
        sleep 1
        # TstStud02 cancels the above reserved slot (API)
        curl --silent -X DELETE --cookie "${cookie_user_03}" "${server_url}/api/reservation/${reservation_id_02}" > /dev/null
    fi

    if [ "$user" == "user04" ]; then
        # User, loads pages
        curl --silent --cookie "${cookie_user_01}" "${server_url}/" > /dev/null
        curl --silent --cookie "${cookie_user_01}" "${server_url}/reservations" > /dev/null
        curl --silent --cookie "${cookie_user_01}" "${server_url}/does-not-exist" > /dev/null
    fi

  loop_now=$(( $loop_now + 1 ))
  sleep 1
done

echo "[$user] load test is done"

exit
