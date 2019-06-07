/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Direction } from '@angular/cdk/bidi';
import { InjectionToken, ViewContainerRef } from '@angular/core';

/** Injection token that can be used to access the data that was passed in to a bottom sheet. */
export const MAT_RIGHT_SHEET_DATA = new InjectionToken<any>('MatRightSheetData');

/**
 * Configuration used when opening a bottom sheet.
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

  // Note that this is disabled by default, because while the a11y recommendations are to focus
  // the first focusable element, doing so prevents screen readers from reading out the
  // rest of the bottom sheet content.
  /** Whether the bottom sheet should focus the first focusable element on open. */
  public autoFocus?: boolean = false;

  /**
   * Whether the bottom sheet should restore focus to the
   * previously-focused element, after it's closed.
   */
  public restoreFocus?: boolean = true;
}
