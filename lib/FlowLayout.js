const { GObject, GLib, Gio} = imports.gi;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

var FlowLayout = GObject.registerClass(
class FlowLayout extends St.Viewport {
    _init(params) {
        super._init(params);
        let layout = new Clutter.FlowLayout({snap_to_grid: false, orientation: Clutter.FlowOrientation.HORIZONTAL});
        this.set_layout_manager(layout);
    }
});