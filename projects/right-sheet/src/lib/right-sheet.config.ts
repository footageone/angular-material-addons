/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Direction } from '@angular/cdk/bidi';
import { ScrollStrategy } from '@angular/cdk/overlay';
import { InjectionToken, ViewContainerRef } from '@angular/core';

/** Options for where to set focus to automatically on dialog open */
export type AutoFocusTarget = 'dialog' | 'first-tabbable' | 'first-heading';

/** Injection token that can be used to access the data that was passed in to a bottom sheet. */
export const MAT_RIGHT_SHEET_DATA = new InjectionToken<any>('MatRightSheetData');

/**
 * Configuration used when opening a right sheet.
 */
export class MatRightSheetConfig<D = any> {
  /** The view container to place the overlay for the bottom sheet into. */
  public viewContainerRef?: ViewContainerRef;

  /** Extra CSS classes to be added to the bottom sheet container. */
  public panelClass?: string | Array<string>;

  /** Text layout direction for the bottom sheet. */
  public direction?: Direction;

  /** Data being injected into the child component. */
  public data?: D | null = null;

  /** Whether the bottom sheet has a backdrop. */
  public hasBackdrop?: boolean = true;

  /** Custom class for the backdrop. */
  public backdropClass?: string;

  /** Whether the user can use escape or clicking outside to close the bottom sheet. */
  public disableClose?: boolean = false;

  /** Aria label to assign to the bottom sheet element. */
  public ariaLabel?: string | null = null;

  /**
   * Whether the bottom sheet should close when the user goes backwards/forwards in history.
   * Note that this usually doesn't include clicking on links (unless the user is using
   * the `HashLocationStrategy`).
   */
  public closeOnNavigation?: boolean = true;

  // Note that this is set to 'dialog' by default, because while the a11y recommendations
  // are to focus the first focusable element, doing so prevents screen readers from reading out the
  // rest of the bottom sheet content.
  /**
   * Where the bottom sheet should focus on open.
   * @breaking-change 14.0.0 Remove boolean option from autoFocus. Use string or
   * AutoFocusTarget instead.
   */
   autoFocus?: AutoFocusTarget | string | boolean = 'dialog';

  /**
   * Whether the bottom sheet should restore focus to the
   * previously-focused element, after it's closed.
   */
  public restoreFocus?: boolean = true;

  /** Scroll strategy to be used for the bottom sheet. */
  scrollStrategy?: ScrollStrategy;

  /**
   * width of overlay
   */
  public width?: string;
}
