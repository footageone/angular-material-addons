/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { AnimationEvent } from '@angular/animations';
import { FocusTrap, FocusTrapFactory } from '@angular/cdk/a11y';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { BasePortalOutlet, CdkPortalOutlet, ComponentPortal, TemplatePortal, } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  ElementRef,
  EmbeddedViewRef,
  EventEmitter,
  Inject,
  OnDestroy,
  Optional,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { matRightSheetAnimations } from './right-sheet.animations';
import { MatRightSheetConfig } from './right-sheet.config';

// TODO(crisbeto): consolidate some logic between this, MatDialog and MatSnackBar

/**
 * Internal component that wraps user-provided bottom sheet content.
 * @docs-private
 */
@Component({
  //    moduleId: module.id,
  selector: 'mat-right-sheet-container',
  templateUrl: './right-sheet.container.html',
  styleUrls: ['./right-sheet.container.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // tslint:disable-next-line: use-view-encapsulation
  encapsulation: ViewEncapsulation.None,
  animations: [matRightSheetAnimations.rightSheetState],
  // tslint:disable-next-line: use-host-property-decorator
  host: {
    class: 'mat-right-sheet-container',
    tabindex: '-1',
    role: 'dialog',
    'aria-modal': 'true',
    '[attr.aria-label]': 'rightSheetConfig?.ariaLabel',
    '[@state]': '_animationState',
    '(@state.start)': '_onAnimationStart($event)',
    '(@state.done)': '_onAnimationDone($event)',
  },
})
// tslint:disable-next-line: component-class-suffix
export class MatRightSheetContainer extends BasePortalOutlet
  implements OnDestroy {
  /** Emits whenever the state of the animation changes. */
  public _animationStateChanged = new EventEmitter<AnimationEvent>();

  /** The state of the bottom sheet animations. */
  public _animationState: 'void' | 'visible' | 'hidden' = 'void';
  private readonly _breakpointSubscription: Subscription;

  /** The portal outlet inside of this container into which the content will be loaded. */
  @ViewChild(CdkPortalOutlet, {static: true})
  private readonly _portalOutlet: CdkPortalOutlet;

  /** The class that traps and manages focus within the bottom sheet. */
  private _focusTrap: FocusTrap;

  /** Element that was focused before the bottom sheet was opened. */
  private _elementFocusedBeforeOpened: HTMLElement | null = null;

  /** Server-side rendering-compatible reference to the global document object. */
  private readonly _document: Document;

  /** Whether the component has been destroyed. */
  private _destroyed: boolean;

  constructor(
    private readonly _elementRef: ElementRef<HTMLElement>,
    private readonly _changeDetectorRef: ChangeDetectorRef,
    private readonly _focusTrapFactory: FocusTrapFactory,
    breakpointObserver: BreakpointObserver,
    @Optional() @Inject(DOCUMENT) document: any,
    /**
     * The right sheet configuration.
     */
    public rightSheetConfig: MatRightSheetConfig,
  ) {
    super();

    this._document = document as Document;
    this._breakpointSubscription = breakpointObserver
      .observe([
        Breakpoints.Medium,
        Breakpoints.Large,
        Breakpoints.XLarge,
      ])
      .subscribe(() => {
        this._toggleClass(
          'mat-right-sheet-container-medium',
          breakpointObserver.isMatched(Breakpoints.Medium),
        );
        this._toggleClass(
          'mat-right-sheet-container-large',
          breakpointObserver.isMatched(Breakpoints.Large),
        );
        this._toggleClass(
          'mat-right-sheet-container-xlarge',
          breakpointObserver.isMatched(Breakpoints.XLarge),
        );
      });
  }

  /** Attach a component portal as content to this bottom sheet container. */
  public attachComponentPortal<T>(
    portal: ComponentPortal<T>,
  ): ComponentRef<T> {
    this._validatePortalAttached();
    this._setPanelClass();
    this._savePreviouslyFocusedElement();
    return this._portalOutlet.attachComponentPortal(portal);
  }

  /** Attach a template portal as content to this bottom sheet container. */
  public attachTemplatePortal<C>(
    portal: TemplatePortal<C>,
  ): EmbeddedViewRef<C> {
    this._validatePortalAttached();
    this._setPanelClass();
    this._savePreviouslyFocusedElement();
    return this._portalOutlet.attachTemplatePortal(portal);
  }

  /** Begin animation of bottom sheet entrance into view. */
  public enter(): void {
    if (!this._destroyed) {
      this._animationState = 'visible';
      this._changeDetectorRef.detectChanges();
    }
  }

  /** Begin animation of the bottom sheet exiting from view. */
  public exit(): void {
    if (!this._destroyed) {
      this._animationState = 'hidden';
      this._changeDetectorRef.markForCheck();
    }
  }

  public ngOnDestroy() {
    this._breakpointSubscription.unsubscribe();
    this._destroyed = true;
  }

  public _onAnimationDone(event: AnimationEvent) {
    if (event.toState === 'hidden') {
      this._restoreFocus();
    } else if (event.toState === 'visible') {
      this._trapFocus();
    }

    this._animationStateChanged.emit(event);
  }

  public _onAnimationStart(event: AnimationEvent) {
    this._animationStateChanged.emit(event);
  }

  private _toggleClass(cssClass: string, add: boolean) {
    const classList = this._elementRef.nativeElement.classList;
    add ? classList.add(cssClass) : classList.remove(cssClass);
  }

  private _validatePortalAttached() {
    if (this._portalOutlet.hasAttached()) {
      throw Error(
        'Attempting to attach bottom sheet content after content is already attached',
      );
    }
  }

  private _setPanelClass() {
    const element: HTMLElement = this._elementRef.nativeElement;
    const panelClass = this.rightSheetConfig.panelClass;

    if (Array.isArray(panelClass)) {
      // Note that we can't use a spread here, because IE doesn't support multiple arguments.
      panelClass.forEach((cssClass) => element.classList.add(cssClass));
    } else if (panelClass) {
      element.classList.add(panelClass);
    }
  }

  /** Moves the focus inside the focus trap. */
  private _trapFocus() {
    if (!this._focusTrap) {
      this._focusTrap = this._focusTrapFactory.create(
        this._elementRef.nativeElement,
      );
    }

    if (this.rightSheetConfig.autoFocus) {
      this._focusTrap.focusInitialElementWhenReady();
    }
  }

  /** Restores focus to the element that was focused before the bottom sheet was opened. */
  private _restoreFocus() {
    const toFocus = this._elementFocusedBeforeOpened;

    // We need the extra check, because IE can set the `activeElement` to null in some cases.
    if (
      this.rightSheetConfig.restoreFocus &&
      toFocus &&
      typeof toFocus.focus === 'function'
    ) {
      const activeElement = this._document.activeElement;
      const element = this._elementRef.nativeElement;

      // Make sure that focus is still inside the bottom sheet or is on the body (usually because a
      // non-focusable element like the backdrop was clicked) before moving it. It's possible that
      // the consumer moved it themselves before the animation was done, in which case we shouldn't
      // do anything.
      if (!activeElement || activeElement === this._document.body || activeElement === element ||
        element.contains(activeElement)) {
        toFocus.focus();
      }
    }

    if (this._focusTrap) {
      this._focusTrap.destroy();
    }
  }

  /** Saves a reference to the element that was focused before the bottom sheet was opened. */
  private _savePreviouslyFocusedElement() {
    this._elementFocusedBeforeOpened = this._document
      .activeElement as HTMLElement;

    // The `focus` method isn't available during server-side rendering.
    if (this._elementRef.nativeElement.focus) {
      Promise.resolve().then(() =>
        this._elementRef.nativeElement.focus(),
      );
    }
  }
}
