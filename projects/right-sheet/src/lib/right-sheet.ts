/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Directionality } from '@angular/cdk/bidi';
import { Overlay, OverlayConfig, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, ComponentType, TemplatePortal, } from '@angular/cdk/portal';
import { Location } from '@angular/common';
import { ComponentRef, Inject, Injectable, InjectionToken, Injector, OnDestroy, Optional, SkipSelf, TemplateRef, } from '@angular/core';
import { of as observableOf } from 'rxjs';
import { MAT_RIGHT_SHEET_DATA, MatRightSheetConfig } from './right-sheet.config';
import { MatRightSheetContainer } from './right-sheet.container';
import { MatRightSheetModule } from './right-sheet.module';
import { MatRightSheetRef } from './right-sheet.ref';

/** Injection token that can be used to specify default bottom sheet options. */
export const MAT_RIGHT_SHEET_DEFAULT_OPTIONS = new InjectionToken<MatRightSheetConfig>('mat-right-sheet-default-options');

/**
 * Service to trigger Material Design right sheets.
 */
@Injectable({providedIn: MatRightSheetModule})
export class MatRightSheet implements OnDestroy {
  private _rightSheetRefAtThisLevel: MatRightSheetRef<any> | null = null;

  /** Reference to the currently opened bottom sheet. */
  get _openedRightSheetRef(): MatRightSheetRef<any> | null {
    const parent = this._parentRightSheet;
    return parent
      ? parent._openedRightSheetRef
      : this._rightSheetRefAtThisLevel;
  }

  set _openedRightSheetRef(value: MatRightSheetRef<any> | null) {
    if (this._parentRightSheet) {
      this._parentRightSheet._openedRightSheetRef = value;
    } else {
      this._rightSheetRefAtThisLevel = value;
    }
  }

  constructor(
    private readonly _overlay: Overlay,
    private readonly _injector: Injector,
    @Optional()
    @SkipSelf()
    private readonly _parentRightSheet: MatRightSheet,
    @Optional() private readonly _location?: Location,
    @Optional()
    @Inject(MAT_RIGHT_SHEET_DEFAULT_OPTIONS)
    private readonly _defaultOptions?: MatRightSheetConfig,
  ) {
  }

  public open<T, D = any, R = any>(
    component: ComponentType<T>,
    config?: MatRightSheetConfig<D>,
  ): MatRightSheetRef<T, R>;
  public open<T, D = any, R = any>(
    template: TemplateRef<T>,
    config?: MatRightSheetConfig<D>,
  ): MatRightSheetRef<T, R>;
  public open<T, D = any, R = any>(
    componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
    config?: MatRightSheetConfig<D>,
  ): MatRightSheetRef<T, R> {
    const _config = _applyConfigDefaults(
      this._defaultOptions || new MatRightSheetConfig(),
      config,
    );
    const overlayRef = this._createOverlay(_config);
    const container = this._attachContainer(overlayRef, _config);
    const ref = new MatRightSheetRef<T, R>(
      container,
      overlayRef,
      this._location,
    );

    if (componentOrTemplateRef instanceof TemplateRef) {
      container.attachTemplatePortal(
        new TemplatePortal<T>(componentOrTemplateRef, null!, {
          $implicit: _config.data,
          rightSheetRef: ref,
        } as any),
      );
    } else {
      const portal = new ComponentPortal(
        componentOrTemplateRef,
        undefined,
        this._createInjector(_config, ref),
      );
      const contentRef = container.attachComponentPortal(portal);
      ref.instance = contentRef.instance;
    }

    // When the bottom sheet is dismissed, clear the reference to it.
    ref.afterDismissed().subscribe(() => {
      // Clear the bottom sheet ref if it hasn't already been replaced by a newer one.
      if (this._openedRightSheetRef == ref) {
        this._openedRightSheetRef = null;
      }
    });

    if (this._openedRightSheetRef) {
      // If a bottom sheet is already in view, dismiss it and enter the
      // new bottom sheet after exit animation is complete.
      this._openedRightSheetRef
        .afterDismissed()
        .subscribe(() => ref.containerInstance.enter());
      this._openedRightSheetRef.dismiss();
    } else {
      // If no bottom sheet is in view, enter the new bottom sheet.
      ref.containerInstance.enter();
    }

    this._openedRightSheetRef = ref;

    return ref;
  }

  /**
   * Dismisses the currently-visible bottom sheet.
   */
  public dismiss(): void {
    if (this._openedRightSheetRef) {
      this._openedRightSheetRef.dismiss();
    }
  }

  public ngOnDestroy() {
    if (this._rightSheetRefAtThisLevel) {
      this._rightSheetRefAtThisLevel.dismiss();
    }
  }

  /**
   * Attaches the bottom sheet container component to the overlay.
   */
  private _attachContainer(
    overlayRef: OverlayRef,
    config: MatRightSheetConfig,
  ): MatRightSheetContainer {
    const userInjector =
      config &&
      config.viewContainerRef &&
      config.viewContainerRef.injector;
    const injector = Injector.create({
      providers: [
        { provide: MatRightSheetConfig, useValue: config }
      ],
      parent: userInjector || this._injector
    });

    const containerPortal = new ComponentPortal(
      MatRightSheetContainer,
      config.viewContainerRef,
      injector,
    );
    const containerRef: ComponentRef<MatRightSheetContainer> = overlayRef.attach(containerPortal);
    return containerRef.instance;
  }

  /**
   * Creates a new overlay and places it in the correct location.
   * @param config The user-specified bottom sheet config.
   */
  private _createOverlay(config: MatRightSheetConfig): OverlayRef {
    const overlayConfig = new OverlayConfig({
      direction: config.direction,
      hasBackdrop: config.hasBackdrop,
      disposeOnNavigation: config.closeOnNavigation,
      width: config.width || '420px',
      height: '100vh',
      scrollStrategy: config.scrollStrategy || this._overlay.scrollStrategies.block(),
      positionStrategy: this._overlay
        .position()
        .global()
        .top('0px')
        .right('0px')
        .bottom('0px'),
    });

    if (config.backdropClass) {
      overlayConfig.backdropClass = config.backdropClass;
    }

    return this._overlay.create(overlayConfig);
  }

  /**
   * Creates an injector to be used inside of a bottom sheet component.
   * @param config Config that was used to create the bottom sheet.
   * @param rightSheetRef Reference to the bottom sheet.
   */
  private _createInjector<T>(
    config: MatRightSheetConfig,
    rightSheetRef: MatRightSheetRef<T>,
  ): Injector {
    const userInjector =
      config &&
      config.viewContainerRef &&
      config.viewContainerRef.injector;
    const providers: any[] = [
      { provide: MatRightSheetRef, useValue: rightSheetRef },
      { provide: MAT_RIGHT_SHEET_DATA, useValue: config.data },
    ];

    if (
      config.direction &&
      (!userInjector ||
        !userInjector.get<Directionality | null>(Directionality, null))
    ) {
      providers.push({
        provide: Directionality,
        useValue: {
          value: config.direction,
          change: observableOf(),
        }
      });
    }

    return Injector.create({
      providers: providers,
      parent: userInjector || this._injector
    });
  }
}

/**
 * Applies default options to the bottom sheet config.
 * @param defaults Object containing the default values to which to fall back.
 * @param config The configuration to which the defaults will be applied.
 * @returns The new configuration object with defaults applied.
 */
function _applyConfigDefaults(
  defaults: MatRightSheetConfig,
  config?: MatRightSheetConfig,
): MatRightSheetConfig {
  return {...defaults, ...config};
}
