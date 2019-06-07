#!/usr/bin/env bash

echo "building right-sheet"

ng build right-sheet
cp projects/right-sheet/src/lib/_right-sheet-theme.scss dist/right-sheet
