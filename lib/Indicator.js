const { GObject, GLib, Gio} = imports.gi;

const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const BoxPointer = imports.ui.boxpointer;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

// My imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();    

const Utils = Me.imports.lib.utils;

var Indicator = GObject.registerClass(

    class Indicator extends PanelMenu.Button {
    _init(parentCls) {
        super._init(0.0, _('Discord'));

        this.parentCls = parentCls;

        this.box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        
        this.iconFileOnline = Gio.icon_new_for_string(`${Me.path}/media/discord_online.svg`);
        this.iconFileOffline = Gio.icon_new_for_string(`${Me.path}/media/discord_offline.svg`);
        this.iconFileOnlineNotification = Gio.icon_new_for_string(`${Me.path}/media/discord_online_new.svg`);
        this.iconFileOfflineNotification = Gio.icon_new_for_string(`${Me.path}/media/discord_offline_new.svg`);
        this.icon = new St.Icon({ gicon: this.iconFileOffline, style_class: 'system-status-icon'});
        
        this.box.set_reactive(true);
        
        this.box.add_child(this.icon);
        this.add_child(this.box);

        let bin = new St.BoxLayout({ vertical: true }); 
        bin._delegate = this;
        this.menu.box.add_child(bin);

        this.chatbox = new St.BoxLayout({ vertical: true, style_class: 'chatbox' });

        this.scrollView = new St.ScrollView({ overlay_scrollbars: true, width: 600, height: 600, 
            x_expand: false, y_expand: false });

        this.scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.scrollView.add_actor(this.chatbox);
        
        bin.add_actor(this.scrollView);

        let inputBox = new St.BoxLayout({vertical: false, x_expand: true, style_class: 'send_area'});

        this.chatTarget = new St.Entry({text: '', hint_text: '#channel', width: 100});
        
        this._menuManager = new PopupMenu.PopupMenuManager(this);

        this.channelSuggestion = new PopupMenu.PopupMenu(this.chatTarget, 0, St.Side.BOTTOM);
        this.channelSuggestion._setParent(null);
        
        this._menuManager.addMenu(this.channelSuggestion);
        Main.uiGroup.add_actor(this.channelSuggestion.actor);
        
        this.channelSuggestion.actor.hide();
        
        let self = this;
        
        this.chatTarget.get_clutter_text().connect('text-changed', () => {

            let cnt = 0;
            self.channelSuggestion.removeAll();

            let channelDataArray = self.getChannelsForCompletion(self.chatTarget.get_text().replace("#", ""));
            
            for (let n = 0; n < channelDataArray.length; n++) {
                let channelData = channelDataArray[n];

                if (channelData.icon) {
                    Utils.loadIcon(
                        channelData.icon, 
                        'https://cdn.discordapp.com/icons/' + channelData.guild_id + '/' + channelData.icon + '.png?size=32', 
                        (gicon) => {
                            
                            // Add item and press handler
                            self.channelSuggestion.addAction(
                                channelData.name,
                                () => {
                                    self.chatInput.grab_key_focus();
                                    self.chatTarget.set_text(channelData.name);
                                    self.parentCls.targetChannelId = channelData.channel_id;
                                    self.guild.show();
                                    self.guild.set_gicon(gicon);
                                    self.channelSuggestion.close(BoxPointer.PopupAnimation.FULL)
                                },
                                gicon
                            );
                        }
                    );
                } else {
                    self.channelSuggestion.addAction(
                        channelData.name,
                        () => {
                            self.chatInput.grab_key_focus();
                            self.chatTarget.set_text(channelData.name);
                            self.parentCls.targetChannelId = channelData.channel_id;
                            self.guild.hide();
                            self.channelSuggestion.close(BoxPointer.PopupAnimation.FULL)
                        },
                        null
                    );                
                }

                if (cnt++ > 20) break;
            }
            
            self.channelSuggestion.open(BoxPointer.PopupAnimation.FULL)
        });

        this.chatInput = new St.Entry({ text: '', hint_text: 'Message', width: 370, style_class: 'chat_input'});

        this.chatInput.get_clutter_text().connect('key-press-event', (widget, event, user_data) => {
            
                let keysym = event.get_key_symbol();

                if (keysym == Clutter.KEY_Return) {
                    self.chatSend.emit('clicked', self.chatSend);
                }

        });

        this.chatSend = new St.Button({label: 'Send', width: 50, style_class: 'send-btn'});
        
        this.chatSend.connect("clicked", () => {
            if (self.parentCls.targetChannelId) {
                self.parentCls.webSocket.sendChatMessage(self.parentCls.targetChannelId, self.chatInput.get_text());
                self.chatInput.set_text('');
            }
        });

        this.guildContainer = new St.Widget({style_class: 'guild-container'});
        this.guild = new St.Icon({style_class: 'guild'});
        this.guild.set_size(32, 32);
        this.guildContainer.add_child(this.guild);
        
        inputBox.add_child(this.guildContainer);
        inputBox.add_child(this.chatTarget);
        inputBox.add_child(this.chatInput);
        inputBox.add_child(this.chatSend);
        bin.add_actor(inputBox);
    }

    getChannelsForCompletion(filter) {
        
        let ret = [];

        for (const [keyGuild, valueGuild] of Object.entries(this.parentCls.webSocket.guilds)) {
            for (const [keyChannel, valueChannel] of Object.entries(valueGuild.channels)) {
                
                if (valueChannel.name.toLowerCase().indexOf(filter.toLowerCase()) != -1) {
                    ret.push({
                        guild_id: valueGuild.id,
                        icon: valueGuild.icon,
                        channel_id: valueChannel.id,
                        name: "#" + valueChannel.name
                    });
                }
            }
        }

        return ret;
    }
});