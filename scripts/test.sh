#!/bin/bash

jest \
    --config tests/jest.config.json \
    --coverage \
    --collectCoverageFrom=src/**/*.ts \
    --coverageReporters=lcov \
    --silent=false &&
    tslint src/**/*.ts
