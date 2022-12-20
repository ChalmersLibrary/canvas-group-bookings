#!/bin/bash

# Start parallel load testers for more traffic, loop is just time

echo "Starting load tester for user01"
time ./load-test.sh user01 100 &
sleep 2

echo "Starting load tester for user02"
time ./load-test.sh user02 100 &
sleep 2

# 1500 ~ 70m
echo "Starting load tester for user03"
time ./load-test.sh user03 100 &
sleep 2

echo "Starting load tester for user03"
time ./load-test.sh user04 100 &

echo "Starter is done."
exit
