const GETTEXT_DOMAIN = 'my-indicator-extension';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const { GObject, GLib, Gio} = imports.gi;

const BoxPointer = imports.ui.boxpointer;
const Main = imports.ui.main;

// My imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();    

const Utils = Me.imports.lib.utils;
const Indicator = Me.imports.lib.Indicator;
const DiscordWebSocket = Me.imports.lib.discordWebSocket;

var Discord = GObject.registerClass({
    Properties: {
        'uuid': GObject.ParamSpec.string(
            'uuid', 'uuid', 'uuid',
            GObject.ParamFlags.READWRITE |
            GObject.ParamFlags.CONSTRUCT,
            null)
    },
}, class Discord extends GObject.Object {
   
    destroy() {
        this._isDestroyed = true;
        this._disconnect();
        this.indicator.destroy();
    }

    _init(params = {}) {

        super._init(params);

        let self = this;

        this.hasNewMessages = false;
        
        this._signalsHandler = new Utils.GlobalSignalsHandler();
        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
        
        let gschema = Gio.SettingsSchemaSource.new_from_directory(
            Me.dir.get_child('schemas').get_path(),
            Gio.SettingsSchemaSource.get_default(),
            false
        );

        this.settings = new Gio.Settings({
            settings_schema: gschema.lookup('org.gnome.shell.extensions.excord', true)
        });

        this._config = {
            token: this.settings.get_string('token'),
            showOnMessage: this.settings.get_boolean('show-on-message'),
            soundOnMessage: this.settings.get_boolean('sound-on-message')
        };

        this._signalsHandler.add(
            [this.settings, 'changed::connect-helper', () => {
                self._config.token = self.settings.get_string('token');
                this.webSocket.setToken(this._config.token);
                self._connect();
                
            }],
            [this.settings, 'changed::show-on-message', () => self._config.showOnMessage = self.settings.get_boolean('show-on-message')],
            [this.settings, 'changed::sound-on-message', () => self._config.soundOnMessage = self.settings.get_boolean('sound-on-message')]
        );

        // More init
        this.webSocket = new DiscordWebSocket.DiscordWebSocket();
        this.webSocket.setToken(this._config.token);
        
        this.webSocket.connect('connected', this.onConnected.bind(this));
        this.webSocket.connect('ready', this.onReady.bind(this));
        this.webSocket.connect('closed', this.onClosed.bind(this));
        this.webSocket.connect('new-message', this.onNewMessage.bind(this));      

        this.indicator = new Indicator.Indicator(this);

        this.indicator.box.connect('button-press-event', () => {
            this.hasNewMessages = false;
            this.updateIndicatorIcon();
        });

        
        // move to indicator?
        Main.panel.addToStatusArea(this._uuid, this.indicator);

        this._connect();
    }

    onConnected(sourceObj) {
        this.updateIndicatorIcon();
    }

    onReady(sourceObj) {

    }

    onNewMessage(sourceObj, d) {

        const guild = this.webSocket.guilds[ d.guild_id ];
        
        let guildObj = {name: 'Unknown', id: 0, icon: ''};
        let channelObj = {name: 'Unknown', id: 0};
        
        if (guild) {
            guildObj.name = guild.name;
            guildObj.id = guild.id;
            guildObj.icon = guild.icon;
            channelObj = guild.channels[ d.channel_id ];
        }
        
        if (!this.indicator.isPanelOpen) {
            this.hasNewMessages = true;
            this.updateIndicatorIcon();

            if (this._config.soundOnMessage) {
                let time = parseInt((new Date().getTime()) /1000);
                if (!this.lastSound || time - this.lastSound > 10) {
                    let file = Gio.file_new_for_uri(`file://${Me.path}/media/message1.ogg`);
                    let player = global.display.get_sound_player();
                    player.play_from_file(file, '', null);                
                    this.lastSound = time;
                }
            }
        }

        if (this._config.showOnMessage) {
                this.indicator.showPanel(true);
        }

        // TODO: Make configurable
        if (d.author && d.author.bot) {
            return
        }
         
        this.indicator.addChatLine(d.author.id, 
            d.author.avatar, 
            d.author.username, 
            d.content, d,
            guildObj, channelObj
        );
        
    }

    onClosed(sourceObj) {
        this.updateIndicatorIcon();

        if (!this._isDestroyed) {
            this._connect();
        } 
    }

    updateIndicatorIcon() {

        if (!this.indicator)
            return;
        
        if (this.webSocket && this.webSocket.isConnected) {
            if (this.hasNewMessages)
                this.indicator.icon.set_gicon(this.indicator.iconFileOnlineNotification);
            else
                this.indicator.icon.set_gicon(this.indicator.iconFileOnline);
        } else {
            if (this.hasNewMessages)
                this.indicator.icon.set_gicon(this.indicator.iconFileOfflineNotification);
            else
                this.indicator.icon.set_gicon(this.indicator.iconFileOffline);
        }
    }

    _connect() {
        this._disconnect();
        this.webSocket._connect();
    }

    _disconnect() {
        this.webSocket._disconnect();
    }

});