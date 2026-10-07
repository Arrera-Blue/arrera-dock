/* dock.js
 *
 * Arrera Dock - Modern desktop dock replacing native GNOME overview dash
 * Distribution Arrera Blue
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import { AppMenu } from 'resource:///org/gnome/shell/ui/appMenu.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as OverviewControls from 'resource:///org/gnome/shell/ui/overviewControls.js';

export const SIZES = {
    small: {
        iconSize: 28,
        dockHeight: 46,
    },
    medium: {
        iconSize: 36,
        dockHeight: 56,
    },
    large: {
        iconSize: 48,
        dockHeight: 72,
    },
};

const DEFAULT_ICON_SIZE = SIZES.medium.iconSize;
const DOCK_HEIGHT = SIZES.medium.dockHeight;

/**
 * DockAppIcon represents an individual application launcher inside Arrera Dock.
 * Inherits from Dash.DashIcon to reuse AppMenu, icon texture, and DND logic.
 */
export const DockAppIcon = GObject.registerClass(
    class DockAppIcon extends Dash.DashIcon {
        _init(app, iconSize = DEFAULT_ICON_SIZE, dock = null) {
            super._init(app);

            this._dock = dock;
            this._iconSize = iconSize;
            this.icon.setIconSize(iconSize);
            this.label_actor = null;

            // Remove overview-tile and overview-icon to prevent GNOME Shell's overview focus ring and padding from applying
            this.remove_style_class_name('overview-tile');
            if (this.icon) {
                this.icon.remove_style_class_name('overview-icon');
                this.icon.remove_style_class_name('overview-icon-with-label');
            }

            this.add_style_class_name('dock-app-icon');
            this._tooltip = null;
            const sizeName = this._dock?._sizeName || (iconSize <= 28 ? 'small' : (iconSize >= 48 ? 'large' : 'medium'));
            this.add_style_class_name(`size-${sizeName}`);

            // Unparent _dot from _iconContainer so it is not superimposed on top of the icon texture
            if (this._dot && this._iconContainer && this._dot.get_parent() === this._iconContainer) {
                this._iconContainer.remove_child(this._dot);
            }

            // Create dedicated BoxLayout container for clean, adjacent layout of icon and indicator
            this._contentBox = new St.BoxLayout({
                style_class: 'dock-app-icon-content',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                y_expand: true,
            });
            this.set_child(this._contentBox);

            this.updatePositionStyle(this._dock?._position || 'bottom');

            this.set_x_expand(false);
            this.set_y_expand(false);
            if (this._iconContainer) {
                this._iconContainer.set_x_expand(false);
                this._iconContainer.set_y_expand(false);
            }
            if (this._dot) {
                this._dot.set_x_expand(false);
                this._dot.set_y_expand(false);
                this._dot.show();
            }
            if (this.icon) {
                this.icon.set_x_expand(false);
                this.icon.set_y_expand(false);
                if (this.icon._box) {
                    this.icon._box.set_x_expand(false);
                    this.icon._box.set_y_expand(false);
                }
            }

            this._updateRunningStyle();

            this.connect('notify::hover', () => {
                if (this.hover && (!this._menu || !this._menu.isOpen)) {
                    this._showTooltip();
                } else {
                    this._hideTooltip();
                }
            });

            // Hide tooltip when context menu opens & notify dock for autohide
            this.connect('menu-state-changed', (_actor, opened) => {
                if (opened) {
                    this._hideTooltip();
                    const appMenu = globalThis.arreraAppMenu;
                    if (appMenu?.isOpen)
                        appMenu.close();
                }
                this._dock?._onMenuStateChanged?.(opened);
            });

            // Right-click event handler
            this.connect('button-press-event', (_actor, event) => {
                if (event.get_button() === Clutter.BUTTON_SECONDARY) {
                    this.popupMenu();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            const rightClickGesture = new Clutter.ClickGesture({
                required_button: Clutter.BUTTON_SECONDARY,
                recognize_on_press: true,
            });
            rightClickGesture.connect('recognize', () => this.popupMenu());
            this.add_action(rightClickGesture);

            this.connect('notify::stage', () => {
                this._updateDotStyle();
            });

            this.connect('destroy', () => {
                this._cleanupTooltip();
            });
        }

        vfunc_clicked(button) {
            if (button === Clutter.BUTTON_SECONDARY) {
                this.popupMenu();
                return;
            }
            this.activate(button);
        }

        setIconSize(size) {
            this._iconSize = size;
            this.icon.setIconSize(size);
            for (const s of ['small', 'medium', 'large'])
                this.remove_style_class_name(`size-${s}`);
            const sizeName = this._dock?._sizeName || (size <= 28 ? 'small' : (size >= 48 ? 'large' : 'medium'));
            this.add_style_class_name(`size-${sizeName}`);
            this._updateDotStyle();
        }

        _cleanupTooltip() {
            if (!this._tooltip)
                return;

            try {
                this._tooltip.remove_all_transitions();
                Main.layoutManager.removeChrome(this._tooltip);
                this._tooltip.destroy();
            } catch (_e) {
                // Already destroyed or disposed by parent during shutdown
            } finally {
                this._tooltip = null;
            }
        }

        _updateRunningStyle() {
            if (!this._dot || !this.app)
                return;

            const isRunning = this.app.state !== Shell.AppState.STOPPED;
            this._dot.opacity = isRunning ? 255 : 0;
            if (isRunning)
                this.add_style_pseudo_class('running');
            else
                this.remove_style_pseudo_class('running');
        }

        _updateDotStyle() {
            if (!this._dot)
                return;

            this._dot.translation_x = 0;
            this._dot.translation_y = 0;
            this._dot.x_align = Clutter.ActorAlign.CENTER;
            this._dot.y_align = Clutter.ActorAlign.CENTER;
        }

        updatePositionStyle(position) {
            for (const p of ['bottom', 'left', 'right'])
                this.remove_style_class_name(`position-${p}`);
            this.add_style_class_name(`position-${position}`);

            if (this._contentBox) {
                this._contentBox.remove_all_children();

                const isVertical = position === 'bottom';
                if ('orientation' in this._contentBox) {
                    this._contentBox.orientation = isVertical
                        ? Clutter.Orientation.VERTICAL
                        : Clutter.Orientation.HORIZONTAL;
                } else if ('is_vertical' in this._contentBox) {
                    this._contentBox.is_vertical = isVertical;
                } else {
                    this._contentBox.vertical = isVertical;
                }

                if (position === 'left') {
                    this.set_pivot_point(0.0, 0.5);
                    this._popupMenuSide = St.Side.LEFT;
                    this._contentBox.spacing = 3;
                    if (this._dot) {
                        this._dot.x_align = Clutter.ActorAlign.CENTER;
                        this._dot.y_align = Clutter.ActorAlign.CENTER;
                        this._contentBox.add_child(this._dot);
                    }
                    if (this._iconContainer)
                        this._contentBox.add_child(this._iconContainer);
                } else if (position === 'right') {
                    this.set_pivot_point(1.0, 0.5);
                    this._popupMenuSide = St.Side.RIGHT;
                    this._contentBox.spacing = 3;
                    if (this._iconContainer)
                        this._contentBox.add_child(this._iconContainer);
                    if (this._dot) {
                        this._dot.x_align = Clutter.ActorAlign.CENTER;
                        this._dot.y_align = Clutter.ActorAlign.CENTER;
                        this._contentBox.add_child(this._dot);
                    }
                } else {
                    this.set_pivot_point(0.5, 1.0);
                    this._popupMenuSide = St.Side.BOTTOM;
                    this._contentBox.spacing = 2;
                    if (this._iconContainer)
                        this._contentBox.add_child(this._iconContainer);
                    if (this._dot) {
                        this._dot.x_align = Clutter.ActorAlign.CENTER;
                        this._dot.y_align = Clutter.ActorAlign.CENTER;
                        this._contentBox.add_child(this._dot);
                    }
                }
            }

            this._updateDotStyle();

            if (this._menu) {
                this._menu.destroy();
                this._menu = null;
            }
        }

        popupMenu() {
            this._hideTooltip();
            this.setForcedHighlight(true);

            if (!this._menu) {
                this._menu = new AppMenu(this, this._popupMenuSide, {
                    favoritesSection: true,
                    showSingleWindows: true,
                });
                this._menu.setApp(this.app);

                const origUpdateFavoriteItem = this._menu._updateFavoriteItem.bind(this._menu);
                this._menu._updateFavoriteItem = () => {
                    origUpdateFavoriteItem();
                    if (this._menu?._toggleFavoriteItem?.visible) {
                        const isFav = this._dock?._appFavorites?.isFavorite(this.app.get_id());
                        this._menu._toggleFavoriteItem.label.text = isFav
                            ? 'Détacher du dock'
                            : 'Épingler au dock';
                    }
                };

                this._menu.connect('open-state-changed', (_menu, isPoppedUp) => {
                    if (!isPoppedUp)
                        this._onMenuPoppedDown();
                });
                Main.overview.connectObject('hiding',
                    () => this._menu?.close(), this);

                Main.uiGroup.add_child(this._menu.actor);
                this._menuManager.addMenu(this._menu);
            }

            this._menu._updateFavoriteItem?.();
            this.emit('menu-state-changed', true);

            this._menu.open(BoxPointer.PopupAnimation.FULL);
            this.emit('sync-tooltip');

            return false;
        }

        _showTooltip() {
            if (!this.get_stage() || !this.app)
                return;

            if (!this._tooltip) {
                this._tooltip = new St.Label({
                    style_class: 'dock-tooltip',
                    text: this.app.get_name(),
                });
                this._tooltip.connect('destroy', () => {
                    this._tooltip = null;
                });
                Main.layoutManager.addTopChrome(this._tooltip);
            }

            this._tooltip.opacity = 0;
            this._tooltip.show();
            this.updateTooltipPosition();

            this._tooltip.ease({
                opacity: 255,
                duration: 150,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }

        updateTooltipPosition() {
            if (!this._tooltip || !this._tooltip.visible)
                return;

            const [stageX, stageY] = this.get_transformed_position();
            const [w, h] = this.get_transformed_size();
            const [, , natW, natH] = this._tooltip.get_preferred_size();
            const tw = this._tooltip.width || natW;
            const th = this._tooltip.height || natH;
            const pos = this._dock?._position || 'bottom';

            let x, y;
            if (pos === 'left') {
                const dockX = this._dock ? this._dock.x : stageX;
                const dockW = this._dock ? this._dock.width : w;
                x = Math.round(dockX + dockW + 10);
                y = Math.round(stageY + (h - th) / 2);
            } else if (pos === 'right') {
                const dockX = this._dock ? this._dock.x : stageX;
                x = Math.round(dockX - tw - 10);
                y = Math.round(stageY + (h - th) / 2);
            } else {
                const dockY = this._dock ? this._dock.y : stageY;
                x = Math.round(stageX + (w - tw) / 2);
                y = Math.round(dockY - th - 10);
            }

            const monitor = Main.layoutManager.primaryMonitor;
            if (monitor) {
                const panelHeight = (Main.panel && Main.panel.visible) ? Main.panel.height : 0;
                const minY = monitor.y + panelHeight + 4;
                const maxY = monitor.y + monitor.height - th - 4;
                const minX = monitor.x + 4;
                const maxX = monitor.x + monitor.width - tw - 4;

                x = Math.clamp(x, minX, maxX);
                y = Math.clamp(y, minY, maxY);
            }

            this._tooltip.set_position(x, y);
        }

        _hideTooltip() {
            if (!this._tooltip)
                return;

            this._tooltip.ease({
                opacity: 0,
                duration: 100,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    if (this._tooltip)
                        this._tooltip.hide();
                },
            });
        }

        activate(button) {
            if (button === Clutter.BUTTON_SECONDARY) {
                this.popupMenu();
                return;
            }

            this._hideTooltip();

            const appMenu = globalThis.arreraAppMenu;
            if (appMenu?.isOpen)
                appMenu.close();

            const event = Clutter.get_current_event();
            const modifiers = event ? event.get_state() : 0;
            const isMiddleButton = button && button === Clutter.BUTTON_MIDDLE;
            const isCtrlPressed = (modifiers & Clutter.ModifierType.CONTROL_MASK) !== 0;
            const openNewWindow = this.app.can_open_new_window() &&
                this.app.state === Shell.AppState.RUNNING &&
                (isCtrlPressed || isMiddleButton);

            if (openNewWindow) {
                this.animateLaunch();
                this.app.open_new_window(-1);
                if (Main.overview.visible)
                    Main.overview.hide();
                return;
            }

            if (this.app.state === Shell.AppState.STOPPED) {
                this.animateLaunch();
                this.app.activate();
                if (Main.overview.visible)
                    Main.overview.hide();
                return;
            }

            // App is already running: smart toggle / minimize / focus
            const windows = this.app.get_windows() || [];
            const currentWorkspace = global.workspace_manager.get_active_workspace();
            const activeWindow = global.display.focus_window;

            if (windows.length > 0) {
                const hasFocusedWindow = activeWindow && windows.includes(activeWindow) &&
                    (activeWindow.is_on_all_workspaces?.() || activeWindow.located_on_workspace(currentWorkspace));

                if (hasFocusedWindow) {
                    if (windows.length === 1) {
                        if (activeWindow.can_minimize?.())
                            activeWindow.minimize();
                    } else {
                        const currentIdx = windows.indexOf(activeWindow);
                        const nextIdx = (currentIdx + 1) % windows.length;
                        const nextWin = windows[nextIdx];
                        if (nextWin.minimized)
                            nextWin.unminimize();
                        nextWin.activate(global.get_current_time());
                    }
                } else {
                    const workspaceWindows = windows.filter(w => w.is_on_all_workspaces?.() || w.located_on_workspace(currentWorkspace));
                    const winToActivate = workspaceWindows[0] || windows[0];
                    if (winToActivate.minimized)
                        winToActivate.unminimize();
                    winToActivate.activate(global.get_current_time());
                }
            } else {
                this.app.activate();
            }

            if (Main.overview.visible)
                Main.overview.hide();
        }

        updateActiveState(focusWindow) {
            if (!this.app || !this._dot)
                return;

            const isRunning = this.app.state !== Shell.AppState.STOPPED;
            this._dot.opacity = isRunning ? 255 : 0;

            if (!isRunning) {
                this.remove_style_pseudo_class('running');
                this.remove_style_pseudo_class('focused');
                this._dot.remove_style_class_name('focused');
                return;
            }

            this.add_style_pseudo_class('running');

            const windows = this.app.get_windows() || [];
            const isFocused = focusWindow && windows.includes(focusWindow);

            if (isFocused) {
                this._dot.add_style_class_name('focused');
                this.add_style_pseudo_class('focused');
            } else {
                this._dot.remove_style_class_name('focused');
                this.remove_style_pseudo_class('focused');
            }

            this._updateDotStyle();
        }

        destroy() {
            this._cleanupTooltip();
            super.destroy();
        }
    });

/**
 * ShowAppsButton triggers GNOME Shell's application grid overview
 * and stays in sync with overview state.
 */
export const ShowAppsButton = GObject.registerClass(
    class ShowAppsButton extends St.Button {
        _init(dock, iconSize = DEFAULT_ICON_SIZE) {
            super._init({
                style_class: 'dock-item show-apps-button',
                reactive: true,
                can_focus: true,
                track_hover: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._dock = dock;
            this._iconSize = iconSize;
            this._icon = this._createIcon(iconSize);
            this.set_child(this._icon);
            this._tooltip = null;
            this.updatePositionStyle(this._dock?._position || 'bottom');

            this.connect('clicked', () => this._onClicked());
            this.connect('notify::hover', () => {
                if (this.hover)
                    this._showTooltip();
                else
                    this._hideTooltip();
            });

            this.connect('destroy', () => {
                this._cleanupTooltip();
                Main.overview.disconnectObject(this);
                const controls = Main.overview._overview?._controls;
                if (controls?._stateAdjustment)
                    controls._stateAdjustment.disconnectObject(this);
            });

            // Sync with overview state
            Main.overview.connectObject(
                'showing', () => this._updateState(),
                'hiding', () => this._updateState(),
                this
            );

            const controls = Main.overview._overview?._controls;
            if (controls?._stateAdjustment) {
                controls._stateAdjustment.connectObject(
                    'notify::value', () => this._updateState(),
                    this
                );
            }

            this._updateState();
        }

        _createIcon(iconSize) {
            const extPath = this._dock?._extension?.path;
            if (extPath) {
                const candidates = [
                    'show-apps-symbolic.svg',
                    'show-apps.svg',
                    'show-apps.png',
                    'logo-symbolic.svg',
                    'logo.svg',
                    'logo.png',
                ];
                for (const name of candidates) {
                    const filePath = `${extPath}/icons/${name}`;
                    const file = Gio.File.new_for_path(filePath);
                    if (file.query_exists(null)) {
                        return new St.Icon({
                            gicon: new Gio.FileIcon({ file }),
                            icon_size: iconSize,
                            style_class: 'show-apps-icon',
                        });
                    }
                }
            }

            return new St.Icon({
                icon_name: 'view-app-grid-symbolic',
                icon_size: iconSize,
                style_class: 'show-apps-icon',
            });
        }

        setIconSize(size) {
            this._iconSize = size;
            if (this._icon)
                this._icon.icon_size = size;
            for (const s of ['small', 'medium', 'large'])
                this.remove_style_class_name(`size-${s}`);
            const sizeName = this._dock?._sizeName || (size <= 28 ? 'small' : (size >= 48 ? 'large' : 'medium'));
            this.add_style_class_name(`size-${sizeName}`);
        }

        _cleanupTooltip() {
            if (!this._tooltip)
                return;

            try {
                this._tooltip.remove_all_transitions();
                Main.layoutManager.removeChrome(this._tooltip);
                this._tooltip.destroy();
            } catch (_e) {
                // Already destroyed or disposed by parent during shutdown
            } finally {
                this._tooltip = null;
            }
        }

        _onClicked() {
            this._hideTooltip();

            // Si l'extension Arrera App Menu est installée et activée, l'ouvrir / fermer
            const appMenu = globalThis.arreraAppMenu || Main.extensionManager?.lookup('app-menu@linux.arrera-software.fr')?.stateObj;
            if (appMenu && typeof appMenu.toggle === 'function') {
                appMenu.toggle();
                return;
            }

            // Comportement standard : basculer l'aperçu GNOME Shell vers la grille d'applications
            const controls = Main.overview._overview?._controls;
            if (Main.overview.visible) {
                if (controls && Math.round(controls._stateAdjustment.value) === OverviewControls.ControlsState.APP_GRID) {
                    Main.overview.hide();
                } else if (controls) {
                    controls._stateAdjustment.ease(OverviewControls.ControlsState.APP_GRID);
                } else {
                    Main.overview.hide();
                }
            } else {
                Main.overview.show(OverviewControls.ControlsState.APP_GRID);
            }
        }

        _updateState() {
            const controls = Main.overview._overview?._controls;
            const isAppGrid = Main.overview.visible &&
                controls &&
                Math.round(controls._stateAdjustment.value) === OverviewControls.ControlsState.APP_GRID;

            if (isAppGrid)
                this.add_style_pseudo_class('checked');
            else
                this.remove_style_pseudo_class('checked');
        }

        updatePositionStyle(position) {
            for (const p of ['bottom', 'left', 'right'])
                this.remove_style_class_name(`position-${p}`);
            this.add_style_class_name(`position-${position}`);

            if (position === 'left') {
                this.set_pivot_point(0.0, 0.5);
            } else if (position === 'right') {
                this.set_pivot_point(1.0, 0.5);
            } else {
                this.set_pivot_point(0.5, 1.0);
            }
        }

        _showTooltip() {
            if (!this.get_stage())
                return;

            if (!this._tooltip) {
                this._tooltip = new St.Label({
                    style_class: 'dock-tooltip',
                    text: _('Applications'),
                });
                this._tooltip.connect('destroy', () => {
                    this._tooltip = null;
                });
                Main.layoutManager.addTopChrome(this._tooltip);
            }

            this._tooltip.opacity = 0;
            this._tooltip.show();
            this.updateTooltipPosition();

            this._tooltip.ease({
                opacity: 255,
                duration: 150,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }

        updateTooltipPosition() {
            if (!this._tooltip || !this._tooltip.visible)
                return;

            const [stageX, stageY] = this.get_transformed_position();
            const [w, h] = this.get_transformed_size();
            const [, , natW, natH] = this._tooltip.get_preferred_size();
            const tw = this._tooltip.width || natW;
            const th = this._tooltip.height || natH;
            const pos = this._dock?._position || 'bottom';

            let x, y;
            if (pos === 'left') {
                const dockX = this._dock ? this._dock.x : stageX;
                const dockW = this._dock ? this._dock.width : w;
                x = Math.round(dockX + dockW + 10);
                y = Math.round(stageY + (h - th) / 2);
            } else if (pos === 'right') {
                const dockX = this._dock ? this._dock.x : stageX;
                x = Math.round(dockX - tw - 10);
                y = Math.round(stageY + (h - th) / 2);
            } else {
                const dockY = this._dock ? this._dock.y : stageY;
                x = Math.round(stageX + (w - tw) / 2);
                y = Math.round(dockY - th - 10);
            }

            const monitor = Main.layoutManager.primaryMonitor;
            if (monitor) {
                const panelHeight = (Main.panel && Main.panel.visible) ? Main.panel.height : 0;
                const minY = monitor.y + panelHeight + 4;
                const maxY = monitor.y + monitor.height - th - 4;
                const minX = monitor.x + 4;
                const maxX = monitor.x + monitor.width - tw - 4;

                x = Math.clamp(x, minX, maxX);
                y = Math.clamp(y, minY, maxY);
            }

            this._tooltip.set_position(x, y);
        }

        _hideTooltip() {
            if (!this._tooltip)
                return;

            this._tooltip.ease({
                opacity: 0,
                duration: 100,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    if (this._tooltip)
                        this._tooltip.hide();
                },
            });
        }

        destroy() {
            this._cleanupTooltip();
            super.destroy();
        }
    });

/**
 * ActivitiesButton triggers GNOME Shell's Activities overview
 * and displays the Arrera logo.
 */
export const ActivitiesButton = GObject.registerClass(
    class ActivitiesButton extends St.Button {
        _init(dock, iconSize = DEFAULT_ICON_SIZE) {
            super._init({
                style_class: 'dock-app-icon activities-button',
                reactive: true,
                can_focus: false,
                track_hover: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._dock = dock;
            this._iconSize = iconSize;
            this._icon = this._createIcon(iconSize);
            this.set_child(this._icon);
            this._tooltip = null;
            this.updatePositionStyle(this._dock?._position || 'bottom');

            this.connect('clicked', () => this._onClicked());
            this.connect('notify::hover', () => {
                if (this.hover)
                    this._showTooltip();
                else
                    this._hideTooltip();
            });

            this.connect('destroy', () => {
                this._cleanupTooltip();
            });
        }

        _createIcon(iconSize) {
            const extPath = this._dock?._extension?.path;
            if (extPath) {
                const candidates = [
                    'arrera-logo.svg',
                    'arrera-logo.png',
                    'arrera-symbolic.svg',
                    'activities-symbolic.svg',
                    'activities.svg',
                    'activities.png',
                    'logo.svg',
                    'logo.png',
                    'logo-symbolic.svg',
                ];
                for (const name of candidates) {
                    const filePath = `${extPath}/icons/${name}`;
                    const file = Gio.File.new_for_path(filePath);
                    if (file.query_exists(null)) {
                        return new St.Icon({
                            gicon: new Gio.FileIcon({ file }),
                            icon_size: iconSize,
                            style_class: 'activities-icon',
                        });
                    }
                }
            }

            return new St.Icon({
                icon_name: 'view-activities-symbolic',
                icon_size: iconSize,
                style_class: 'activities-icon',
            });
        }

        setIconSize(size) {
            this._iconSize = size;
            if (this._icon)
                this._icon.icon_size = size;
            for (const s of ['small', 'medium', 'large'])
                this.remove_style_class_name(`size-${s}`);
            const sizeName = this._dock?._sizeName || (size <= 28 ? 'small' : (size >= 48 ? 'large' : 'medium'));
            this.add_style_class_name(`size-${sizeName}`);
        }

        _cleanupTooltip() {
            if (!this._tooltip)
                return;

            try {
                this._tooltip.remove_all_transitions();
                Main.layoutManager.removeChrome(this._tooltip);
                this._tooltip.destroy();
            } catch (_e) {
                // Already destroyed or disposed by parent during shutdown
            } finally {
                this._tooltip = null;
            }
        }

        _onClicked() {
            this._hideTooltip();
            Main.overview.toggle();
        }

        updatePositionStyle(position) {
            for (const p of ['bottom', 'left', 'right'])
                this.remove_style_class_name(`position-${p}`);
            this.add_style_class_name(`position-${position}`);

            if (position === 'left') {
                this.set_pivot_point(0.0, 0.5);
            } else if (position === 'right') {
                this.set_pivot_point(1.0, 0.5);
            } else {
                this.set_pivot_point(0.5, 1.0);
            }
        }

        _showTooltip() {
            if (!this.get_stage())
                return;

            if (!this._tooltip) {
                this._tooltip = new St.Label({
                    style_class: 'dock-tooltip',
                    text: _('Activities'),
                });
                this._tooltip.connect('destroy', () => {
                    this._tooltip = null;
                });
                Main.layoutManager.addTopChrome(this._tooltip);
            }

            this._tooltip.opacity = 0;
            this._tooltip.show();
            this.updateTooltipPosition();

            this._tooltip.ease({
                opacity: 255,
                duration: 150,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }

        updateTooltipPosition() {
            if (!this._tooltip || !this._tooltip.visible)
                return;

            const [stageX, stageY] = this.get_transformed_position();
            const [w, h] = this.get_transformed_size();
            const [, , natW, natH] = this._tooltip.get_preferred_size();
            const tw = this._tooltip.width || natW;
            const th = this._tooltip.height || natH;
            const pos = this._dock?._position || 'bottom';

            let x, y;
            if (pos === 'left') {
                const dockX = this._dock ? this._dock.x : stageX;
                const dockW = this._dock ? this._dock.width : w;
                x = Math.round(dockX + dockW + 10);
                y = Math.round(stageY + (h - th) / 2);
            } else if (pos === 'right') {
                const dockX = this._dock ? this._dock.x : stageX;
                x = Math.round(dockX - tw - 10);
                y = Math.round(stageY + (h - th) / 2);
            } else {
                const dockY = this._dock ? this._dock.y : stageY;
                x = Math.round(stageX + (w - tw) / 2);
                y = Math.round(dockY - th - 10);
            }

            const monitor = Main.layoutManager.primaryMonitor;
            if (monitor) {
                const panelHeight = (Main.panel && Main.panel.visible) ? Main.panel.height : 0;
                const minY = monitor.y + panelHeight + 4;
                const maxY = monitor.y + monitor.height - th - 4;
                const minX = monitor.x + 4;
                const maxX = monitor.x + monitor.width - tw - 4;

                x = Math.clamp(x, minX, maxX);
                y = Math.clamp(y, minY, maxY);
            }

            this._tooltip.set_position(x, y);
        }

        _hideTooltip() {
            if (!this._tooltip)
                return;

            this._tooltip.ease({
                opacity: 0,
                duration: 100,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    if (this._tooltip)
                        this._tooltip.hide();
                },
            });
        }

        handleDragOver(source, _actor, _x, _y, _time) {
            if (Main.overview.shouldToggleByCornerOrButton?.() ?? true) {
                Main.overview.show();
            }
            return DND.DragMotionResult.CONTINUE;
        }

        destroy() {
            this._cleanupTooltip();
            super.destroy();
        }
    }
);

/**
 * ArreraDock is the main dock widget container added to GNOME Shell's chrome.
 */
export const ArreraDock = GObject.registerClass(
    class ArreraDock extends St.Widget {
        _init(extension) {
            super._init({
                name: 'arrera-dock-container',
                style_class: 'arrera-dock-container',
                layout_manager: new Clutter.BinLayout(),
                reactive: false,
            });

            this._extension = extension;
            this._settings = extension.getSettings?.();

            // Icon sizing
            this._sizeName = 'medium';
            this._iconSize = SIZES.medium.iconSize;
            this._dockHeight = SIZES.medium.dockHeight;

            // Position: bottom, left, right
            this._position = 'bottom';

            // Autohide state
            this._autohide = false;
            this._autohideTimeoutId = 0;
            this._openMenusCount = 0;
            this._isDockHidden = false;

            // Bar mode state (full width/height when a window is maximized/fullscreen & always shown)
            this._isBarMode = false;
            this._extendOnMaximize = true;
            this._alwaysBarMode = false;
            this._barIconsAlignment = "center";
            this._trackedWindows = new Set();

            this._appIcons = new Map();
            this._separator = null;

            // System status area state (Quick Settings & Date/Clock)
            this._qsReparented = false;
            this._dmReparented = false;
            this._qsOrigParent = null;
            this._qsOrigIndex = -1;
            this._dmOrigParent = null;
            this._dmOrigIndex = -1;
            this._systemSeparator = null;

            // Floating pill container
            this._dockPill = new St.BoxLayout({
                style_class: 'arrera-dock',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.END,
                reactive: true,
                track_hover: true,
            });
            this._dockPill._delegate = this;
            this.add_child(this._dockPill);

            this._dockPill.connect('button-press-event', (_actor, event) => {
                const appMenu = globalThis.arreraAppMenu;
                if (event.get_source() === this._dockPill && appMenu?.isOpen) {
                    appMenu.close();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            this._dockPill.connect('notify::hover', () => {
                if (this._dockPill.hover) {
                    this._onEnter();
                } else {
                    this._onLeave();
                }
            });

            this.connect('notify::hover', () => {
                if (this.hover)
                    this._onEnter();
                else
                    this._onLeave();
            });

            this._barModeUpdateId = 0;

            // Leading spacer for bar mode (centers icons when dock spans full screen)
            this._leadingSpacer = new Clutter.Actor({ visible: false, x_expand: false, y_expand: false });
            this._dockPill.add_child(this._leadingSpacer);

            // Activities Button (placed on the left, with Arrera logo)
            this._activitiesButton = new ActivitiesButton(this, this._iconSize);
            this._activitiesButton.set_x_expand(false);
            this._activitiesButton.set_y_expand(false);
            this._dockPill.add_child(this._activitiesButton);

            // Show Apps Button (placed on the left)
            this._showAppsButton = new ShowAppsButton(this, this._iconSize);
            this._showAppsButton.set_x_expand(false);
            this._showAppsButton.set_y_expand(false);
            this._dockPill.add_child(this._showAppsButton);

            // Icons box (favorites and running apps)
            this._iconsBox = new St.BoxLayout({
                style_class: 'arrera-dock-icons',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: false,
                y_expand: false,
                reactive: true,
            });
            this._iconsBox._delegate = this;
            this._dockPill.add_child(this._iconsBox);

            // Trailing spacer for bar mode (centers icons when dock spans full screen)
            this._trailingSpacer = new Clutter.Actor({ visible: false, x_expand: false, y_expand: false });
            this._dockPill.add_child(this._trailingSpacer);

            // System status box (Date/Clock & Quick Settings)
            this._systemBox = new St.BoxLayout({
                style_class: 'arrera-dock-system-box',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: false,
                y_expand: false,
                reactive: true,
                visible: false,
            });
            this._systemBox._delegate = this;
            this._dockPill.add_child(this._systemBox);

            // Deferred work to coalesce redisplay updates
            this._workId = Main.initializeDeferredWork(
                this._iconsBox,
                () => this._redisplay()
            );

            // Setup signal listeners
            this._appFavorites = AppFavorites.getAppFavorites();
            this._appFavorites.connectObject('changed', () => this._queueRedisplay(), this);

            this._appSystem = Shell.AppSystem.get_default();
            this._appSystem.connectObject(
                'installed-changed', () => this._queueRedisplay(),
                'app-state-changed', () => this._queueRedisplay(),
                this
            );

            global.window_manager.connectObject(
                'size-change', () => this._scheduleBarModeUpdate(),
                'minimize', () => this._scheduleBarModeUpdate(),
                'unminimize', () => this._scheduleBarModeUpdate(),
                'destroy', () => this._scheduleBarModeUpdate(),
                this
            );

            global.display.connectObject(
                'notify::focus-window', () => {
                    this._updateActiveWindow();
                    this._scheduleBarModeUpdate();
                },
                'window-created', (_d, win) => this._onWindowCreated(win),
                'restacked', () => this._scheduleBarModeUpdate(),
                this
            );

            global.workspace_manager.connectObject(
                'active-workspace-changed', () => this._onWorkspaceChanged(),
                this
            );

            // Synchronize with GNOME accent color settings (Material 3 Expressive)
            this._interfaceSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
            this._interfaceSettings.connectObject('changed::accent-color', () => this._syncAccentColor(), this);
            this._syncAccentColor();

            // Connect GSettings for Dock customization
            if (this._settings) {
                this._settings.connectObject(
                    'changed::autohide', () => this._syncAutohide(),
                    'changed::extend-on-maximize', () => this._syncExtendOnMaximize(),
                    'changed::always-bar-mode', () => this._syncAlwaysBarMode(),
                    'changed::bar-icons-alignment', () => this._syncBarIconsAlignment(),
                    'changed::icon-size', () => this._syncIconSize(true),
                    'changed::theme-mode', () => this._syncThemeMode(),
                    'changed::position', () => this._syncPosition(),
                    'changed::show-quick-settings', () => this._syncSystemStatusArea(),
                    'changed::show-date-menu', () => this._syncSystemStatusArea(),
                    'changed::show-activities-button', () => this._syncActivitiesButton(),
                    this
                );
            }

            Main.panel.connectObject?.(
                'notify::height', () => this.updatePosition(),
                'notify::visible', () => this.updatePosition(),
                this
            );

            // Initial synchronization of settings
            this._syncIconSize(false);
            this._syncPosition();
            this._syncThemeMode();
            this._syncExtendOnMaximize();
            this._syncAlwaysBarMode();
            this._syncBarIconsAlignment();
            this._syncAutohide();
            this._syncActivitiesButton();
            this._syncSystemStatusArea();
            this._trackWorkspaceWindows();
            this._updateBarMode();

            this._hasConnectedAdjustment = false;
            this._bindOverview();

            this._redisplay();
        }

        _bindOverview() {
            Main.overview.connectObject(
                'showing', () => this._syncWithOverview(),
                'hiding', () => this._syncWithOverview(),
                'hidden', () => this._onOverviewHidden(),
                this
            );

            this._connectStateAdjustment();
            this._syncWithOverview();
        }

        _connectStateAdjustment() {
            if (this._hasConnectedAdjustment)
                return;

            const controls = Main.overview._overview?._controls;
            if (controls?._stateAdjustment) {
                controls._stateAdjustment.connectObject(
                    'notify::value', () => this._syncWithOverview(),
                    this
                );
                this._hasConnectedAdjustment = true;
            }
        }

        _onOverviewHidden() {
            this.show();
            this._dockPill.remove_all_transitions();
            this._dockPill.opacity = 255;
            this._dockPill.translation_x = 0;
            this._dockPill.translation_y = 0;
            this._dockPill.reactive = true;
            this._updateBarMode();

            if (this._autohide && !this.hover && !this._dockPill.hover)
                this._onLeave();
        }

        _syncWithOverview() {
            this._connectStateAdjustment();

            if (!Main.overview.visible) {
                this._onOverviewHidden();
                return;
            }

            const controls = Main.overview._overview?._controls;
            const stateAdjustment = controls?._stateAdjustment;
            if (!stateAdjustment) {
                this._hideTooltips();
                this.hide();
                return;
            }

            const val = stateAdjustment.value;
            const { initialState, finalState } = stateAdjustment.getStateTransitionParams();

            let factor;
            // Direct transition between Desktop (0) and App Grid (2): keep fully visible without flickering
            if ((initialState === OverviewControls.ControlsState.HIDDEN && finalState === OverviewControls.ControlsState.APP_GRID) ||
                (initialState === OverviewControls.ControlsState.APP_GRID && finalState === OverviewControls.ControlsState.HIDDEN)) {
                factor = 1.0;
            } else if (val <= 1.0) {
                // Between Desktop (0) and Activities/Window Picker (1): fade out towards Activities
                factor = Math.max(0, Math.min(1, 1.0 - val));
            } else {
                // Between Activities/Window Picker (1) and App Grid (2): fade in towards App Grid
                factor = Math.max(0, Math.min(1, val - 1.0));
            }

            const pos = this._position || 'bottom';
            if (factor <= 0.01) {
                this._hideTooltips();
                this._dockPill.opacity = 0;
                if (pos === 'left') {
                    this._dockPill.translation_x = -30;
                    this._dockPill.translation_y = 0;
                } else if (pos === 'right') {
                    this._dockPill.translation_x = 30;
                    this._dockPill.translation_y = 0;
                } else {
                    this._dockPill.translation_y = 30;
                    this._dockPill.translation_x = 0;
                }
                this._dockPill.reactive = false;
                this.hide();
            } else {
                this.show();
                this._dockPill.opacity = Math.round(255 * factor);
                const offset = Math.round((1.0 - factor) * 30);
                if (pos === 'left') {
                    this._dockPill.translation_x = -offset;
                    this._dockPill.translation_y = 0;
                } else if (pos === 'right') {
                    this._dockPill.translation_x = offset;
                    this._dockPill.translation_y = 0;
                } else {
                    this._dockPill.translation_y = offset;
                    this._dockPill.translation_x = 0;
                }
                this._dockPill.reactive = factor >= 0.8;
            }
        }

        _hideTooltips() {
            for (const icon of this._appIcons.values()) {
                icon._hideTooltip?.();
            }
            this._showAppsButton?._hideTooltip?.();
        }


        _queueRedisplay() {
            if (this._workId)
                Main.queueDeferredWork(this._workId);
            else
                this._redisplay();
        }

        _onMenuStateChanged(opened) {
            if (opened) {
                this._openMenusCount++;
                if (this._autohide)
                    this._showDock();
            } else {
                this._openMenusCount = Math.max(0, this._openMenusCount - 1);
                if (this._autohide && !this.hover && !this._dockPill.hover)
                    this._onLeave();
            }
        }

        _onEnter() {
            if (!this._autohide)
                return;

            if (this._autohideTimeoutId) {
                GLib.source_remove(this._autohideTimeoutId);
                this._autohideTimeoutId = 0;
            }

            this._showDock();
        }

        _onLeave() {
            if (!this._autohide)
                return;

            const appMenu = globalThis.arreraAppMenu;
            if (Main.overview.visible || appMenu?.isOpen || this._openMenusCount > 0)
                return;

            if (this._autohideTimeoutId)
                GLib.source_remove(this._autohideTimeoutId);

            this._autohideTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 350, () => {
                this._autohideTimeoutId = 0;
                const menu = globalThis.arreraAppMenu;
                if (!this.hover && !this._dockPill.hover && !this._openMenusCount && !menu?.isOpen && !Main.overview.visible) {
                    this._hideDock();
                }
                return GLib.SOURCE_REMOVE;
            });
        }

        _showDock() {
            this._isDockHidden = false;
            this.updatePosition();

            this._dockPill.remove_all_transitions();
            this._dockPill.ease({
                translation_x: 0,
                translation_y: 0,
                opacity: 255,
                duration: 220,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }

        _hideDock() {
            this._isDockHidden = true;
            this._hideTooltips();

            const thickness = this.getPreferredThickness();
            const pos = this._position || 'bottom';

            let targetX = 0;
            let targetY = 0;
            if (pos === 'left') {
                targetX = -(thickness + 10);
            } else if (pos === 'right') {
                targetX = thickness + 10;
            } else {
                targetY = thickness + 10;
            }

            this._dockPill.remove_all_transitions();
            this._dockPill.ease({
                translation_x: targetX,
                translation_y: targetY,
                opacity: 0,
                duration: 250,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    if (this._isDockHidden && this._autohide) {
                        this.updatePosition();
                    }
                },
            });
        }

        _syncAutohide() {
            this._autohide = this._settings?.get_boolean('autohide') ?? false;
            this.reactive = this._autohide;
            this.track_hover = this._autohide;

            this._extension?.updateChromeStruts?.(!this._autohide);

            if (!this._autohide) {
                if (this._autohideTimeoutId) {
                    GLib.source_remove(this._autohideTimeoutId);
                    this._autohideTimeoutId = 0;
                }
                this._showDock();
            } else {
                if (!this.hover && !this._dockPill.hover && !Main.overview.visible)
                    this._hideDock();
            }

            this._updateBarMode();
        }

        _syncIconSize(redisplay = true) {
            const sizeName = this._settings?.get_string('icon-size') || 'medium';
            const config = SIZES[sizeName] || SIZES.medium;

            this._sizeName = sizeName;
            this._iconSize = config.iconSize;
            this._dockHeight = config.dockHeight;

            for (const s of ['small', 'medium', 'large']) {
                this.remove_style_class_name(`size-${s}`);
                this._dockPill?.remove_style_class_name(`size-${s}`);
            }
            this.add_style_class_name(`size-${sizeName}`);
            this._dockPill?.add_style_class_name(`size-${sizeName}`);

            for (const icon of this._appIcons.values()) {
                icon.setIconSize(this._iconSize);
            }
            this._activitiesButton?.setIconSize(this._iconSize);
            this._showAppsButton?.setIconSize(this._iconSize);

            this.updatePosition();
            this._extension?._updateDockPosition?.();

            const controls = Main.overview._overview?._controls;
            controls?.queue_relayout();

            if (redisplay)
                this._redisplay();
        }

        _syncPosition() {
            const position = this._settings?.get_string('position') || 'bottom';
            const validPositions = ['bottom', 'left', 'right'];
            this._position = validPositions.includes(position) ? position : 'bottom';

            for (const p of validPositions) {
                this.remove_style_class_name(`position-${p}`);
                this._dockPill?.remove_style_class_name(`position-${p}`);
            }
            this.add_style_class_name(`position-${this._position}`);
            this._dockPill?.add_style_class_name(`position-${this._position}`);

            const isVertical = this._position === 'left' || this._position === 'right';

            if ('orientation' in this._dockPill) {
                this._dockPill.orientation = isVertical
                    ? Clutter.Orientation.VERTICAL
                    : Clutter.Orientation.HORIZONTAL;
                this._iconsBox.orientation = isVertical
                    ? Clutter.Orientation.VERTICAL
                    : Clutter.Orientation.HORIZONTAL;
            } else if ('is_vertical' in this._dockPill) {
                this._dockPill.is_vertical = isVertical;
                this._iconsBox.is_vertical = isVertical;
            } else {
                this._dockPill.vertical = isVertical;
                this._iconsBox.vertical = isVertical;
            }

            if (this._systemBox) {
                if ('orientation' in this._systemBox) {
                    this._systemBox.orientation = isVertical
                        ? Clutter.Orientation.VERTICAL
                        : Clutter.Orientation.HORIZONTAL;
                } else if ('is_vertical' in this._systemBox) {
                    this._systemBox.is_vertical = isVertical;
                } else {
                    this._systemBox.vertical = isVertical;
                }
            }

            if (this._qsReparented)
                this._updateMenuSide(Main.panel?.statusArea?.quickSettings?.menu, this._position);
            if (this._dmReparented)
                this._updateMenuSide(Main.panel?.statusArea?.dateMenu?.menu, this._position);

            if (this._position === 'bottom') {
                this._dockPill.x_align = Clutter.ActorAlign.CENTER;
                this._dockPill.y_align = Clutter.ActorAlign.END;
            } else if (this._position === 'left') {
                this._dockPill.x_align = Clutter.ActorAlign.START;
                this._dockPill.y_align = Clutter.ActorAlign.CENTER;
            } else if (this._position === 'right') {
                this._dockPill.x_align = Clutter.ActorAlign.END;
                this._dockPill.y_align = Clutter.ActorAlign.CENTER;
            }

            for (const icon of this._appIcons.values()) {
                icon.updatePositionStyle?.(this._position);
            }
            this._activitiesButton?.updatePositionStyle?.(this._position);
            this._showAppsButton?.updatePositionStyle?.(this._position);

            this.updatePosition();
            this._applyBarMode();
            this._extension?.updateChromeStruts?.(!this._autohide);
        }

        _syncActivitiesButton() {
            const showActivities = this._settings?.get_boolean('show-activities-button') ?? false;
            if (this._activitiesButton)
                this._activitiesButton.visible = showActivities;

            const topActivities = Main.panel?.statusArea?.activities;
            if (topActivities) {
                const targetActor = topActivities.container || topActivities;
                if (showActivities) {
                    if (this._origTopActivitiesVisible === undefined)
                        this._origTopActivitiesVisible = targetActor.visible;
                    targetActor.visible = false;
                } else {
                    if (this._origTopActivitiesVisible !== undefined)
                        targetActor.visible = this._origTopActivitiesVisible;
                    else
                        targetActor.visible = true;
                }
            }
        }

        _cleanupActivitiesButton() {
            const topActivities = Main.panel?.statusArea?.activities;
            if (topActivities) {
                const targetActor = topActivities.container || topActivities;
                if (this._origTopActivitiesVisible !== undefined)
                    targetActor.visible = this._origTopActivitiesVisible;
                else
                    targetActor.visible = true;
            }
            this._origTopActivitiesVisible = undefined;
        }

        _syncSystemStatusArea() {
            const showQs = this._settings?.get_boolean('show-quick-settings') ?? false;
            const showDm = this._settings?.get_boolean('show-date-menu') ?? false;

            // Handle DateMenu
            if (showDm && !this._dmReparented) {
                this._reparentDateMenu();
            } else if (!showDm && this._dmReparented) {
                this._restoreDateMenu();
            }

            // Handle QuickSettings
            if (showQs && !this._qsReparented) {
                this._reparentQuickSettings();
            } else if (!showQs && this._qsReparented) {
                this._restoreQuickSettings();
            }

            const hasSystemItems = this._dmReparented || this._qsReparented;

            if (hasSystemItems) {
                if (!this._systemSeparator) {
                    this._systemSeparator = new St.Widget({
                        style_class: 'dock-separator system-separator',
                        x_align: Clutter.ActorAlign.CENTER,
                        y_align: Clutter.ActorAlign.CENTER,
                    });
                    this._dockPill.insert_child_below(this._systemSeparator, this._systemBox);
                }
                this._systemSeparator.visible = true;
                this._systemBox.visible = true;
            } else {
                if (this._systemSeparator)
                    this._systemSeparator.visible = false;
                this._systemBox.visible = false;
            }

            this._syncPosition();
        }

        _reparentQuickSettings() {
            const qs = Main.panel?.statusArea?.quickSettings;
            if (!qs || !qs.container)
                return;

            const container = qs.container;
            this._qsOrigParent = container.get_parent();
            if (!this._qsOrigParent)
                return;

            this._qsOrigIndex = this._qsOrigParent.get_children().indexOf(container);
            this._qsOrigParent.remove_child(container);

            this._qsOrigYAlign = container.y_align;
            this._qsOrigXAlign = container.x_align;
            this._qsOrigYExpand = container.y_expand;
            this._qsOrigXExpand = container.x_expand;
            container.y_align = Clutter.ActorAlign.CENTER;
            container.x_align = Clutter.ActorAlign.CENTER;
            container.y_expand = false;
            container.x_expand = false;

            this._qsBtnOrigYAlign = qs.y_align;
            this._qsBtnOrigXAlign = qs.x_align;
            this._qsBtnOrigYExpand = qs.y_expand;
            this._qsBtnOrigXExpand = qs.x_expand;
            qs.y_align = Clutter.ActorAlign.CENTER;
            qs.x_align = Clutter.ActorAlign.CENTER;
            qs.y_expand = false;
            qs.x_expand = false;

            container.add_style_class_name('dock-system-item');
            container.add_style_class_name('dock-quick-settings-item');
            this._systemBox.add_child(container);
            this._qsReparented = true;

            this._updateMenuSide(qs.menu, this._position);

            if (qs.menu) {
                qs.menu.connectObject?.(
                    'open-state-changed', (_m, open) => this._onMenuStateChanged(open),
                    this
                );
            }
        }

        _restoreQuickSettings() {
            const qs = Main.panel?.statusArea?.quickSettings;
            if (!this._qsReparented || !qs?.container)
                return;

            const container = qs.container;
            container.remove_style_class_name('dock-system-item');
            container.remove_style_class_name('dock-quick-settings-item');

            if (this._qsOrigYAlign !== undefined) container.y_align = this._qsOrigYAlign;
            if (this._qsOrigXAlign !== undefined) container.x_align = this._qsOrigXAlign;
            if (this._qsOrigYExpand !== undefined) container.y_expand = this._qsOrigYExpand;
            if (this._qsOrigXExpand !== undefined) container.x_expand = this._qsOrigXExpand;

            if (this._qsBtnOrigYAlign !== undefined) qs.y_align = this._qsBtnOrigYAlign;
            if (this._qsBtnOrigXAlign !== undefined) qs.x_align = this._qsBtnOrigXAlign;
            if (this._qsBtnOrigYExpand !== undefined) qs.y_expand = this._qsBtnOrigYExpand;
            if (this._qsBtnOrigXExpand !== undefined) qs.x_expand = this._qsBtnOrigXExpand;

            if (container.get_parent() === this._systemBox)
                this._systemBox.remove_child(container);

            this._restoreMenuSide(qs.menu);
            qs.menu?.disconnectObject?.(this);

            if (this._qsOrigParent) {
                const nChildren = this._qsOrigParent.get_n_children();
                if (this._qsOrigIndex >= 0 && this._qsOrigIndex < nChildren)
                    this._qsOrigParent.insert_child_at_index(container, this._qsOrigIndex);
                else
                    this._qsOrigParent.add_child(container);
            }

            this._qsReparented = false;
            this._qsOrigParent = null;
            this._qsOrigIndex = -1;
        }

        _reparentDateMenu() {
            const dm = Main.panel?.statusArea?.dateMenu;
            if (!dm || !dm.container)
                return;

            const container = dm.container;
            this._dmOrigParent = container.get_parent();
            if (!this._dmOrigParent)
                return;

            this._dmOrigIndex = this._dmOrigParent.get_children().indexOf(container);
            this._dmOrigParent.remove_child(container);

            this._dmOrigYAlign = container.y_align;
            this._dmOrigXAlign = container.x_align;
            this._dmOrigYExpand = container.y_expand;
            this._dmOrigXExpand = container.x_expand;
            container.y_align = Clutter.ActorAlign.CENTER;
            container.x_align = Clutter.ActorAlign.CENTER;
            container.y_expand = false;
            container.x_expand = false;

            this._dmBtnOrigYAlign = dm.y_align;
            this._dmBtnOrigXAlign = dm.x_align;
            this._dmBtnOrigYExpand = dm.y_expand;
            this._dmBtnOrigXExpand = dm.x_expand;
            dm.y_align = Clutter.ActorAlign.CENTER;
            dm.x_align = Clutter.ActorAlign.CENTER;
            dm.y_expand = false;
            dm.x_expand = false;

            container.add_style_class_name('dock-system-item');
            container.add_style_class_name('dock-date-menu-item');

            const qsContainer = Main.panel?.statusArea?.quickSettings?.container;
            if (qsContainer && this._systemBox.contains(qsContainer))
                this._systemBox.insert_child_below(container, qsContainer);
            else
                this._systemBox.add_child(container);

            this._dmReparented = true;

            this._updateMenuSide(dm.menu, this._position);

            if (dm.menu) {
                dm.menu.connectObject?.(
                    'open-state-changed', (_m, open) => this._onMenuStateChanged(open),
                    this
                );
            }
        }

        _restoreDateMenu() {
            const dm = Main.panel?.statusArea?.dateMenu;
            if (!this._dmReparented || !dm?.container)
                return;

            const container = dm.container;
            container.remove_style_class_name('dock-system-item');
            container.remove_style_class_name('dock-date-menu-item');

            if (this._dmOrigYAlign !== undefined) container.y_align = this._dmOrigYAlign;
            if (this._dmOrigXAlign !== undefined) container.x_align = this._dmOrigXAlign;
            if (this._dmOrigYExpand !== undefined) container.y_expand = this._dmOrigYExpand;
            if (this._dmOrigXExpand !== undefined) container.x_expand = this._dmOrigXExpand;

            if (this._dmBtnOrigYAlign !== undefined) dm.y_align = this._dmBtnOrigYAlign;
            if (this._dmBtnOrigXAlign !== undefined) dm.x_align = this._dmBtnOrigXAlign;
            if (this._dmBtnOrigYExpand !== undefined) dm.y_expand = this._dmBtnOrigYExpand;
            if (this._dmBtnOrigXExpand !== undefined) dm.x_expand = this._dmBtnOrigXExpand;

            if (container.get_parent() === this._systemBox)
                this._systemBox.remove_child(container);

            this._restoreMenuSide(dm.menu);
            dm.menu?.disconnectObject?.(this);

            if (this._dmOrigParent) {
                const nChildren = this._dmOrigParent.get_n_children();
                if (this._dmOrigIndex >= 0 && this._dmOrigIndex < nChildren)
                    this._dmOrigParent.insert_child_at_index(container, this._dmOrigIndex);
                else
                    this._dmOrigParent.add_child(container);
            }

            this._dmReparented = false;
            this._dmOrigParent = null;
            this._dmOrigIndex = -1;
        }

        _updateMenuSide(menu, position) {
            if (!menu)
                return;

            let side;
            switch (position) {
            case 'left':
                side = St.Side.LEFT;
                break;
            case 'right':
                side = St.Side.RIGHT;
                break;
            default: // 'bottom'
                side = St.Side.BOTTOM;
                break;
            }

            if (menu._boxPointer?.updateArrowSide)
                menu._boxPointer.updateArrowSide(side);
            else if (menu._boxPointer)
                menu._boxPointer._arrowSide = side;
            menu._arrowSide = side;
        }

        _restoreMenuSide(menu) {
            if (!menu)
                return;

            if (menu._boxPointer?.updateArrowSide)
                menu._boxPointer.updateArrowSide(St.Side.TOP);
            else if (menu._boxPointer)
                menu._boxPointer._arrowSide = St.Side.TOP;
            menu._arrowSide = St.Side.TOP;
        }

        _cleanupSystemStatusArea() {
            this._restoreQuickSettings();
            this._restoreDateMenu();

            if (this._systemSeparator) {
                this._systemSeparator.destroy();
                this._systemSeparator = null;
            }

            if (this._systemBox) {
                this._systemBox.remove_all_children();
                this._systemBox.visible = false;
            }
        }

        _syncThemeMode() {
            const mode = this._settings?.get_string('theme-mode') || 'expressive';
            const allModes = ['expressive', 'black-outline', 'vanilla-gnome'];

            for (const m of allModes) {
                this.remove_style_class_name(`theme-${m}`);
                this._dockPill?.remove_style_class_name(`theme-${m}`);
            }

            this.add_style_class_name(`theme-${mode}`);
            this._dockPill?.add_style_class_name(`theme-${mode}`);
        }

        _syncAccentColor() {
            const colorName = this._interfaceSettings?.get_string('accent-color') || 'blue';
            const allColors = ['blue', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'slate'];

            for (const c of allColors) {
                this.remove_style_class_name(`accent-${c}`);
                this._dockPill?.remove_style_class_name(`accent-${c}`);
            }

            this.add_style_class_name(`accent-${colorName}`);
            this._dockPill?.add_style_class_name(`accent-${colorName}`);
        }

        getPreferredThickness() {
            return this._dockHeight || DOCK_HEIGHT;
        }

        getPreferredHeight() {
            return this.getPreferredThickness();
        }

        updatePosition() {
            const monitor = Main.layoutManager.primaryMonitor;
            if (!monitor)
                return;

            const thickness = this.getPreferredThickness();
            const pos = this._position || 'bottom';
            const panelHeight = (Main.panel && Main.panel.visible) ? Main.panel.height : 0;
            const topY = monitor.y + panelHeight;
            const availableHeight = Math.max(0, monitor.height - panelHeight);

            if (pos === 'left') {
                if (this._autohide && this._isDockHidden) {
                    this.set_position(monitor.x, topY);
                    this.set_size(4, availableHeight);
                } else {
                    this.set_position(monitor.x, topY);
                    this.set_size(thickness, availableHeight);
                }
            } else if (pos === 'right') {
                if (this._autohide && this._isDockHidden) {
                    this.set_position(monitor.x + monitor.width - 4, topY);
                    this.set_size(4, availableHeight);
                } else {
                    this.set_position(monitor.x + monitor.width - thickness, topY);
                    this.set_size(thickness, availableHeight);
                }
            } else {
                // Default: bottom
                if (this._autohide && this._isDockHidden) {
                    this.set_position(monitor.x, monitor.y + monitor.height - 4);
                    this.set_size(monitor.width, 4);
                } else {
                    this.set_position(monitor.x, monitor.y + monitor.height - thickness);
                    this.set_size(monitor.width, thickness);
                }
            }

            if (this._isBarMode)
                this._applyBarMode();
        }

        _redisplay() {
            const favorites = this._appFavorites.getFavorites();
            const running = this._appSystem.get_running();

            const favoriteIds = new Set(favorites.map(app => app.get_id()));
            const nonFavoriteRunning = running.filter(app => !favoriteIds.has(app.get_id()));

            // The complete set of apps that should currently be in the dock
            const targetApps = [...favorites, ...nonFavoriteRunning];
            const targetIds = new Set(targetApps.map(app => app.get_id()));

            // 1. Destroy and delete icons that are no longer favorites and no longer running
            for (const [id, icon] of this._appIcons.entries()) {
                if (!targetIds.has(id)) {
                    if (icon.get_parent() === this._iconsBox)
                        this._iconsBox.remove_child(icon);
                    icon.destroy();
                    this._appIcons.delete(id);
                }
            }

            // 2. Remove all remaining children from _iconsBox WITHOUT destroying them
            this._iconsBox.remove_all_children();

            // 3. Add favorite icons in order
            for (const app of favorites) {
                const id = app.get_id();
                let icon = this._appIcons.get(id);
                if (!icon) {
                    icon = new DockAppIcon(app, this._iconSize, this);
                    this._appIcons.set(id, icon);
                } else {
                    icon.setIconSize(this._iconSize);
                }
                icon.set_x_expand(false);
                icon.set_y_expand(false);
                icon.updatePositionStyle?.(this._position || 'bottom');
                this._iconsBox.add_child(icon);
            }

            // 4. Separator if both favorites and running non-favorites exist
            if (favorites.length > 0 && nonFavoriteRunning.length > 0) {
                if (!this._separator) {
                    this._separator = new St.Widget({
                        style_class: 'dock-separator',
                    });
                }
                this._separator.set_x_expand(false);
                this._separator.set_y_expand(false);
                if (this._position === 'left' || this._position === 'right') {
                    this._separator.x_align = Clutter.ActorAlign.CENTER;
                    this._separator.y_align = Clutter.ActorAlign.FILL;
                } else {
                    this._separator.y_align = Clutter.ActorAlign.CENTER;
                    this._separator.x_align = Clutter.ActorAlign.FILL;
                }
                this._iconsBox.add_child(this._separator);
            }

            // 5. Add running non-favorite apps in order
            for (const app of nonFavoriteRunning) {
                const id = app.get_id();
                let icon = this._appIcons.get(id);
                if (!icon) {
                    icon = new DockAppIcon(app, this._iconSize, this);
                    this._appIcons.set(id, icon);
                } else {
                    icon.setIconSize(this._iconSize);
                }
                icon.set_x_expand(false);
                icon.set_y_expand(false);
                icon.updatePositionStyle?.(this._position || 'bottom');
                this._iconsBox.add_child(icon);
            }

            this._updateActiveWindow();
            this._scheduleBarModeUpdate();
            if (this._isBarMode)
                this._applyBarMode();
            this._iconsBox.queue_relayout();
            this._dockPill.queue_relayout();
        }

        _updateActiveWindow() {
            const focusWindow = global.display.focus_window;
            for (const icon of this._appIcons.values()) {
                icon.updateActiveState(focusWindow);
            }
        }

        _syncExtendOnMaximize() {
            this._extendOnMaximize = this._settings?.get_boolean('extend-on-maximize') ?? true;
            this._scheduleBarModeUpdate();
        }

        _syncAlwaysBarMode() {
            this._alwaysBarMode = this._settings?.get_boolean('always-bar-mode') ?? false;
            this._scheduleBarModeUpdate();
        }

        _syncBarIconsAlignment() {
            const alignment = this._settings?.get_string('bar-icons-alignment') || 'center';
            const valid = ['center', 'left'];
            this._barIconsAlignment = valid.includes(alignment) ? alignment : 'center';
            if (this._isBarMode)
                this._applyBarMode();
        }

        _onWorkspaceChanged() {
            this._trackWorkspaceWindows();
            this._updateActiveWindow();
            this._scheduleBarModeUpdate();
        }

        _onWindowCreated(win) {
            this._trackWindow(win);
            this._scheduleBarModeUpdate();
        }

        _trackWorkspaceWindows() {
            if (this._trackedWindows) {
                for (const win of this._trackedWindows) {
                    win.disconnectObject?.(this);
                }
                this._trackedWindows.clear();
            } else {
                this._trackedWindows = new Set();
            }

            const ws = global.workspace_manager.get_active_workspace();
            if (!ws)
                return;

            const windows = ws.list_windows();
            for (const win of windows) {
                this._trackWindow(win);
            }
        }

        _trackWindow(win) {
            if (!win || this._trackedWindows?.has(win))
                return;

            this._trackedWindows.add(win);
            win.connectObject(
                'notify::maximized-horizontally', () => this._scheduleBarModeUpdate(),
                'notify::maximized-vertically', () => this._scheduleBarModeUpdate(),
                'notify::fullscreen', () => this._scheduleBarModeUpdate(),
                'notify::minimized', () => this._scheduleBarModeUpdate(),
                'unmanaged', () => {
                    this._trackedWindows?.delete(win);
                    this._scheduleBarModeUpdate();
                },
                this
            );
        }

        _hasMaximizedOrFullscreenWindow() {
            const primaryMonitorIndex = Main.layoutManager.primaryIndex;
            const ws = global.workspace_manager.get_active_workspace();
            if (!ws)
                return false;

            const windows = ws.list_windows();
            for (const win of windows) {
                if (!win)
                    continue;

                // Ignorer les fenêtres en cours de fermeture / destruction
                if (win.unmanaging || !win.get_compositor_private?.())
                    continue;

                // Uniquement les fenêtres sur l'écran principal où se trouve le dock
                if (win.get_monitor() !== primaryMonitorIndex)
                    continue;

                // Ignorer les fenêtres minimisées ou masquées
                if (win.minimized || win.is_hidden())
                    continue;

                // Ignorer les fenêtres non-normales (dialogues, popups, splash, etc.)
                const winType = win.get_window_type();
                if (winType !== Meta.WindowType.NORMAL)
                    continue;

                // Fenêtre en plein écran (F11 / vidéo / jeu)
                if (win.is_fullscreen())
                    return true;

                // Fenêtre qui prend tout l'écran (maximisée horizontalement ET verticalement)
                const isFullyMaximized = (win.maximized_horizontally && win.maximized_vertically) ||
                    (typeof win.get_maximize_flags === 'function' &&
                        (win.get_maximize_flags() & Meta.MaximizeFlags.BOTH) === Meta.MaximizeFlags.BOTH);

                if (isFullyMaximized)
                    return true;
            }

            return false;
        }

        _scheduleBarModeUpdate() {
            if (this._barModeUpdateId)
                return;

            this._barModeUpdateId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._barModeUpdateId = 0;
                this._updateBarMode();
                return GLib.SOURCE_REMOVE;
            });
        }

        _updateBarMode() {
            const shouldBeBar = !this._autohide && (this._alwaysBarMode || (this._extendOnMaximize && this._hasMaximizedOrFullscreenWindow()));
            if (this._isBarMode === shouldBeBar)
                return;

            this._isBarMode = shouldBeBar;
            this._applyBarMode();
        }

        _applyBarMode() {
            const monitor = Main.layoutManager.primaryMonitor;
            const thickness = this.getPreferredThickness();
            const isVertical = this._position === 'left' || this._position === 'right';
            const panelHeight = (Main.panel && Main.panel.visible) ? Main.panel.height : 0;
            const availableHeight = monitor ? Math.max(0, monitor.height - panelHeight) : 0;

            if (this._isBarMode && monitor) {
                this.add_style_class_name('mode-bar');
                this._dockPill.add_style_class_name('mode-bar');

                if (this._position === 'bottom') {
                    this._dockPill.width = monitor.width;
                    this._dockPill.height = thickness;
                    this._dockPill.x_align = Clutter.ActorAlign.FILL;
                    this._dockPill.y_align = Clutter.ActorAlign.FILL;
                    this._dockPill.set_style('border-radius: 0px !important; border-bottom: none !important; border-left: none !important; border-right: none !important; margin: 0px !important; padding-left: 0px !important; padding-right: 0px !important;');
                } else if (this._position === 'left') {
                    this._dockPill.width = thickness;
                    this._dockPill.height = availableHeight;
                    this._dockPill.x_align = Clutter.ActorAlign.FILL;
                    this._dockPill.y_align = Clutter.ActorAlign.FILL;
                    this._dockPill.set_style('border-radius: 0px !important; border-left: none !important; border-top: none !important; border-bottom: none !important; margin: 0px !important; padding-top: 0px !important; padding-bottom: 0px !important;');
                } else if (this._position === 'right') {
                    this._dockPill.width = thickness;
                    this._dockPill.height = availableHeight;
                    this._dockPill.x_align = Clutter.ActorAlign.FILL;
                    this._dockPill.y_align = Clutter.ActorAlign.FILL;
                    this._dockPill.set_style('border-radius: 0px !important; border-right: none !important; border-top: none !important; border-bottom: none !important; margin: 0px !important; padding-top: 0px !important; padding-bottom: 0px !important;');
                }

                const alignment = this._barIconsAlignment || 'center';

                if (alignment === 'center') {
                    this._leadingSpacer.visible = true;
                    this._leadingSpacer.x_expand = !isVertical;
                    this._leadingSpacer.y_expand = isVertical;
                    this._leadingSpacer.width = 0;
                    this._leadingSpacer.height = 0;

                    this._trailingSpacer.visible = true;
                    this._trailingSpacer.x_expand = !isVertical;
                    this._trailingSpacer.y_expand = isVertical;
                    this._trailingSpacer.width = 0;
                    this._trailingSpacer.height = 0;

                    this._iconsBox.x_align = Clutter.ActorAlign.CENTER;
                } else if (alignment === 'left') {
                    this._leadingSpacer.visible = true;
                    this._leadingSpacer.x_expand = false;
                    this._leadingSpacer.y_expand = false;
                    if (isVertical) {
                        this._leadingSpacer.height = 8;
                        this._leadingSpacer.width = 0;
                    } else {
                        this._leadingSpacer.width = 8;
                        this._leadingSpacer.height = 0;
                    }

                    this._trailingSpacer.visible = true;
                    this._trailingSpacer.x_expand = !isVertical;
                    this._trailingSpacer.y_expand = isVertical;
                    this._trailingSpacer.width = 0;
                    this._trailingSpacer.height = 0;

                    this._iconsBox.x_align = Clutter.ActorAlign.START;
                }
            } else {
                this.remove_style_class_name('mode-bar');
                this._dockPill.remove_style_class_name('mode-bar');

                this._dockPill.set_style(null);
                this._dockPill.width = -1;
                this._dockPill.height = -1;

                this._leadingSpacer.visible = false;
                this._leadingSpacer.x_expand = false;
                this._leadingSpacer.y_expand = false;
                this._leadingSpacer.width = 0;
                this._leadingSpacer.height = 0;

                this._trailingSpacer.visible = false;
                this._trailingSpacer.x_expand = false;
                this._trailingSpacer.y_expand = false;
                this._trailingSpacer.width = 0;
                this._trailingSpacer.height = 0;

                if (this._position === 'bottom') {
                    this._dockPill.x_align = Clutter.ActorAlign.CENTER;
                    this._dockPill.y_align = Clutter.ActorAlign.END;
                } else if (this._position === 'left') {
                    this._dockPill.x_align = Clutter.ActorAlign.START;
                    this._dockPill.y_align = Clutter.ActorAlign.CENTER;
                } else if (this._position === 'right') {
                    this._dockPill.x_align = Clutter.ActorAlign.END;
                    this._dockPill.y_align = Clutter.ActorAlign.CENTER;
                }

                this._iconsBox.x_align = Clutter.ActorAlign.CENTER;
            }

            this._activitiesButton?.set_x_expand(false);
            this._activitiesButton?.set_y_expand(false);
            this._showAppsButton?.set_x_expand(false);
            this._showAppsButton?.set_y_expand(false);
            this._iconsBox.set_x_expand(false);
            this._iconsBox.set_y_expand(false);

            this._iconsBox.queue_relayout();
            this._dockPill.queue_relayout();
            this.queue_relayout();
        }

        // Drag-and-drop support: reorder favorites inside Arrera Dock
        handleDragOver(source, _actor, x, y, _step) {
            const app = source.app;
            if (!app)
                return DND.DragMotionResult.NO_DROP;

            return DND.DragMotionResult.MOVE_DROP;
        }

        acceptDrop(source, _actor, x, y, _time) {
            const app = source.app;
            if (!app)
                return false;

            const id = app.get_id();
            const favorites = this._appFavorites.getFavorites();

            const isVertical = this._position === 'left' || this._position === 'right';
            const coord = isVertical ? y : x;
            const totalSize = isVertical ? this._iconsBox.height : this._iconsBox.width;

            let pos = Math.min(
                Math.floor((coord / Math.max(1, totalSize)) * favorites.length),
                favorites.length
            );

            if (this._appFavorites.isFavorite(id))
                this._appFavorites.moveFavoriteToPos(id, pos);
            else
                this._appFavorites.addFavoriteAtPos(id, pos);

            return true;
        }

        destroy() {
            if (this._autohideTimeoutId) {
                GLib.source_remove(this._autohideTimeoutId);
                this._autohideTimeoutId = 0;
            }

            if (this._barModeUpdateId) {
                GLib.source_remove(this._barModeUpdateId);
                this._barModeUpdateId = 0;
            }

            Main.overview.disconnectObject(this);
            const controls = Main.overview._overview?._controls;
            if (controls?._stateAdjustment)
                controls._stateAdjustment.disconnectObject(this);

            if (this._trackedWindows) {
                for (const win of this._trackedWindows) {
                    win.disconnectObject?.(this);
                }
                this._trackedWindows.clear();
                this._trackedWindows = null;
            }

            global.window_manager.disconnectObject(this);

            this._appFavorites.disconnectObject(this);
            this._appSystem.disconnectObject(this);
            global.display.disconnectObject(this);
            global.workspace_manager.disconnectObject(this);

            if (this._settings) {
                this._settings.disconnectObject(this);
                this._settings = null;
            }

            for (const icon of this._appIcons.values()) {
                icon.destroy();
            }
            this._appIcons.clear();

            if (this._separator) {
                this._separator.destroy();
                this._separator = null;
            }

            this._cleanupActivitiesButton();
            this._cleanupSystemStatusArea();

            if (this._systemBox) {
                this._systemBox.destroy();
                this._systemBox = null;
            }

            if (this._interfaceSettings) {
                this._interfaceSettings.disconnectObject(this);
                this._interfaceSettings = null;
            }

            Main.panel.disconnectObject?.(this);

            super.destroy();
        }
    });
