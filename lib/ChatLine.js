const { GObject, GLib, Gio} = imports.gi;

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const BoxPointer = imports.ui.boxpointer;

// My imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();    

const Utils = Me.imports.lib.utils;
const FlowLayout = Me.imports.lib.FlowLayout;

var ChatLine = GObject.registerClass(
    class ChatLine extends St.BoxLayout {
    _init(user_id, avatar, username, text, jsonObj, guildObj, channelObj, indicator) {
        
        super._init({style_class: 'chatline', vertical: false});

        let self = this;
        
        this.set_reactive(true);
        this.set_track_hover(true);

        // prepare avatar and image
        let avatarContainer = new St.Widget({style_class: 'avatar-container'});
        this.avatar = new St.Icon({style_class: 'avatar'});
        this.avatar.set_size(32, 32);
        avatarContainer.add_child(this.avatar);
        this.add_child(avatarContainer);
        let fakeColor = "ffffff";

        if (avatar) {
            fakeColor = Utils.safeColorHex(avatar);
            Utils.loadIcon(avatar, 'https://cdn.discordapp.com/avatars/' + user_id + '/' + avatar + '.png?size=32', (gicon) => {
                self.avatar.set_gicon(gicon);
            });
        }

        // guild image
        let guildContainer = new St.Widget({style_class: 'guild-container'});
        this.guild = new St.Icon({style_class: 'guild'});
        this.guild.set_size(32, 32);
        guildContainer.add_child(this.guild);
        
        Utils.loadIcon(guildObj.icon, 'https://cdn.discordapp.com/icons/' + guildObj.id + '/' + guildObj.icon + '.png?size=32', (gicon) => {
            self.guild.set_gicon(gicon);
        });
        
        let col2 = new St.BoxLayout({vertical: true, x_expand: true, style_class: 'col2'});
        let col2_row1 = new St.BoxLayout({vertical: false, y_expand: true, y_align: Clutter.ActorAlign.END, style_class: 'col2_row1'});
        
        // username
       
        col2_row1.add_child(new St.Label({text: username, style_class: 'username', style: 'color: #' + fakeColor + ';', y_expand: true, y_align: Clutter.ActorAlign.CENTER }));

        let defaultColor = St.ThemeContext.get_for_stage(global.stage).get_root_node().get_color("color");
        let pixelColor = defaultColor.to_pixel();
        let r = pixelColor&0xff0000 >> 16;
        let g = pixelColor&0xff00 >> 8;
        let b = pixelColor&0xff;
        
        let newColor = 'rgba(' + r +',' + g +',' + b +', 0.6)';


        let suffix = new St.Label({
            text: '#' + (channelObj ? channelObj.name : 'unknown'), 
            style_class: 'suffix', 
            y_expand: true, y_align: Clutter.ActorAlign.CENTER,
            style: 'color: ' + newColor + ';',
            reactive: true
        });

        this.connect("button-press-event", () => {
            if (channelObj) {
                indicator.targetChannelId = channelObj.id;
                indicator.chatTarget.set_text("#" + channelObj.name);
                Utils.loadIcon(guildObj.icon, 'https://cdn.discordapp.com/icons/' + guildObj.id + '/' + guildObj.icon + '.png?size=32', (gicon) => {
                    indicator.guild.set_gicon(gicon);
                });
            }
            indicator.channelSuggestion.close(BoxPointer.PopupAnimation.FULL)
        });
        
        col2_row1.add_child(suffix);
        col2.add_child(col2_row1);
       
        
        // content
        let textTokens = Utils.tokenizeChatText(text);

        let mentionIndex = 0;

        let col2_row2 = new FlowLayout.FlowLayout({style_class: 'content_box'});
        col2.add_child(col2_row2);

        let hasUnknownCommand = false;

        for (let t = 0; t < textTokens.length; t++) {
            
            if (textTokens[t].linebreak) {
                col2_row2 = new FlowLayout.FlowLayout({style_class: 'content_box'});
                col2.add_child(col2_row2);

                
            } else if (textTokens[t].command) {

                if (textTokens[t].text[0] == '@' && jsonObj.mentions) {
                    
                    // It's a mention command
                    // let mentionId = textTokens[t].text.substr(1, textTokens[t].text.length);
                
                    let mention = jsonObj.mentions[mentionIndex++];
                    let fakeColor = "ffffff";

                    if (mention.avatar) {
                        fakeColor = Utils.safeColorHex(mention.avatar);
                    }

                    col2_row2.add_child(new St.Label({
                        text: '@' + mention.username, 
                        style_class: 'mention', 
                        style: 'color: #' + fakeColor + ';'}));
                } else if (textTokens[t].text[0] == ':') {

                    // It's a emoji command
                    let emojiData = textTokens[t].text.split(":");
                    let emoji_id = emojiData[2];
                    let emoji = new St.Icon({style_class: 'emoji', width: 32, height: 32});
                    col2_row2.add_child(emoji);
                    Utils.loadIcon(emoji_id, 'https://cdn.discordapp.com/emojis/' + emoji_id + '.png?v=1', (gicon) => {
                        emoji.set_gicon(gicon);
                    });

                    
                }
                
            } else {
                if (textTokens[t].command)
                    hasUnknownCommand = true;
                col2_row2.add_child(new St.Label({text: textTokens[t].text, style_class: textTokens[t].command ? 'unknown_command' : 'text'}));
            }

        }

        // Handle embeds
        if (jsonObj.embeds && jsonObj.embeds.length > 0) {
            for (let i = 0; i < jsonObj.embeds.length; i++) {
                const embed = jsonObj.embeds[i];

                if (embed.thumbnail) {
                    col2_row2 = new FlowLayout.FlowLayout({style_class: 'content_box'});
                    col2.add_child(col2_row2);

                    let imageContainer = new St.Widget({style_class: 'image'});
                    let size = Utils.limitSize(embed.thumbnail.width,embed.thumbnail.height, null, 200);
                    imageContainer.set_size(size[0], size[1]);
                    col2_row2.add_child(imageContainer);

                    Utils.loadImage(embed.thumbnail.proxy_url, (image) => {                           
                        imageContainer.set_content(image);
                    });                    
                }
                
            }
        }

        // Handle attachments
        if (jsonObj.attachments && jsonObj.attachments.length > 0) {
            for (let i = 0; i < jsonObj.attachments.length; i++) {
                const attachments = jsonObj.attachments[i];
                // Todo: Images, Videos
            }
        }

        this.add_child(col2);

        this.add_child(guildContainer);
    }
});