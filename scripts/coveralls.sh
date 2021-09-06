#!/bin/bash

jest \
    --config tests/jest.config.json \
    --coverage \
    --collectCoverageFrom=src/**/*.ts \
    --coverageReporters=text-lcov |
    coveralls && tslint src/**/*.ts
