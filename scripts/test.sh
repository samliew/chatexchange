#!/bin/bash

declare src="src/**/*.ts"
declare config="jest.config.json"

jest \
    --config="$config" \
    --collectCoverage \
    --collectCoverageFrom="$src" \
    --coverageReporters="lcov" \
    --silent=false &&
    tslint "$src"
