//! Centres the macOS traffic lights in our 44pt title bar.
//!
//! AppKit lays the three buttons out again whenever it rebuilds the title bar: on every step of a live resize,
//! on focus and Space changes, when the theme or display changes. Correcting them afterwards from a Tauri event
//! or a timer always lets at least one frame through at AppKit's position, which is the "jumping". Instead we
//! listen to `NSViewFrameDidChangeNotification` on the buttons and their ancestors: AppKit posts it synchronously
//! from inside its own layout, so the buttons are put back before anything is drawn.
//!
//! AppKit occasionally moves a button without posting that notification (e.g. when the screen-sharing indicator
//! goes away), so a run-loop observer that fires just before Core Animation commits re-checks every pass too.
//!
//! The buttons are moved into a view of ours and that view is positioned, which keeps them clickable on macOS 27
//! where moving them inside AppKit's title bar did not. In full screen the buttons live in the menu-bar reveal and
//! are left alone.

use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::ffi::c_void;

use objc2::rc::{Retained, Weak};
use objc2::runtime::{AnyObject, NSObject};
use objc2::{define_class, msg_send, sel, ClassType, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{
    NSAutoresizingMaskOptions, NSButton, NSView, NSViewFrameDidChangeNotification, NSWindow, NSWindowButton,
    NSWindowDidBecomeKeyNotification, NSWindowDidBecomeMainNotification,
    NSWindowDidChangeBackingPropertiesNotification, NSWindowDidChangeOcclusionStateNotification,
    NSWindowDidChangeScreenNotification, NSWindowDidDeminiaturizeNotification,
    NSWindowDidEndLiveResizeNotification, NSWindowDidExitFullScreenNotification,
    NSWindowDidResignKeyNotification, NSWindowDidResignMainNotification, NSWindowDidResizeNotification,
    NSWindowStyleMask,
};
use objc2_core_foundation::{
    kCFRunLoopCommonModes, CFIndex, CFRetained, CFRunLoop, CFRunLoopActivity, CFRunLoopObserver,
};
use objc2_foundation::{NSNotification, NSNotificationCenter, NSNotificationName, NSPoint, NSRect, NSSize};

/// Matches `h-11` on `TitleBar` and the welcome screen's top bar.
pub const TITLEBAR_HEIGHT: f64 = 44.0;

/// Distance between the buttons' left edges.
const BUTTON_STRIDE: f64 = 20.0;

/// The close button's left edge.
const BUTTONS_LEFT: f64 = 15.0;

const MAX_PASSES: usize = 8;

pub struct Ivars {
    window: Weak<NSWindow>,
    busy: Cell<bool>,
    dirty: Cell<bool>,
    observed: RefCell<Vec<Retained<NSView>>>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "DiffityTrafficLights"]
    #[ivars = Ivars]
    pub struct TrafficLights;

    impl TrafficLights {
        #[unsafe(method(relayout:))]
        fn relayout(&self, _notification: &NSNotification) {
            self.arrange();
        }
    }
);

thread_local! {
    static INSTALLED: RefCell<HashMap<String, Retained<TrafficLights>>> = RefCell::new(HashMap::new());
    static RUN_LOOP_OBSERVER: RefCell<Option<CFRetained<CFRunLoopObserver>>> = const { RefCell::new(None) };
}

/// After AppKit's layout/display observers, before Core Animation's commit (2_000_000).
const RUN_LOOP_ORDER: CFIndex = 1_999_900;

unsafe extern "C-unwind" fn before_commit(
    _observer: *mut CFRunLoopObserver,
    _activity: CFRunLoopActivity,
    _info: *mut c_void,
) {
    let all: Vec<_> = INSTALLED.with(|installed| installed.borrow().values().cloned().collect());
    for lights in all {
        lights.arrange();
    }
}

fn observe_run_loop() {
    RUN_LOOP_OBSERVER.with(|slot| {
        if slot.borrow().is_some() {
            return;
        }
        let observer = unsafe {
            CFRunLoopObserver::new(
                None,
                CFRunLoopActivity::BeforeWaiting.0,
                true,
                RUN_LOOP_ORDER,
                Some(before_commit),
                std::ptr::null_mut(),
            )
        };
        let (Some(observer), Some(main)) = (observer, CFRunLoop::main()) else {
            return;
        };
        main.add_observer(Some(&observer), unsafe { kCFRunLoopCommonModes });
        *slot.borrow_mut() = Some(observer);
    });
}

