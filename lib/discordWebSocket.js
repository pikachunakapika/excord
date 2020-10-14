
const Mainloop = imports.mainloop;
const { GObject, GLib, Gio} = imports.gi;
const ByteArray = imports.byteArray;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const Signals = imports.signals;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();    

var DISPATCH           = 0;
var HEARTBEAT          = 1;
var IDENTIFY           = 2;
var PRESENCE           = 3;
var VOICE_STATE        = 4;
var VOICE_PING         = 5;
var RESUME             = 6;
var RECONNECT          = 7;
var REQUEST_MEMBERS    = 8;
var INVALIDATE_SESSION = 9;
var HELLO              = 10;
var HEARTBEAT_ACK      = 11;
var GUILD_SYNC         = 12;


var DiscordWebSocket = class DiscordWebSocket {

    constructor() {
        this.token = null;
        this.connection = null;
        this.isConnected = false;
        this.currentHeartbeats = 0;
        this.heartbeatInterval = 110000;
        
        this.guilds = {};
        this.users = {};
    }

    onNewMessage(d) {
        this.emit('new-message', d);
    }

    onConnected() {
        print('Connected.');
        this.isConnected = true;
        this.identify();

        this.emit('connected');
    }

    onReady() {
        print('Ready.');
        this.emit('ready');
    }

    onClosed() {
        print('Connection closed.');
        this.isConnected = false;
        this.emit('closed');
    }

    setToken(token) {
        if (token) {
           this.token = token.trim();
        } else {
            this.token = '';
        }
    }

    identify() {
        let payload = {
            'op': IDENTIFY,
            'd': { 'token': this.token, 'capabilities': 61, 
            'properties': { 'os': 'Linux', 'browser': 'Gnome', 'browser_version': '3.38'}, // 'device': '', 'browser_user_agent': 'Gnome', 'os_version': '', 'referrer': '', 'referring_domain': '', 'referrer_current': '', 'referring_domain_current': '', 'release_channel': 'stable', 'client_build_number': 68815, 'client_event_source': nul
            'presence': { 'status': 'online', 'since': 0, 'activities': [], 'afk': false }, 
            'compress': false, 
            'client_state': { 'guild_hashes': {}, 'highest_last_message_id': '0', 'read_state_version': 0, 'user_guild_settings_version': -1 } }
        };

        this.connection.send_text(JSON.stringify(payload));
    }

    heartbeat() {

        let payload = {
            'op': HEARTBEAT,
            'd': this.currentHeartbeats
        };

        this.currentHeartbeats++;
        this.connection.send_text(JSON.stringify(payload));

        print('Heartbeat...');

    }

    connect_callback(session, res) {

        this.connection = session.websocket_connect_finish(res);
        this.connection.max_incoming_payload_size = 0;
        
        this.onConnected();

        this.connection.connect('message', (conn, type, message) => this.onMessage(message));
        this.connection.connect('closed', (conn) => this.onClosed());
        this.connection.connect('error', (conn, err) => {
            print("WebSocket Error!");

            if (err) {
                print(err);
            }
        });

    }

    onMessage(message) {

        let data = message.get_data();
        if (data instanceof Uint8Array) {
            data = ByteArray.toString(data).split('\n');
        } else {
            data = data.toString().split('\n');
        }

        let json = JSON.parse(data);

        switch (json.op) {

            case DISPATCH:
                switch (json.t) {

                    case "MESSAGE_CREATE":
                        this.onNewMessage(json.d);
                        break;
                    
                    case "READY": 

                        this.users = {};

                        for (let g = 0; g < json.d.users.length; g++) {
                            const userData = json.d.users[g];
                            this.users[userData.id] = userData.username;
                        }

                        this.guilds = {};

                        for (let g = 0; g < json.d.guilds.length; g++) {
                            const guildData = json.d.guilds[g];

                            if (!guildData.name) {

                                print("Guild entry error!");
                                continue;
                            }

                            this.guilds[ guildData.id ] = {};
                            this.guilds[ guildData.id ].id = guildData.id;
                            this.guilds[ guildData.id ].icon = guildData.icon;
                            this.guilds[ guildData.id ].name = guildData.name.replace(/[^\x20-\x7E]/g, '').trim();
                            this.guilds[ guildData.id ].channels = {};

                            for (let c = 0; c < guildData.channels.length; c++) {
                                const channel = guildData.channels[c];
                                
                                if (channel.type != 0) 
                                    continue;
                                
                                this.guilds[ guildData.id ].channels[ channel.id ] = {};
                                this.guilds[ guildData.id ].channels[ channel.id ].id = channel.id;
                                this.guilds[ guildData.id ].channels[ channel.id ].name = channel.name.replace(/[^\x20-\x7E]/g, '').trim();

                            }
                        }

                        this.onReady();

                        break;
                    case "READY_SUPPLEMENTAL":
                        break;
                    default:
                        //print(json.t);
                        break;
                        
                }
                break;

            case HELLO:
                this.heartbeatInterval = json.d["heartbeat_interval"];
                Mainloop.timeout_add(this.heartbeatInterval, () =>  {
                    this.heartbeat();
                    return true;
                });
                break;
            default:
                print("Unhandled:", json.op);
            
        }
    }

    getAvatarUrl(user_id, avatar, format) {
        BASE = 'https://cdn.discordapp.com';
        return BASE + '/avatars/' + user_id + '/' + avatar + '.jpg?size=32';
    }

    randomInt(low, high) {
        return Math.floor(Math.random() * (high - low) + low)
    }

    sendChatMessage(channel_id, content) {

        let urlBase = 'https://discord.com/api/v8';
        let urlGateway = urlBase;
        
        let _httpSession = new Soup.Session();
        Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

        let params = {
            'channel_id': channel_id,
            'content': content,
            'tts': 'false',
            'nonce': '' + this.randomInt(1, 2**64) + ''
        };

        let message = Soup.form_request_new_from_hash('POST', urlGateway + '/channels/' + channel_id + '/messages', params);
        message.request_headers.append("User-Agent", 'Gnome Discord extension');
        message.request_headers.append("X-Ratelimit-Precision", 'millisecond');
        message.request_headers.append("Authorization", this.token);

        let self = this;

        _httpSession.queue_message(message, Lang.bind(this,
            function (_httpSession, message) {
                
                if (message.status_code !== 200)
                    return;

                let json = JSON.parse(message.response_body.data);
            }));
    }
    
    checkInternetAvailable() {
        let [res, out] = GLib.spawn_sync(null, ['/bin/bash', `${Me.path}/ping.sh`], null, GLib.SpawnFlags.SEARCH_PATH, null);

        if(out != null) {
            if (out instanceof Uint8Array) {
                out = ByteArray.toString(out).split('\n');
            } else {
                out = out.toString().split('\n');
            }

            if (out.length > 0) {
                out = out[0];
            }
            
            if (out == "0") {
                return true;
            }
        }

        return false;
    }

    _disconnect() {
        if (this.isConnected) {
            if (this.connection) {
                this.connection.close(Soup.WebsocketCloseCode.NORMAL, "Bye!");
            }
        }
    }

    _connect() {

        if (this.checkInternetAvailable() && this.token) {
            
            let urlBase = 'https://discord.com/api/v8';
            let urlGateway = urlBase + '/gateway';
                    
            let _httpSession = new Soup.Session();
            Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

            let params = {};

            let message = Soup.form_request_new_from_hash('GET', urlGateway, params);
            message.request_headers.append("User-Agent", 'Gnome Discord extension');
            message.request_headers.append("X-Ratelimit-Precision", 'millisecond');
            message.request_headers.append("Authorization", this.token);

            let self = this;

            _httpSession.queue_message(message, Lang.bind(this,
                function (_httpSession, message) {
                    if (message.status_code !== 200)
                        return;

                    let json = JSON.parse(message.response_body.data);
                    let wsUrl = json.url;

                    let session = new Soup.Session();
                    Soup.Session.prototype.add_feature.call(session, new Soup.ProxyResolverDefault());
                    session.httpsAliases = ['wss'];
                    
                    //let logger = Soup.Logger.new(Soup.LoggerLogLevel.BODY, -1);
                    //logger.attach(session);
                    //logger.set_printer(function(logger, level, direction, data) { print(data); });

                    message = new Soup.Message({
                        method: 'GET',
                        uri: new Soup.URI(wsUrl)
                    });

                    print('Connecting...');
                    session.websocket_connect_async(message, null, null, null, (session, res) => self.connect_callback(session, res));               
                })
            );
        } else {
            Mainloop.timeout_add(10000, () => {
                this._connect();
                return false;

            });
        }

    }    
}

Signals.addSignalMethods(DiscordWebSocket.prototype);