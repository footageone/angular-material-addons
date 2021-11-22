# RightSheet

Run `npm i mat-right-sheet` and add `MatRightSheetModule` to your modules. For further usage information see the official documentation for [BottomSheet](https://material.angular.io/components/component/bottom-sheet) and replace `BottomSheet` with `RightSheet`.

## Theme

Include the theming in your stylesheets. For example:

```SCSS
@use "mat-right-sheet/right-sheet-theme" as mrs;

@include mrs.mat-right-sheet-theme($theme);

@include mrs.mat-right-sheet-typography($custom-typography);
```