impl TrafficLights {
    fn new(mtm: MainThreadMarker, window: &NSWindow) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(Ivars {
            window: Weak::new(window),
            busy: Cell::new(false),
            dirty: Cell::new(false),
            observed: RefCell::new(Vec::new()),
        });
        unsafe { msg_send![super(this), init] }
    }

    /// Our own `setFrame:` can make AppKit move another button from inside the notification we're handling, so a
    /// change that arrives mid-pass triggers another pass (bounded, in case AppKit ever insists).
    fn arrange(&self) {
        let ivars = self.ivars();
        ivars.dirty.set(true);
        if ivars.busy.replace(true) {
            return;
        }
        let Some(window) = ivars.window.load() else {
            ivars.busy.set(false);
            return;
        };
        for _ in 0..MAX_PASSES {
            if !ivars.dirty.replace(false) {
                break;
            }
            let buttons = buttons(&window);
            if buttons.len() != 3 {
                break;
            }
            place(self.mtm(), &window, &buttons);
            self.observe_views(&buttons);
        }
        ivars.dirty.set(false);
        ivars.busy.set(false);
    }

    /// Subscribes to frame changes of the buttons and every view above them. Re-run on each pass because AppKit
    /// sometimes swaps in new buttons or a new title bar view.
    fn observe_views(&self, buttons: &[Retained<NSButton>]) {
        let mut views: Vec<Retained<NSView>> = buttons
            .iter()
            .map(|button| Retained::into_super(Retained::into_super(button.clone())))
            .collect();
        let mut parent = unsafe { buttons[0].superview() };
        while let Some(view) = parent {
            parent = unsafe { view.superview() };
            views.push(view);
        }

        let mut observed = self.ivars().observed.borrow_mut();
        if observed.len() == views.len() && observed.iter().zip(&views).all(|(a, b)| same(a, b)) {
            return;
        }

        let center = NSNotificationCenter::defaultCenter();
        let name = unsafe { NSViewFrameDidChangeNotification };
        for view in observed.iter() {
            unsafe { center.removeObserver_name_object(self, Some(name), Some(view)) };
        }
        for view in &views {
            view.setPostsFrameChangedNotifications(true);
            self.observe(&center, name, Some(view));
        }
        *observed = views;
    }

    fn observe(&self, center: &NSNotificationCenter, name: &NSNotificationName, object: Option<&AnyObject>) {
        unsafe { center.addObserver_selector_name_object(self, sel!(relayout:), Some(name), object) };
    }
}

fn buttons(window: &NSWindow) -> Vec<Retained<NSButton>> {
    [
        NSWindowButton::CloseButton,
        NSWindowButton::MiniaturizeButton,
        NSWindowButton::ZoomButton,
    ]
    .into_iter()
    .filter_map(|kind| window.standardWindowButton(kind))
    .collect()
}

fn place(mtm: MainThreadMarker, window: &NSWindow, buttons: &[Retained<NSButton>]) {
    if window.styleMask().contains(NSWindowStyleMask::FullScreen) {
        return;
    }
    let Some(holder) = holder(mtm, buttons) else {
        return;
    };
    let Some(titlebar) = (unsafe { holder.superview() }) else {
        return;
    };

    let window_height = window.frame().size.height;
    let size = buttons[0].frame().size;
    for (index, button) in buttons.iter().enumerate() {
        let wanted = NSRect::new(NSPoint::new(BUTTON_STRIDE * index as f64, 0.0), size);
        if !rect_eq(button.frame(), wanted) {
            button.setFrame(wanted);
        }
    }

    let margin = (TITLEBAR_HEIGHT - size.height) / 2.0;
    let in_window = NSRect::new(
        NSPoint::new(BUTTONS_LEFT, window_height - margin - size.height),
        NSSize::new(BUTTON_STRIDE * (buttons.len() - 1) as f64 + size.width, size.height),
    );
    contain(&titlebar, in_window);
    let wanted = titlebar.convertRect_fromView(in_window, None);
    if !rect_eq(holder.frame(), wanted) {
        holder.setFrame(wanted);
    }

    center_strays(&titlebar, &holder, window_height);
}

/// A plain view of ours holding the three buttons, which is what gets moved. When AppKit rebuilds the title bar it takes the buttons back,
/// so the emptied holder is dropped and a new one made; AppKit never puts a plain NSView in a title bar itself.
/// AppKit also lays the buttons out again inside the holder (e.g. after un-minimising), so `place` sets their
/// frames there every pass.
fn holder(mtm: MainThreadMarker, buttons: &[Retained<NSButton>]) -> Option<Retained<NSView>> {
    let parent = unsafe { buttons[0].superview() }?;
    if parent.class() == NSView::class() {
        return Some(parent);
    }

    let titlebar = parent;
    for view in titlebar.subviews().iter() {
        if view.class() == NSView::class() {
            view.removeFromSuperview();
        }
    }
    let holder = NSView::initWithFrame(NSView::alloc(mtm), NSRect::ZERO);
    holder.setAutoresizingMask(NSAutoresizingMaskOptions::ViewMinYMargin | NSAutoresizingMaskOptions::ViewMaxXMargin);
    titlebar.addSubview(&holder);
    for button in buttons {
        button.removeFromSuperview();
        holder.addSubview(button);
    }
    Some(holder)
}

