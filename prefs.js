'use strict';

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GdkPixbuf = imports.gi.GdkPixbuf;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();


function init() {
}

function buildPrefsWidget() {

    // Copy the same GSettings code from `extension.js`
    let gschema = Gio.SettingsSchemaSource.new_from_directory(
        Me.dir.get_child('schemas').get_path(),
        Gio.SettingsSchemaSource.get_default(),
        false
    );

    this.settings = new Gio.Settings({
        settings_schema: gschema.lookup('org.gnome.shell.extensions.excord', true)
    });

    // Create a parent widget that we'll return from this function
    let prefsWidget = new Gtk.Grid({
        margin: 18,
        column_spacing: 12,
        row_spacing: 12,
        visible: true
    });

    let current_row = 0;
    let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(`${Me.path}/media/discord_offline.svg`, 128, 128, true);
    let image = Gtk.Image.new_from_pixbuf(pixbuf);
    image.visible = true;
    prefsWidget.attach(image, 0, current_row, 3, 1);

    current_row++;

    let title = new Gtk.Label({
        label: Me.metadata.name + ' Extension Preferences',
        halign: Gtk.Align.CENTER,
        use_markup: true,
        visible: true
    });
    prefsWidget.attach(title, 0, current_row, 3, 1);

    current_row++;

    // ITEM
    let buttonLabel = new Gtk.Label({
        label: 'Discord token:',
        halign: Gtk.Align.START,
        visible: true
    });
    prefsWidget.attach(buttonLabel, 0, current_row, 1, 1);

    let tokenEntry = new Gtk.Entry({
        visible: true,
        width_chars: 60,
        text: this.settings.get_string ('token'),
    });

    this.settings.bind('token', tokenEntry, 'text', Gio.SettingsBindFlags.DEFAULT);

    prefsWidget.attach(tokenEntry, 1, current_row, 1, 1);

    let connectHelper = new Gtk.Button({
        visible: true,
        label: 'Connect now',
    });

    prefsWidget.attach(connectHelper, 2, current_row, 1, 1);

    current_row++;

    connectHelper.connect('clicked', () => {
        this.settings.set_boolean('connect-helper', !this.settings.get_boolean('connect-helper'));
    })
    
    // ITEM    
    prefsWidget.attach(new Gtk.Label({
        label: 'Auto show on new message:',
        halign: Gtk.Align.START, visible: true }), 0, current_row, 1, 1);

    let showOnNewtoggle = new Gtk.Switch({
        active: this.settings.get_boolean ('show-on-message'),
        halign: Gtk.Align.END,
        visible: true
    });
    prefsWidget.attach(showOnNewtoggle, 1, current_row, 1, 1);
    this.settings.bind('show-on-message', showOnNewtoggle, 'active', Gio.SettingsBindFlags.DEFAULT);

    current_row++;
    
    // ITEM
    prefsWidget.attach(new Gtk.Label({
        label: 'Play sound on new message:',
        halign: Gtk.Align.START, visible: true }), 0, current_row, 1, 1);

    let soundOnNewtoggle = new Gtk.Switch({
        active: this.settings.get_boolean ('sound-on-message'),
        halign: Gtk.Align.END,
        visible: true
    });
    prefsWidget.attach(soundOnNewtoggle, 1, current_row, 1, 1);
    this.settings.bind('sound-on-message', soundOnNewtoggle, 'active', Gio.SettingsBindFlags.DEFAULT);

    current_row++;

    // Return our widget which will be added to the window
    return prefsWidget;
}