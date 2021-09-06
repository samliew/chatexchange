#!/bin/bash

declare src="src/**/*.ts"
declare config="jest.config.json"

jest \
    --config="$config" \
    --collectCoverage \
    --collectCoverageFrom="$src" \
    --coverageProvider="v8" \
    --coverageReporters="text-lcov" |
    coveralls && tslint "$src"
