package com.yggdrasil.svartalfheim.models;

import java.io.Serializable;

/**
 * Guild Badge Model
 * 
 * Represents a serializable guild badge that can be stored in cookies.
 * 
 * VULNERABILITY: This class is serializable and will be deserialized
 * from untrusted cookie data without proper validation.
 */
public class GuildBadge implements Serializable {
    
    private static final long serialVersionUID = 1L;
    
    private String guildName;
    private String rank;
    private int level;
    private String message;
    private boolean isAdmin;
    
    public GuildBadge() {
        this.guildName = "Novice Guild";
        this.rank = "Apprentice";
        this.level = 1;
        this.message = "Welcome to the forge!";
        this.isAdmin = false;
    }
    
    public GuildBadge(String guildName, String rank, int level) {
        this.guildName = guildName;
        this.rank = rank;
        this.level = level;
        this.message = "Member of " + guildName;
        this.isAdmin = false;
    }
    
    // Getters and Setters
    
    public String getGuildName() {
        return guildName;
    }
    
    public void setGuildName(String guildName) {
        this.guildName = guildName;
    }
    
    public String getRank() {
        return rank;
    }
    
    public void setRank(String rank) {
        this.rank = rank;
    }
    
    public int getLevel() {
        return level;
    }
    
    public void setLevel(int level) {
        this.level = level;
    }
    
    public String getMessage() {
        return message;
    }
    
    public void setMessage(String message) {
        this.message = message;
    }
    
    public boolean isAdmin() {
        return isAdmin;
    }
    
    public void setAdmin(boolean admin) {
        isAdmin = admin;
    }
    
    @Override
    public String toString() {
        return "GuildBadge{" +
                "guildName='" + guildName + '\'' +
                ", rank='" + rank + '\'' +
                ", level=" + level +
                ", message='" + message + '\'' +
                ", isAdmin=" + isAdmin +
                '}';
    }
}
