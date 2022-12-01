#!/bin/bash

start=$1
max=$2
current=0

if [ -z "$start" ]; then
    start="today"
fi

if [ -z "$max" ]; then
    max=10
fi

echo "-- Usage: create-slots.sh <startdate> <number of slots>"
echo "-- Start date: $start, number of slots: $max"

while [ $current -le $max ]
do
    d=$(date -d "$1 + ${current} days" +"%Y-%m-%d")
    echo "INSERT INTO slot (course_id, instructor_id, location_id, time_start, time_end) VALUES (13, 1, 9, '${d} 09:00', '${d} 10:30');"
    current=$(( $current + 1 ))
done
