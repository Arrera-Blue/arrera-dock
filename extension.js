/* extension.js
 *
 * Arrera Dock - Extension GNOME Shell
 * Distribution Arrera Blue
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { ArreraDock } from './dock.js';

export default class ArreraDockExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        this._dock = new ArreraDock(this);
        globalThis.arreraDock = this._dock;

        // Position and set dock layer (top chrome vs desktop wallpaper layer in island mode)
        this.updateDockLayer();

        // Update position when monitors or resolution change
        Main.layoutManager.connectObject(
            'monitors-changed', () => this._updateDockPosition(),
            this
        );

        // Keep dock anchored directly above background and below windows in island mode
        global.display.connectObject(
            'restacked', () => this.ensureDockZOrder(),
            this
        );

        this._updateDockPosition();

        // Totally replace the native dash in the overview
        this._replaceNativeDash();
    }

    get dock() {
        return this._dock;
    }

    _updateDockPosition() {
        if (this._dock)
            this._dock.updatePosition();
    }

    ensureDockZOrder() {
        if (!this._dock)
            return;

        const isIslandMode = this._settings?.get_boolean('island-mode') ?? false;
        if (isIslandMode && this._dock.get_parent() === global.window_group && Main.layoutManager._backgroundGroup) {
            global.window_group.set_child_above_sibling(this._dock, Main.layoutManager._backgroundGroup);
        }
    }

    updateDockLayer(isIslandMode = null) {
        if (!this._dock)
            return;

        if (isIslandMode === null)
            isIslandMode = this._settings?.get_boolean('island-mode') ?? false;

        const autohide = this._settings?.get_boolean('autohide') ?? false;

        if (isIslandMode) {
            // Remove from top chrome so it does not affect struts and windows can overlap dock
            if (Main.layoutManager.uiGroup.contains(this._dock)) {
                Main.layoutManager.removeChrome(this._dock);
            }

            // Anchor directly to desktop (in window_group above wallpaper, below all windows)
            if (!Main.overview.visible) {
                if (this._dock.get_parent() !== global.window_group) {
                    if (this._dock.get_parent())
                        this._dock.get_parent().remove_child(this._dock);
                    global.window_group.add_child(this._dock);
                }
                this.ensureDockZOrder();
            } else {
                if (this._dock.get_parent() !== Main.layoutManager.overviewGroup) {
                    if (this._dock.get_parent())
                        this._dock.get_parent().remove_child(this._dock);
                    Main.layoutManager.overviewGroup.add_child(this._dock);
                }
            }
        } else {
            // Restore normal top chrome mode
            if (global.window_group.contains(this._dock)) {
                global.window_group.remove_child(this._dock);
            }
            if (Main.layoutManager.overviewGroup?.contains(this._dock)) {
                Main.layoutManager.overviewGroup.remove_child(this._dock);
            }

            if (!Main.layoutManager.uiGroup.contains(this._dock)) {
                Main.layoutManager.addTopChrome(this._dock, {
                    affectsStruts: !autohide,
                    trackFullscreen: true,
                });
            } else {
                Main.layoutManager.removeChrome(this._dock);
                Main.layoutManager.addTopChrome(this._dock, {
                    affectsStruts: !autohide,
                    trackFullscreen: true,
                });
            }
        }

        this._updateDockPosition();
    }

    updateChromeStruts(affectsStruts) {
        if (!this._dock)
            return;

        const isIslandMode = this._settings?.get_boolean('island-mode') ?? false;
        if (isIslandMode)
            return;

        Main.layoutManager.removeChrome(this._dock);
        Main.layoutManager.addTopChrome(this._dock, {
            affectsStruts,
            trackFullscreen: true,
        });
        this._updateDockPosition();
    }

    _replaceNativeDash() {
        const nativeDash = Main.overview.dash;
        if (!nativeDash)
            return;

        // Backup original state
        this._origDashVisible = nativeDash.visible;
        this._origDashOpacity = nativeDash.opacity;
        this._origGetPreferredHeight = nativeDash.get_preferred_height;
        this._origGetPreferredWidth = nativeDash.get_preferred_width;

        // Make native dash completely invisible and inactive
        nativeDash.visible = false;
        nativeDash.opacity = 0;

        // Override preferred height so GNOME Shell's overview controls (ControlsManagerLayout)
        // reserve the exact dock height at the bottom, perfectly preserving the default GNOME
        // workspace card size, centered positioning, and comfortable bottom margin.
        nativeDash.get_preferred_height = (_forWidth) => {
            const dockHeight = this._dock ? this._dock.getPreferredHeight() : 72;
            return [dockHeight, dockHeight];
        };

        nativeDash.get_preferred_width = (_forHeight) => {
            return [0, 0];
        };

        // Relayout overview controls
        const controls = Main.overview._overview?._controls;
        if (controls)
            controls.queue_relayout();
    }

    _restoreNativeDash() {
        const nativeDash = Main.overview.dash;
        if (!nativeDash)
            return;

        if (this._origGetPreferredHeight)
            nativeDash.get_preferred_height = this._origGetPreferredHeight;
        if (this._origGetPreferredWidth)
            nativeDash.get_preferred_width = this._origGetPreferredWidth;

        nativeDash.visible = this._origDashVisible ?? true;
        nativeDash.opacity = this._origDashOpacity ?? 255;

        const controls = Main.overview._overview?._controls;
        if (controls)
            controls.queue_relayout();
    }

    disable() {
        // Restore native dash
        this._restoreNativeDash();

        global.display.disconnectObject(this);

        // Remove dock from chrome or container and destroy
        if (this._dock) {
            if (globalThis.arreraDock === this._dock)
                delete globalThis.arreraDock;

            if (Main.layoutManager.uiGroup.contains(this._dock))
                Main.layoutManager.removeChrome(this._dock);
            else if (global.window_group.contains(this._dock))
                global.window_group.remove_child(this._dock);
            else if (Main.layoutManager.overviewGroup?.contains(this._dock))
                Main.layoutManager.overviewGroup.remove_child(this._dock);
            else if (this._dock.get_parent())
                this._dock.get_parent().remove_child(this._dock);

            this._dock.destroy();
            this._dock = null;
        }

        if (this._settings) {
            this._settings.disconnectObject(this);
            this._settings = null;
        }

        Main.layoutManager.disconnectObject(this);
    }
}