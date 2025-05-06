import { Directionality } from '@angular/cdk/bidi';
import { A, ESCAPE } from '@angular/cdk/keycodes';
import { OverlayContainer, ScrollStrategy } from '@angular/cdk/overlay';
import { ViewportRuler } from '@angular/cdk/scrolling';
import { Location } from '@angular/common';
import { SpyLocation } from '@angular/common/testing';
import { Component, Directive, Inject, Injector, NgModule, TemplateRef, ViewChild, ViewContainerRef, } from '@angular/core';
import { ComponentFixture, fakeAsync, flush, flushMicrotasks, inject, TestBed, tick, } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_RIGHT_SHEET_DEFAULT_OPTIONS, MatRightSheet } from './right-sheet';
import { MAT_RIGHT_SHEET_DATA, MatRightSheetConfig } from './right-sheet.config';
import { MatRightSheetModule } from './right-sheet.module';
import { MatRightSheetRef } from './right-sheet.ref';

/** Modifier keys that may be held while typing. */
export interface ModifierKeys {
  control?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * Defines a readonly property on the given event object. Readonly properties on an event object
 * are always set as configurable as that matches default readonly properties for DOM event objects.
 */
function defineReadonlyEventProperty(event: Event, propertyName: string, value: any) {
  Object.defineProperty(event, propertyName, {get: () => value, configurable: true});
}

/**
 * Creates a keyboard event with the specified key and modifiers.
 * @docs-private
 */
export function createKeyboardEvent(type: string, keyCode: number = 0, key: string = '',
                                    modifiers: ModifierKeys = {}) {
  const event = document.createEvent('KeyboardEvent');
  const originalPreventDefault = event.preventDefault.bind(event);

  // Firefox does not support `initKeyboardEvent`, but supports `initKeyEvent`.
  // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/initKeyEvent.
  if ((event as any).initKeyEvent !== undefined) {
    (event as any).initKeyEvent(type, true, true, window, modifiers.control, modifiers.alt,
      modifiers.shift, modifiers.meta, keyCode);
  } else {
    // `initKeyboardEvent` expects to receive modifiers as a whitespace-delimited string
    // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/initKeyboardEvent
    let modifiersList = '';

    if (modifiers.control) {
      modifiersList += 'Control ';
    }

    if (modifiers.alt) {
      modifiersList += 'Alt ';
    }

    if (modifiers.shift) {
      modifiersList += 'Shift ';
    }

    if (modifiers.meta) {
      modifiersList += 'Meta ';
    }

    // TS3.6 removed the `initKeyboardEvent` method and suggested porting to
    // `new KeyboardEvent()` constructor. We cannot use that as we support IE11.
    // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/initKeyboardEvent.
    (event as any).initKeyboardEvent(type,
      true, /* canBubble */
      true, /* cancelable */
      window, /* view */
      0, /* char */
      key, /* key */
      0, /* location */
      modifiersList.trim(), /* modifiersList */
      false /* repeat */);
  }

  // Webkit Browsers don't set the keyCode when calling the init function.
  // See related bug https://bugs.webkit.org/show_bug.cgi?id=16735
  defineReadonlyEventProperty(event, 'keyCode', keyCode);
  defineReadonlyEventProperty(event, 'key', key);
  defineReadonlyEventProperty(event, 'ctrlKey', !!modifiers.control);
  defineReadonlyEventProperty(event, 'altKey', !!modifiers.alt);
  defineReadonlyEventProperty(event, 'shiftKey', !!modifiers.shift);
  defineReadonlyEventProperty(event, 'metaKey', !!modifiers.meta);

  // IE won't set `defaultPrevented` on synthetic events so we need to do it manually.
  // tslint:disable-next-line:only-arrow-functions
  event.preventDefault = function() {
    defineReadonlyEventProperty(event, 'defaultPrevented', true);
    return originalPreventDefault();
  };

  return event;
}

/**
 * Utility to dispatch any event on a Node.
 * @docs-private
 */
export function dispatchEvent<T extends Event>(node: Node | Window, event: T): T {
  node.dispatchEvent(event);
  return event;
}

/**
 * Shorthand to dispatch a keyboard event with a specified key code and
 * optional modifiers.
 * @docs-private
 */
export function dispatchKeyboardEvent(node: Node, type: string, keyCode?: number, key?: string,
                                      modifiers?: ModifierKeys): KeyboardEvent {
  return dispatchEvent(node, createKeyboardEvent(type, keyCode, key, modifiers));
}

describe('MatRightSheet', () => {
  let rightSheet: MatRightSheet;
  let overlayContainer: OverlayContainer;
  let overlayContainerElement: HTMLElement;
  let viewportRuler: ViewportRuler;

  let testViewContainerRef: ViewContainerRef;
  let viewContainerFixture: ComponentFixture<ComponentWithChildViewContainer>;
  let mockLocation: SpyLocation;

  beforeEach(fakeAsync(() => {
    TestBed.configureTestingModule({
      imports: [MatRightSheetModule, RightSheetTestModule],
      providers: [{provide: Location, useClass: SpyLocation}],
    }).compileComponents();
  }));

  beforeEach(inject(
    [MatRightSheet, OverlayContainer, ViewportRuler, Location],
    (
      bs: MatRightSheet,
      oc: OverlayContainer,
      vr: ViewportRuler,
      l: Location,
    ) => {
      rightSheet = bs;
      overlayContainer = oc;
      viewportRuler = vr;
      overlayContainerElement = oc.getContainerElement();
      mockLocation = l as SpyLocation;
    },
  ));

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  beforeEach(() => {
    viewContainerFixture = TestBed.createComponent(
      ComponentWithChildViewContainer,
    );

    viewContainerFixture.detectChanges();
    testViewContainerRef =
      viewContainerFixture.componentInstance.childViewContainer;
  });

  it('should open a right sheet with a component', () => {
    const rightSheetRef = rightSheet.open(PizzaMsg, {
      viewContainerRef: testViewContainerRef,
    });

    viewContainerFixture.detectChanges();

    expect(overlayContainerElement.textContent).toContain('Pizza');
    expect(rightSheetRef.instance instanceof PizzaMsg).toBe(true);
    // @ts-ignore
    expect(rightSheetRef.instance.rightSheetRef).toBe(rightSheetRef);
  });

  it('should open a right sheet with a template', () => {
    const templateRefFixture = TestBed.createComponent(
      ComponentWithTemplateRef,
    );
    templateRefFixture.componentInstance.localValue = 'Bees';
    templateRefFixture.detectChanges();

    const bottomSheetRef = rightSheet.open(
      templateRefFixture.componentInstance.templateRef,
      {
        data: {value: 'Knees'},
      },
    );

    viewContainerFixture.detectChanges();

    expect(overlayContainerElement.textContent).toContain(
      'Cheese Bees Knees',
    );
    // @ts-ignore
    expect(templateRefFixture.componentInstance.rightSheetRef).toBe(
      bottomSheetRef,
    );
  });

  /**
   * @todo this is different for right sheet
   */
  xit('should position the right sheet at the right of the screen', () => {
    rightSheet.open(PizzaMsg, {viewContainerRef: testViewContainerRef});

    viewContainerFixture.detectChanges();

    // tslint:disable-next-line: no-non-null-assertion
    const containerElement = overlayContainerElement.querySelector(
      'mat-right-sheet-container',
    )!;
    const containerRect = containerElement.getBoundingClientRect();
    const viewportSize = viewportRuler.getViewportSize();

    expect(Math.floor(containerRect.right)).toBe(
      Math.floor(viewportSize.width),
    );
    expect(Math.floor(containerRect.top)).toBe(0);
    expect(Math.floor(containerRect.bottom)).toBe(viewportSize.height);
    expect(Math.floor(containerRect.height)).toBe(viewportSize.height);
  });

  it('should emit when the bottom sheet opening animation is complete', fakeAsync(() => {
    const bottomSheetRef = rightSheet.open(PizzaMsg, {
      viewContainerRef: testViewContainerRef,
    });
    const spy = jasmine.createSpy('afterOpened spy');

    bottomSheetRef.afterOpened().subscribe(spy);
    viewContainerFixture.detectChanges();

    // callback should not be called before animation is complete
    expect(spy).not.toHaveBeenCalled();

    flushMicrotasks();
    expect(spy).toHaveBeenCalled();
  }));

  it('should use the correct injector', () => {
    const rightSheetRef = rightSheet.open(PizzaMsg, {
      viewContainerRef: testViewContainerRef,
    });
    viewContainerFixture.detectChanges();
    const injector = rightSheetRef.instance.injector;

    expect(rightSheetRef.instance.rightSheetRef).toBe(rightSheetRef);
    expect(
      injector.get<DirectiveWithViewContainer>(
        DirectiveWithViewContainer,
      ),
    ).toBeTruthy();
  });

  it('should open a right sheet with a component and no ViewContainerRef', () => {
    const rightSheetRef = rightSheet.open(PizzaMsg);

    viewContainerFixture.detectChanges();

    expect(overlayContainerElement.textContent).toContain('Pizza');
    expect(rightSheetRef.instance instanceof PizzaMsg).toBe(true);
    // @ts-ignore
    expect(rightSheetRef.instance.rightSheetRef).toBe(rightSheetRef);
  });

  it('should apply the correct role to the container element', () => {
    rightSheet.open(PizzaMsg);

    viewContainerFixture.detectChanges();

    // tslint:disable-next-line: no-non-null-assertion
    const containerElement = overlayContainerElement.querySelector(
      'mat-right-sheet-container',
    )!;
    expect(containerElement.getAttribute('role')).toBe('dialog');
  });

  it('should close a right sheet via the escape key', fakeAsync(() => {
    rightSheet.open(PizzaMsg, {viewContainerRef: testViewContainerRef});

    const event = dispatchKeyboardEvent(document.body, 'keydown', ESCAPE);
    viewContainerFixture.detectChanges();
    flush();

    expect(
      overlayContainerElement.querySelector('mat-right-sheet-container'),
    ).toBeNull();
    expect(event.defaultPrevented).toBe(true);
  }));

  it('should not close a right sheet via the escape key with a modifier', fakeAsync(() => {
    rightSheet.open(PizzaMsg, {viewContainerRef: testViewContainerRef});

    const event = createKeyboardEvent('keydown', ESCAPE, undefined, {alt: true});
    dispatchEvent(document.body, event);
    viewContainerFixture.detectChanges();
    flush();

    expect(overlayContainerElement.querySelector('mat-right-sheet-container')).toBeTruthy();
    expect(event.defaultPrevented).toBe(false);
  }));

  it('should close when clicking on the overlay backdrop', fakeAsync(() => {
    rightSheet.open(PizzaMsg, {
      viewContainerRef: testViewContainerRef,
    });

    viewContainerFixture.detectChanges();

    const backdrop = overlayContainerElement.querySelector(
      '.cdk-overlay-backdrop',
    ) as HTMLElement;

    backdrop.click();
    viewContainerFixture.detectChanges();
    flush();

    expect(
      overlayContainerElement.querySelector('mat-right-sheet-container'),
    ).toBeFalsy();
  }));

  it('should emit the backdropClick stream when clicking on the overlay backdrop', fakeAsync(() => {
    const rightSheetRef = rightSheet.open(PizzaMsg, {
      viewContainerRef: testViewContainerRef,
    });
    const spy = jasmine.createSpy('backdropClick spy');

    rightSheetRef.backdropClick().subscribe(spy);
    viewContainerFixture.detectChanges();

    const backdrop = overlayContainerElement.querySelector(
      '.cdk-overlay-backdrop',
    ) as HTMLElement;

    backdrop.click();
    expect(spy).toHaveBeenCalledTimes(1);

    viewContainerFixture.detectChanges();
    flush();

    // Additional clicks after the bottom sheet was closed should not be emitted
    backdrop.click();
    expect(spy).toHaveBeenCalledTimes(1);
  }));

  it('should emit the keyboardEvent stream when key events target the overlay', fakeAsync(() => {
    const rightSheetRef = rightSheet.open(PizzaMsg, {viewContainerRef: testViewContainerRef});
    const spy = jasmine.createSpy('keyboardEvent spy');

    rightSheetRef.keydownEvents().subscribe(spy);
    viewContainerFixture.detectChanges();

    const backdrop = overlayContainerElement.querySelector('.cdk-overlay-backdrop') as HTMLElement;
    const container =
      overlayContainerElement.querySelector('mat-right-sheet-container') as HTMLElement;
    dispatchKeyboardEvent(document.body, 'keydown', A);
    dispatchKeyboardEvent(backdrop, 'keydown', A);
    dispatchKeyboardEvent(container, 'keydown', A);

    expect(spy).toHaveBeenCalledTimes(3);
  }));

  it('should allow setting the layout direction', () => {
    rightSheet.open(PizzaMsg, {direction: 'rtl'});

    viewContainerFixture.detectChanges();

    // tslint:disable-next-line: no-non-null-assertion
    const overlayPane = overlayContainerElement.querySelector(
      '.cdk-global-overlay-wrapper',
    )!;

    expect(overlayPane.getAttribute('dir')).toBe('rtl');
  });

  it('should inject the correct direction in the instantiated component', () => {
    const rightSheetRef = rightSheet.open(PizzaMsg, {direction: 'rtl'});

    viewContainerFixture.detectChanges();

    expect(rightSheetRef.instance.directionality.value).toBe('rtl');
  });

  it('should fall back to injecting the global direction if none is passed by the config', () => {
    const rightSheetRef = rightSheet.open(PizzaMsg, {});

    viewContainerFixture.detectChanges();

    expect(rightSheetRef.instance.directionality.value).toBe('ltr');
  });

  it('should be able to set a custom panel class', () => {
    rightSheet.open(PizzaMsg, {
      panelClass: 'custom-panel-class',
      viewContainerRef: testViewContainerRef,
    });

    viewContainerFixture.detectChanges();

    expect(
      overlayContainerElement.querySelector('.custom-panel-class'),
    ).toBeTruthy();
  });

  it('should be able to set a custom aria-label', () => {
    rightSheet.open(PizzaMsg, {
      ariaLabel: 'Hello there',
      viewContainerRef: testViewContainerRef,
    });
    viewContainerFixture.detectChanges();

    // tslint:disable-next-line: no-non-null-assertion
    const container = overlayContainerElement.querySelector(
      'mat-right-sheet-container',
    )!;
    expect(container.getAttribute('aria-label')).toBe('Hello there');
  });

  it('should be able to get dismissed through the service', fakeAsync(() => {
    rightSheet.open(PizzaMsg);
    viewContainerFixture.detectChanges();
    expect(overlayContainerElement.childElementCount).toBeGreaterThan(0);

    rightSheet.dismiss();
    viewContainerFixture.detectChanges();
    flush();

    expect(overlayContainerElement.childElementCount).toBe(0);
  }));

  it('should dismiss the bottom sheet when the service is destroyed', fakeAsync(() => {
    rightSheet.open(PizzaMsg);
    viewContainerFixture.detectChanges();
    expect(overlayContainerElement.childElementCount).toBeGreaterThan(0);

    rightSheet.ngOnDestroy();
    viewContainerFixture.detectChanges();
    flush();

    expect(overlayContainerElement.childElementCount).toBe(0);
  }));

  it('should open a new bottom sheet after dismissing a previous sheet', fakeAsync(() => {
    const config: MatRightSheetConfig = {
      viewContainerRef: testViewContainerRef,
    };
    let rightSheetRef: MatRightSheetRef<any> = rightSheet.open(
      PizzaMsg,
      config,
    );

    viewContainerFixture.detectChanges();

    rightSheetRef.dismiss();
    viewContainerFixture.detectChanges();

    // Wait for the dismiss animation to finish.
    flush();
    rightSheetRef = rightSheet.open(TacoMsg, config);
    viewContainerFixture.detectChanges();

    // Wait for the open animation to finish.
    flush();
    expect(rightSheetRef.containerInstance._animationState).toBe(
      'visible',
      `Expected the animation state would be 'visible'.`,
    );
  }));

  it('should remove past bottom sheets when opening new ones', fakeAsync(() => {
    rightSheet.open(PizzaMsg);
    viewContainerFixture.detectChanges();

    rightSheet.open(TacoMsg);
    viewContainerFixture.detectChanges();
    flush();

    expect(overlayContainerElement.textContent).toContain('Taco');
  }));

  it('should not throw when opening multiple bottom sheet in quick succession', fakeAsync(() => {
    expect(() => {
      for (let i = 0; i < 3; i++) {
        rightSheet.open(PizzaMsg);
        viewContainerFixture.detectChanges();
      }

      flush();
    }).not.toThrow();
  }));

  it('should remove bottom sheet if another is shown while its still animating open', fakeAsync(() => {
    rightSheet.open(PizzaMsg);
    viewContainerFixture.detectChanges();

    rightSheet.open(TacoMsg);
    viewContainerFixture.detectChanges();

    tick();
    expect(overlayContainerElement.textContent).toContain('Taco');
    tick(500);
  }));

  it('should emit after being dismissed', fakeAsync(() => {
    const rightSheetRef = rightSheet.open(PizzaMsg);
    const spy = jasmine.createSpy('afterDismissed spy');

    rightSheetRef.afterDismissed().subscribe(spy);
    viewContainerFixture.detectChanges();

    rightSheetRef.dismiss();
    viewContainerFixture.detectChanges();
    flush();

    expect(spy).toHaveBeenCalledTimes(1);
  }));

  it('should be able to pass a result back to the dismissed stream', fakeAsync(() => {
    const rightSheetRef = rightSheet.open<PizzaMsg, any, number>(PizzaMsg);
    const spy = jasmine.createSpy('afterDismissed spy');

    rightSheetRef.afterDismissed().subscribe(spy);
    viewContainerFixture.detectChanges();

    rightSheetRef.dismiss(1337);
    viewContainerFixture.detectChanges();
    flush();

    expect(spy).toHaveBeenCalledWith(1337);
  }));

  it('should close the bottom sheet when going forwards/backwards in history', fakeAsync(() => {
    rightSheet.open(PizzaMsg);

    expect(
      overlayContainerElement.querySelector('mat-right-sheet-container'),
    ).toBeTruthy();

    mockLocation.simulateUrlPop('');
    viewContainerFixture.detectChanges();
    flush();

    expect(
      overlayContainerElement.querySelector('mat-right-sheet-container'),
    ).toBeFalsy();
  }));

  it('should close the bottom sheet when the location hash changes', fakeAsync(() => {
    rightSheet.open(PizzaMsg);

    expect(
      overlayContainerElement.querySelector('mat-right-sheet-container'),
    ).toBeTruthy();

    mockLocation.simulateHashChange('');
    viewContainerFixture.detectChanges();
    flush();

    expect(
      overlayContainerElement.querySelector('mat-right-sheet-container'),
    ).toBeFalsy();
  }));

  it('should allow the consumer to disable closing a bottom sheet on navigation', fakeAsync(() => {
    rightSheet.open(PizzaMsg, {closeOnNavigation: false});

    expect(
      overlayContainerElement.querySelector('mat-right-sheet-container'),
    ).toBeTruthy();

    mockLocation.simulateUrlPop('');
    viewContainerFixture.detectChanges();
    flush();

    expect(
      overlayContainerElement.querySelector('mat-right-sheet-container'),
    ).toBeTruthy();
  }));

  it('should be able to attach a custom scroll strategy', fakeAsync(() => {
    const scrollStrategy: ScrollStrategy = {
      attach: () => {
      },
      enable: jasmine.createSpy('scroll strategy enable spy'),
      disable: () => {
      }
    };

    rightSheet.open(PizzaMsg, {scrollStrategy});
    expect(scrollStrategy.enable).toHaveBeenCalled();
  }));

  describe('passing in data', () => {
    it('should be able to pass in data', () => {
      const config = {
        data: {
          stringParam: 'hello',
          dateParam: new Date(),
        },
      };

      const instance = rightSheet.open(
        RightSheetWithInjectedData,
        config,
      ).instance;

      expect(instance.data.stringParam).toBe(config.data.stringParam);
      expect(instance.data.dateParam).toBe(config.data.dateParam);
    });

    it('should default to null if no data is passed', () => {
      expect(() => {
        const bottomSheetRef = rightSheet.open(
          RightSheetWithInjectedData,
        );
        expect(bottomSheetRef.instance.data).toBeNull();
      }).not.toThrow();
    });
  });

  describe('disableClose option', () => {
    it('should prevent closing via clicks on the backdrop', fakeAsync(() => {
      rightSheet.open(PizzaMsg, {
        disableClose: true,
        viewContainerRef: testViewContainerRef,
      });

      viewContainerFixture.detectChanges();

      const backdrop = overlayContainerElement.querySelector(
        '.cdk-overlay-backdrop',
      ) as HTMLElement;
      backdrop.click();
      viewContainerFixture.detectChanges();
      flush();

      expect(
        overlayContainerElement.querySelector(
          'mat-right-sheet-container',
        ),
      ).toBeTruthy();
    }));

    it('should prevent closing via the escape key', fakeAsync(() => {
      rightSheet.open(PizzaMsg, {
        disableClose: true,
        viewContainerRef: testViewContainerRef,
      });

      viewContainerFixture.detectChanges();
      dispatchKeyboardEvent(document.body, 'keydown', ESCAPE);
      viewContainerFixture.detectChanges();
      flush();

      expect(
        overlayContainerElement.querySelector(
          'mat-right-sheet-container',
        ),
      ).toBeTruthy();
    }));

    it('should allow for the disableClose option to be updated while open', fakeAsync(() => {
      const rightSheetRef = rightSheet.open(PizzaMsg, {
        disableClose: true,
        viewContainerRef: testViewContainerRef,
      });

      viewContainerFixture.detectChanges();

      const backdrop = overlayContainerElement.querySelector(
        '.cdk-overlay-backdrop',
      ) as HTMLElement;
      backdrop.click();

      expect(
        overlayContainerElement.querySelector(
          'mat-right-sheet-container',
        ),
      ).toBeTruthy();

      rightSheetRef.disableClose = false;
      backdrop.click();
      viewContainerFixture.detectChanges();
      flush();

      expect(
        overlayContainerElement.querySelector(
          'mat-right-sheet-container',
        ),
      ).toBeFalsy();
    }));
  });

  describe('hasBackdrop option', () => {
    it('should have a backdrop', () => {
      rightSheet.open(PizzaMsg, {
        hasBackdrop: true,
        viewContainerRef: testViewContainerRef,
      });

      viewContainerFixture.detectChanges();

      expect(
        overlayContainerElement.querySelector('.cdk-overlay-backdrop'),
      ).toBeTruthy();
    });

    it('should not have a backdrop', () => {
      rightSheet.open(PizzaMsg, {
        hasBackdrop: false,
        viewContainerRef: testViewContainerRef,
      });

      viewContainerFixture.detectChanges();

      expect(
        overlayContainerElement.querySelector('.cdk-overlay-backdrop'),
      ).toBeFalsy();
    });
  });

  describe('backdropClass option', () => {
    it('should have default backdrop class', () => {
      rightSheet.open(PizzaMsg, {
        backdropClass: '',
        viewContainerRef: testViewContainerRef,
      });

      viewContainerFixture.detectChanges();

      expect(
        overlayContainerElement.querySelector(
          '.cdk-overlay-dark-backdrop',
        ),
      ).toBeTruthy();
    });

    it('should have custom backdrop class', () => {
      rightSheet.open(PizzaMsg, {
        backdropClass: 'custom-backdrop-class',
        viewContainerRef: testViewContainerRef,
      });

      viewContainerFixture.detectChanges();

      expect(
        overlayContainerElement.querySelector('.custom-backdrop-class'),
      ).toBeTruthy();
    });
  });

  describe('focus management', () => {
    // When testing focus, all of the elements must be in the DOM.
    beforeEach(() => document.body.appendChild(overlayContainerElement));
    afterEach(() => document.body.removeChild(overlayContainerElement));

    it('should focus the bottom sheet container by default', fakeAsync(() => {
      rightSheet.open(PizzaMsg, {
        viewContainerRef: testViewContainerRef,
      });

      viewContainerFixture.detectChanges();
      flushMicrotasks();

      // tslint:disable-next-line: no-non-null-assertion
      expect(document.activeElement!.tagName).toBe(
        'MAT-RIGHT-SHEET-CONTAINER',
        'Expected bottom sheet container to be focused.',
      );
    }));

    it('should create a focus trap if autoFocus is disabled', fakeAsync(() => {
      rightSheet.open(PizzaMsg, {
        viewContainerRef: testViewContainerRef,
        autoFocus: false,
      });

      viewContainerFixture.detectChanges();
      flushMicrotasks();

      const focusTrapAnchors = overlayContainerElement.querySelectorAll(
        '.cdk-focus-trap-anchor',
      );

      expect(focusTrapAnchors.length).toBeGreaterThan(0);
    }));

    it(
      'should focus the first tabbable element of the bottom sheet on open when' +
      'autoFocus is enabled',
      fakeAsync(() => {
        rightSheet.open(PizzaMsg, {
          viewContainerRef: testViewContainerRef,
          autoFocus: true,
        });

        viewContainerFixture.detectChanges();
        flushMicrotasks();

        // tslint:disable-next-line: no-non-null-assertion
        expect(document.activeElement!.tagName).toBe(
          'INPUT',
          'Expected first tabbable element (input) in the sheet to be focused.',
        );
      }),
    );

    it('should allow disabling focus of the first tabbable element', fakeAsync(() => {
      rightSheet.open(PizzaMsg, {
        viewContainerRef: testViewContainerRef,
        autoFocus: false,
      });

      viewContainerFixture.detectChanges();
      flushMicrotasks();

      // tslint:disable-next-line: no-non-null-assertion
      expect(document.activeElement!.tagName).not.toBe('INPUT');
    }));

    it('should re-focus trigger element when bottom sheet closes', fakeAsync(() => {
      const button = document.createElement('button');
      button.id = 'bottom-sheet-trigger';
      document.body.appendChild(button);
      button.focus();

      const rightSheetRef = rightSheet.open(PizzaMsg, {
        viewContainerRef: testViewContainerRef,
      });

      flushMicrotasks();
      viewContainerFixture.detectChanges();
      flushMicrotasks();

      // tslint:disable-next-line: no-non-null-assertion
      expect(document.activeElement!.id).not.toBe(
        'bottom-sheet-trigger',
        'Expected the focus to change when sheet was opened.',
      );

      rightSheetRef.dismiss();
      // tslint:disable-next-line: no-non-null-assertion
      expect(document.activeElement!.id).not.toBe(
        'bottom-sheet-trigger',
        'Expcted the focus not to have changed before the animation finishes.',
      );

      flushMicrotasks();
      viewContainerFixture.detectChanges();
      tick(500);

      // tslint:disable-next-line: no-non-null-assertion
      expect(document.activeElement!.id).toBe(
        'bottom-sheet-trigger',
        'Expected that the trigger was refocused after the sheet is closed.',
      );

      document.body.removeChild(button);
    }));

    it('should be able to disable focus restoration', fakeAsync(() => {
      const button = document.createElement('button');
      button.id = 'bottom-sheet-trigger';
      document.body.appendChild(button);
      button.focus();

      const bottomSheetRef = rightSheet.open(PizzaMsg, {
        viewContainerRef: testViewContainerRef,
        restoreFocus: false,
      });

      flushMicrotasks();
      viewContainerFixture.detectChanges();
      flushMicrotasks();

      // tslint:disable-next-line: no-non-null-assertion
      expect(document.activeElement!.id).not.toBe(
        'bottom-sheet-trigger',
        'Expected the focus to change when sheet was opened.',
      );

      bottomSheetRef.dismiss();
      // tslint:disable-next-line: no-non-null-assertion
      expect(document.activeElement!.id).not.toBe(
        'bottom-sheet-trigger',
        'Expcted the focus not to have changed before the animation finishes.',
      );

      flushMicrotasks();
      viewContainerFixture.detectChanges();
      tick(500);

      // tslint:disable-next-line: no-non-null-assertion
      expect(document.activeElement!.id).not.toBe(
        'bottom-sheet-trigger',
        'Expected the trigger not to be refocused on close.',
      );

      document.body.removeChild(button);
    }));
  });
});

describe('MatRightSheet with parent MatRightSheet', () => {
  let parentBottomSheet: MatRightSheet;
  let childBottomSheet: MatRightSheet;
  let overlayContainer: OverlayContainer;
  let overlayContainerElement: HTMLElement;
  let fixture: ComponentFixture<ComponentThatProvidesMatBottomSheet>;

  beforeEach(fakeAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        MatRightSheetModule,
        RightSheetTestModule,
        NoopAnimationsModule,
      ],
      declarations: [ComponentThatProvidesMatBottomSheet],
    }).compileComponents();
  }));

  beforeEach(inject(
    [MatRightSheet, OverlayContainer],
    (bs: MatRightSheet, oc: OverlayContainer) => {
      parentBottomSheet = bs;
      overlayContainer = oc;
      overlayContainerElement = oc.getContainerElement();
      fixture = TestBed.createComponent(
        ComponentThatProvidesMatBottomSheet,
      );
      childBottomSheet = fixture.componentInstance.rightSheet;
      fixture.detectChanges();
    },
  ));

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('should close bottom sheets opened by parent when opening from child', fakeAsync(() => {
    parentBottomSheet.open(PizzaMsg);
    fixture.detectChanges();
    tick(1000);

    expect(overlayContainerElement.textContent).toContain(
      'Pizza',
      'Expected a bottom sheet to be opened',
    );

    childBottomSheet.open(TacoMsg);
    fixture.detectChanges();
    tick(1000);

    expect(overlayContainerElement.textContent).toContain(
      'Taco',
      'Expected parent bottom sheet to be dismissed by opening from child',
    );
  }));

  it('should close bottom sheets opened by child when opening from parent', fakeAsync(() => {
    childBottomSheet.open(PizzaMsg);
    fixture.detectChanges();
    tick(1000);

    expect(overlayContainerElement.textContent).toContain(
      'Pizza',
      'Expected a bottom sheet to be opened',
    );

    parentBottomSheet.open(TacoMsg);
    fixture.detectChanges();
    tick(1000);

    expect(overlayContainerElement.textContent).toContain(
      'Taco',
      'Expected child bottom sheet to be dismissed by opening from parent',
    );
  }));

  it('should not close parent bottom sheet when child is destroyed', fakeAsync(() => {
    parentBottomSheet.open(PizzaMsg);
    fixture.detectChanges();
    tick(1000);

    expect(overlayContainerElement.textContent).toContain(
      'Pizza',
      'Expected a bottom sheet to be opened',
    );

    childBottomSheet.ngOnDestroy();
    fixture.detectChanges();
    tick(1000);

    expect(overlayContainerElement.textContent).toContain(
      'Pizza',
      'Expected a bottom sheet to stay open',
    );
  }));
});