/// Grows the title bar (and its ancestors) to cover `rect` (window coordinates) in case AppKit makes it shorter
/// than our row: a view outside its superview's bounds still draws but never gets the click.
fn contain(titlebar: &Retained<NSView>, rect: NSRect) {
    let mut views = vec![titlebar.clone()];
    let mut parent = unsafe { titlebar.superview() };
    while let Some(view) = parent {
        parent = unsafe { view.superview() };
        if parent.is_some() {
            views.push(view);
        }
    }
    for view in views.iter().rev() {
        let Some(superview) = (unsafe { view.superview() }) else {
            continue;
        };
        let in_window = superview.convertRect_toView(view.frame(), None);
        let covered = union(in_window, rect);
        if !rect_eq(covered, in_window) {
            view.setFrame(superview.convertRect_fromView(covered, None));
        }
    }
}

fn union(a: NSRect, b: NSRect) -> NSRect {
    let left = a.origin.x.min(b.origin.x);
    let bottom = a.origin.y.min(b.origin.y);
    let right = (a.origin.x + a.size.width).max(b.origin.x + b.size.width);
    let top = (a.origin.y + a.size.height).max(b.origin.y + b.size.height);
    NSRect::new(NSPoint::new(left, bottom), NSSize::new(right - left, top - bottom))
}

/// Brings other small title-bar views (e.g. the screen-sharing indicator) down to the buttons' row.
fn center_strays(titlebar: &NSView, holder: &NSView, window_height: f64) {
    let half_width = titlebar.bounds().size.width / 2.0;
    for view in titlebar.subviews().iter() {
        let frame = view.frame();
        if std::ptr::eq(&*view as *const NSView, holder) || view.isHidden() || frame.size.height <= 0.0 || frame.size.width >= half_width {
            continue;
        }
        let in_window = titlebar.convertRect_toView(frame, None);
        let mut wanted_in_window = in_window;
        wanted_in_window.origin.y = window_height - TITLEBAR_HEIGHT / 2.0 - frame.size.height / 2.0;
        let wanted = titlebar.convertRect_fromView(wanted_in_window, None);
        if !rect_eq(frame, wanted) {
            view.setFrame(wanted);
        }
    }
}

fn same<T: objc2::Message>(a: &Retained<T>, b: &Retained<T>) -> bool {
    std::ptr::eq(Retained::as_ptr(a), Retained::as_ptr(b))
}

fn rect_eq(a: NSRect, b: NSRect) -> bool {
    (a.origin.x - b.origin.x).abs() < 0.01
        && (a.origin.y - b.origin.y).abs() < 0.01
        && (a.size.width - b.size.width).abs() < 0.01
        && (a.size.height - b.size.height).abs() < 0.01
}

fn ns_window<R: tauri::Runtime>(window: &tauri::Window<R>) -> Option<Retained<NSWindow>> {
    let handle = window.ns_window().ok()?;
    unsafe { Retained::retain(handle.cast::<NSWindow>()) }
}

/// Idempotent; call for every window once it exists.
pub fn install<R: tauri::Runtime>(window: &tauri::Window<R>) {
    let Some(mtm) = MainThreadMarker::new() else {
        let window = window.clone();
        let _ = window.clone().run_on_main_thread(move || install(&window));
        return;
    };
    let Some(ns_window) = ns_window(window) else {
        return;
    };

    let label = window.label().to_owned();
    let existing = INSTALLED.with(|installed| installed.borrow().get(&label).cloned());
    if let Some(existing) = existing {
        if existing.ivars().window.load().is_some_and(|current| same(&current, &ns_window)) {
            existing.arrange();
            return;
        }
        unsafe { NSNotificationCenter::defaultCenter().removeObserver(&existing) };
    }

    let buttons = buttons(&ns_window);
    if buttons.len() != 3 {
        return;
    }

    let lights = TrafficLights::new(mtm, &ns_window);
    let center = NSNotificationCenter::defaultCenter();
    let names = unsafe {
        [
            NSWindowDidResizeNotification,
            NSWindowDidEndLiveResizeNotification,
            NSWindowDidExitFullScreenNotification,
            NSWindowDidBecomeKeyNotification,
            NSWindowDidResignKeyNotification,
            NSWindowDidBecomeMainNotification,
            NSWindowDidResignMainNotification,
            NSWindowDidChangeScreenNotification,
            NSWindowDidChangeBackingPropertiesNotification,
            NSWindowDidChangeOcclusionStateNotification,
            NSWindowDidDeminiaturizeNotification,
        ]
    };
    for name in names {
        lights.observe(&center, name, Some(&ns_window));
    }

    INSTALLED.with(|installed| installed.borrow_mut().insert(label, lights.clone()));
    observe_run_loop();
    lights.arrange();
}

pub fn uninstall<R: tauri::Runtime>(window: &tauri::Window<R>) {
    if MainThreadMarker::new().is_none() {
        return;
    }
    let Some(lights) = INSTALLED.with(|installed| installed.borrow_mut().remove(window.label())) else {
        return;
    };
    unsafe { NSNotificationCenter::defaultCenter().removeObserver(&lights) };
}

