const { GObject, GLib, Gio} = imports.gi;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const Soup = imports.gi.Soup;

/*
Helper functions!
*/

let iconCache = {};

var SignalsHandlerFlags = {
    NONE: 0,
    CONNECT_AFTER: 1
};

/**
 * Simplify global signals and function injections handling
 * abstract class
 */
const BasicHandler = class BasicHandler {

    constructor() {
        this._storage = new Object();
    }

    add(/* unlimited 3-long array arguments */) {
        // Convert arguments object to array, concatenate with generic
        // Call addWithLabel with ags as if they were passed arguments
        this.addWithLabel('generic', ...arguments);
    }

    destroy() {
        for( let label in this._storage )
            this.removeWithLabel(label);
    }

    addWithLabel(label /* plus unlimited 3-long array arguments*/) {
        if (this._storage[label] == undefined)
            this._storage[label] = new Array();

        // Skip first element of the arguments
        for (let i = 1; i < arguments.length; i++) {
            let item = this._storage[label];
            try {
                item.push(this._create(arguments[i]));
            } catch (e) {
                logError(e);
            }
        }
    }

    removeWithLabel(label) {
        if (this._storage[label]) {
            for (let i = 0; i < this._storage[label].length; i++)
                this._remove(this._storage[label][i]);

            delete this._storage[label];
        }
    }

    // Virtual methods to be implemented by subclass

    /**
     * Create single element to be stored in the storage structure
     */
    _create(item) {
        throw new GObject.NotImplementedError(`_create in ${this.constructor.name}`);
    }

    /**
     * Correctly delete single element
     */
    _remove(item) {
        throw new GObject.NotImplementedError(`_remove in ${this.constructor.name}`);
    }
};

/**
 * Manage global signals
 */
var GlobalSignalsHandler = class GlobalSignalsHandler extends BasicHandler {

    _create(item) {
        let object = item[0];
        let event = item[1];
        let callback = item[2]
        let flags = item.length > 3 ? item[3] : SignalsHandlerFlags.NONE;

        if (!object)
            throw new Error('Impossible to connect to an invalid object');

        let after = flags == SignalsHandlerFlags.CONNECT_AFTER;
        let connector = after ? object.connect_after : object.connect;

        if (!connector) {
            throw new Error(`Requested to connect to signal '${event}', ` +
                `but no implementation for 'connect${after ? '_after' : ''}' `+
                `found in ${object.constructor.name}`);
        }

        let id = connector.call(object, event, callback);

        return [object, id];
    }

    _remove(item) {
         item[0].disconnect(item[1]);
    }
};

function tokenizeChatText(text) {
    let result = [];
    let current = '';
    let token = '';
    let tokenStarted = false;

    for (let c = 0; c < text.length; c++) {
        let ch = text[c];

        if (ch == '\n') {
            result.push({'linebreak': true});
        } else if (ch == ' ') {
            // Token broken by space...so not a token
            if (tokenStarted) {
                current += token;
                tokenStarted = false;
                token = '';
            }

            result.push({'text': current + ' ', 'command': false});
            current = '';
            continue;

        } else if (ch == '>') {
            if (tokenStarted) {
                if (current != '') {
                    result.push({'text': current, 'command': false});
                    current = '';
                }
                tokenStarted = false;
                //result.push({'text': ' ', 'command': false});
                result.push({'text': token, 'command': true});
                token = '';
                continue;
            } 
        } else if (ch == '<') {
            token = '';
            tokenStarted = true;
            continue;
        }

        if (tokenStarted) {
            token += ch;
        } else {
            current += ch;
        }
    }

    if (current) {
        result.push({'text': current, 'command': false});
    }

    if (token) {
        result.push({'text': token, 'command': false});
    }
    
    return result;
}

function safeColorHex(hexStr) {
    let colorStr = hexStr.substr(0, 6);
    let r = parseInt(colorStr.substr(0, 2), 16);
    let g = parseInt(colorStr.substr(2, 2), 16);
    let b = parseInt(colorStr.substr(4, 2), 16);

    let luminance = 0.2126*r + 0.7152*g + 0.0722*b;
    
    if (luminance < 200) {
        r += 32 & 0xff;
        g += 32 & 0xff;
        b += 32 & 0xff;
    }

    let ret = r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
    
    return ret;
}

function limitSize(width, height, maxWidth, maxHeight) {    
    
    if(maxWidth && width > maxWidth){
        ratio = maxWidth / width;   // get ratio for scaling image
        height = height * ratio;    // Reset height to match scaled image
        width = width * ratio;    // Reset width to match scaled image
    }

    if(maxHeight && height > maxHeight){
        ratio = maxHeight / height; // get ratio for scaling image
        width = width * ratio;    // Reset width to match scaled image
        height = height * ratio;    // Reset height to match scaled image
    }

    return [width, height];
}


function loadIcon(id, url, cb) {

    if (iconCache[id]) {
        cb(iconCache[id]);
        return;
    }

    var _httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
    var request = Soup.Message.new('GET', url);
    
    _httpSession.queue_message(request, function(_httpSession, message) {
        
        let buffer = message.response_body.flatten();
        let bytes = buffer.get_data();
        let gicon = Gio.BytesIcon.new(bytes);
        
        iconCache[id] = gicon;
        cb(iconCache[id]);

    });
}

function loadImage(url, cb) {

    var _httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
    var request = Soup.Message.new('GET', url);
    
    _httpSession.queue_message(request, function(_httpSession, message) {
        
        let buffer = message.response_body.flatten();
        let bytes = buffer.get_data();

        let input_stream = Gio.MemoryInputStream.new_from_bytes(bytes);
        let pixbuf = GdkPixbuf.Pixbuf.new_from_stream(input_stream, null);
    
        var image = new Clutter.Image();
        
        image.set_bytes(pixbuf.get_pixels(), 
            pixbuf.has_alpha ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888, 
            pixbuf.get_width(), pixbuf.get_height(), 
            pixbuf.get_rowstride());

        cb(image);
    });
}
