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
        const autohide = this._settings?.get_boolean('autohide') ?? false;

        this._dock = new ArreraDock(this);
        globalThis.arreraDock = this._dock;

        // Position and add dock as top chrome
        // affectsStruts: true ensures desktop windows maximize above the dock (when autohide is off)
        // trackFullscreen: true ensures dock hides during fullscreen media/games
        Main.layoutManager.addTopChrome(this._dock, {
            affectsStruts: !autohide,
            trackFullscreen: true,
        });

        // Update position when monitors or resolution change
        Main.layoutManager.connectObject(
            'monitors-changed', () => this._updateDockPosition(),
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

    updateChromeStruts(affectsStruts) {
        if (!this._dock)
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

        // Remove dock from chrome and destroy
        if (this._dock) {
            if (globalThis.arreraDock === this._dock)
                delete globalThis.arreraDock;

            Main.layoutManager.removeChrome(this._dock);
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