/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { AnimationEvent } from '@angular/animations';
import { FocusTrap, FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { coerceArray } from '@angular/cdk/coercion';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { _getFocusedElementPierceShadowDom } from '@angular/cdk/platform';
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
  NgZone,
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
    // In Ivy embedded views will be change detected from their declaration place, rather than where
    // they were stamped out. This means that we can't have the bottom sheet container be OnPush,
    // because it might cause the sheets that were opened from a template not to be out of date.
    // tslint:disable-next-line:validate-decorators
    changeDetection: ChangeDetectionStrategy.Default,
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
    standalone: false
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
    private readonly _interactivityChecker: InteractivityChecker,
    private readonly _ngZone: NgZone,
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
    this._elementRef.nativeElement.classList.toggle(cssClass, add);
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
    element.classList.add(...coerceArray(this.rightSheetConfig.panelClass || []));
  }

/**
   * Focuses the provided element. If the element is not focusable, it will add a tabIndex
   * attribute to forcefully focus it. The attribute is removed after focus is moved.
   * @param element The element to focus.
   */
 private _forceFocus(element: HTMLElement, options?: FocusOptions) {
  if (!this._interactivityChecker.isFocusable(element)) {
    element.tabIndex = -1;
    // The tabindex attribute should be removed to avoid navigating to that element again
    this._ngZone.runOutsideAngular(() => {
      element.addEventListener('blur', () => element.removeAttribute('tabindex'));
      element.addEventListener('mousedown', () => element.removeAttribute('tabindex'));
    });
  }
  element.focus(options);
}

  /**
   * Focuses the first element that matches the given selector within the focus trap.
   * @param selector The CSS selector for the element to set focus to.
   */
   private _focusByCssSelector(selector: string, options?: FocusOptions) {
    let elementToFocus = this._elementRef.nativeElement.querySelector(
      selector,
    ) as HTMLElement | null;
    if (elementToFocus) {
      this._forceFocus(elementToFocus, options);
    }
  }

  /**
   * Moves the focus inside the focus trap. When autoFocus is not set to 'bottom-sheet',
   * if focus cannot be moved then focus will go to the bottom sheet container.
   */
   private _trapFocus() {
    const element = this._elementRef.nativeElement;

    if (!this._focusTrap) {
      this._focusTrap = this._focusTrapFactory.create(element);
    }

    // If were to attempt to focus immediately, then the content of the bottom sheet would not
    // yet be ready in instances where change detection has to run first. To deal with this,
    // we simply wait for the microtask queue to be empty when setting focus when autoFocus
    // isn't set to bottom sheet. If the element inside the bottom sheet can't be focused,
    // then the container is focused so the user can't tab into other elements behind it.
    switch (this.rightSheetConfig.autoFocus) {
      case false:
      case 'dialog':
        const activeElement = _getFocusedElementPierceShadowDom();
        // Ensure that focus is on the bottom sheet container. It's possible that a different
        // component tried to move focus while the open animation was running. See:
        // https://github.com/angular/components/issues/16215. Note that we only want to do this
        // if the focus isn't inside the bottom sheet already, because it's possible that the
        // consumer specified `autoFocus` in order to move focus themselves.
        if (activeElement !== element && !element.contains(activeElement)) {
          element.focus();
        }
        break;
      case true:
      case 'first-tabbable':
        this._focusTrap.focusInitialElementWhenReady();
        break;
      case 'first-heading':
        this._focusByCssSelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
        break;
      default:
        this._focusByCssSelector(this.rightSheetConfig.autoFocus!);
        break;
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
      this._ngZone.runOutsideAngular(() => {
        Promise.resolve().then(() => this._elementRef.nativeElement.focus());
      });
    }
  }
}