describe('MatRightSheet with default options', () => {
  let rightSheet: MatRightSheet;
  let overlayContainer: OverlayContainer;
  let overlayContainerElement: HTMLElement;

  let testViewContainerRef: ViewContainerRef;
  let viewContainerFixture: ComponentFixture<ComponentWithChildViewContainer>;

  beforeEach(fakeAsync(() => {
    const defaultConfig: MatRightSheetConfig = {
      hasBackdrop: false,
      disableClose: true,
      autoFocus: false,
    };

    TestBed.configureTestingModule({
      imports: [MatRightSheetModule, RightSheetTestModule],
      providers: [
        {
          provide: MAT_RIGHT_SHEET_DEFAULT_OPTIONS,
          useValue: defaultConfig,
        },
      ],
    });

    TestBed.compileComponents();
  }));

  beforeEach(inject(
    [MatRightSheet, OverlayContainer],
    (b: MatRightSheet, oc: OverlayContainer) => {
      rightSheet = b;
      overlayContainer = oc;
      overlayContainerElement = oc.getContainerElement();
    },
  ));

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  beforeEach(() => {
    viewContainerFixture = TestBed.createComponent(
      ComponentWithChildViewContainer,
    );

    viewContainerFixture.detectChanges();
    testViewContainerRef =
      viewContainerFixture.componentInstance.childViewContainer;
  });

  it('should use the provided defaults', () => {
    rightSheet.open(PizzaMsg, {viewContainerRef: testViewContainerRef});

    viewContainerFixture.detectChanges();

    expect(
      overlayContainerElement.querySelector('.cdk-overlay-backdrop'),
    ).toBeFalsy();

    dispatchKeyboardEvent(document.body, 'keydown', ESCAPE);

    expect(
      overlayContainerElement.querySelector('mat-right-sheet-container'),
    ).toBeTruthy();
    // tslint:disable-next-line: no-non-null-assertion
    expect(document.activeElement!.tagName).not.toBe('INPUT');
  });

  it('should be overridable by open() options', fakeAsync(() => {
    rightSheet.open(PizzaMsg, {
      hasBackdrop: true,
      disableClose: false,
      viewContainerRef: testViewContainerRef,
    });

    viewContainerFixture.detectChanges();

    expect(
      overlayContainerElement.querySelector('.cdk-overlay-backdrop'),
    ).toBeTruthy();

    dispatchKeyboardEvent(document.body, 'keydown', ESCAPE);
    viewContainerFixture.detectChanges();
    flush();

    expect(
      overlayContainerElement.querySelector('mat-right-sheet-container'),
    ).toBeFalsy();
  }));


  it('should not move focus if it was moved outside the sheet while animating', fakeAsync(() => {
    // Create a element that has focus before the bottom sheet is opened.
    const button = document.createElement('button');
    const otherButton = document.createElement('button');
    const body = document.body;
    button.id = 'bottom-sheet-trigger';
    otherButton.id = 'other-button';
    body.appendChild(button);
    body.appendChild(otherButton);
    button.focus();

    const rightSheetRef = rightSheet.open(PizzaMsg, {viewContainerRef: testViewContainerRef});

    flushMicrotasks();
    viewContainerFixture.detectChanges();
    flushMicrotasks();

    // tslint:disable-next-line:no-non-null-assertion
    expect(document.activeElement!.id).not.toBe('bottom-sheet-trigger',
      'Expected the focus to change when the bottom sheet was opened.');

    // Start the closing sequence and move focus out of bottom sheet.
    rightSheetRef.dismiss();
    otherButton.focus();

    // tslint:disable-next-line:no-non-null-assertion
    expect(document.activeElement!.id)
      .toBe('other-button', 'Expected focus to be on the alternate button.');

    flushMicrotasks();
    viewContainerFixture.detectChanges();
    flush();

    // tslint:disable-next-line:no-non-null-assertion
    expect(document.activeElement!.id)
      .toBe('other-button', 'Expected focus to stay on the alternate button.');

    body.removeChild(button);
    body.removeChild(otherButton);

  }));
});

/* tslint:disable */
@Directive({
    selector: 'dir-with-view-container',
    standalone: false
})
class DirectiveWithViewContainer {
  constructor(public viewContainerRef: ViewContainerRef) {
  }
}

@Component({
    template: `
        <dir-with-view-container></dir-with-view-container>
    `,
    standalone: false
})
class ComponentWithChildViewContainer {
  @ViewChild(DirectiveWithViewContainer, {static: true})
  public childWithViewContainer: DirectiveWithViewContainer;

  get childViewContainer() {
    return this.childWithViewContainer.viewContainerRef;
  }
}

@Component({
    selector: 'arbitrary-component-with-template-ref',
    template: `
    <ng-template let-data let-rightSheetRef="rightSheetRef">
      Cheese {{ localValue }} {{ data?.value
      }}{{ setRef(rightSheetRef) }}</ng-template
    >
  `,
    standalone: false
})
class ComponentWithTemplateRef {
  public localValue: string;
  public rightSheetRef: MatRightSheetRef<any>;

  @ViewChild(TemplateRef) public templateRef: TemplateRef<any>;

  public setRef(rightSheetRef: MatRightSheetRef<any>): string {
    this.rightSheetRef = rightSheetRef;
    return '';
  }
}

@Component({
    template: '<p>Pizza</p> <input> <button>Close</button>',
    standalone: false
})
class PizzaMsg {
  constructor(
    public rightSheetRef: MatRightSheetRef<PizzaMsg>,
    public injector: Injector,
    public directionality: Directionality,
  ) {
  }
}

@Component({
    template: '<p>Taco</p>',
    standalone: false
})
class TacoMsg {
}

@Component({
    template: '',
    providers: [MatRightSheet],
    standalone: false
})
class ComponentThatProvidesMatBottomSheet {
  constructor(public rightSheet: MatRightSheet) {
  }
}

@Component({
    template: '',
    standalone: false
})
class RightSheetWithInjectedData {
  constructor(@Inject(MAT_RIGHT_SHEET_DATA) public data: any) {
  }
}

// Create a real (non-test) NgModule as a workaround for
// https://github.com/angular/angular/issues/10760
const TEST_DIRECTIVES = [
  ComponentWithChildViewContainer,
  ComponentWithTemplateRef,
  PizzaMsg,
  TacoMsg,
  DirectiveWithViewContainer,
  RightSheetWithInjectedData,
];

@NgModule({
    imports: [MatRightSheetModule, NoopAnimationsModule],
    exports: TEST_DIRECTIVES,
    declarations: TEST_DIRECTIVES
})
class RightSheetTestModule {
}
