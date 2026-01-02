package com.yggdrasil.svartalfheim.services;

import com.yggdrasil.svartalfheim.config.AppConfig;
import com.yggdrasil.svartalfheim.models.GuildBadge;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.util.Base64;

/**
 * Badge Service 
 * 
 * 
 * VULNERABLE: Insecure deserialization of untrusted data without integrity checks
 * EXPLOIT: Client can craft serialized badge with isAdmin=true to gain privileges
 */
@Service
public class BadgeService {
    
    @Autowired
    private AppConfig config;

    /**
     * Serialize a GuildBadge to Base64 string
     * Used for creating badge cookies
     */
    public String serializeBadge(GuildBadge badge) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ObjectOutputStream oos = new ObjectOutputStream(baos)) {
            
            oos.writeObject(badge);
            return Base64.getEncoder().encodeToString(baos.toByteArray());
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize badge", e);
        }
    }

    /**
     * VULNERABLE: Deserialize GuildBadge from Base64 string
     * 
     * VULNERABILITY: Deserialization without validation
     * - No integrity check (no HMAC or signature verification)
     * - No type allowlisting (accepts any Serializable object)
     * - Deserializes untrusted user input from cookies
     * - TRUSTS client-controlled isAdmin field without server-side validation
     * 
     * EXPLOIT PATH:
     * 1. Use /api/badge/create to understand badge structure
     * 2. Use /api/badge/export to get your badge as Base64
     * 3. Create custom badge with isAdmin=true (use Java or provided tool)
     * 4. Serialize and Base64 encode the crafted badge
     * 5. Set guildBadge cookie to the malicious payload
     * 6. Access /api/master-console with admin privileges
     * 
     * 
     */
    public GuildBadge deserializeBadge(String badgeData) {
        try {
            
            byte[] data = Base64.getDecoder().decode(badgeData);
            
            try (ByteArrayInputStream bais = new ByteArrayInputStream(data);
                 ObjectInputStream ois = new ObjectInputStream(bais)) {
                
                Object obj = ois.readObject();
                
                
                GuildBadge badge = (GuildBadge) obj;
                
                
                return badge;
                
            }
        } catch (ClassCastException e) {
            throw new RuntimeException("Invalid badge type", e);
        } catch (Exception e) {
            throw new RuntimeException("Failed to deserialize badge: " + e.getMessage(), e);
        }
    }

    /**
     * Create a default badge for new visitors
     * Always creates non-admin badge
     */
    public GuildBadge createDefaultBadge() {
        return new GuildBadge();
    }

    /**
     * Create a custom badge
     */
    public GuildBadge createCustomBadge(String guildName, String rank, int level) {
        return new GuildBadge(guildName, rank, level);
    }

    /**
     * 
     */
    public boolean isValidBadge(GuildBadge badge) {
        return badge != null && badge.getGuildName() != null;
    }

    /**
     * Check if badge has admin privileges
     * 
     */
    public boolean hasAdminPrivileges(GuildBadge badge) {
        return badge != null && badge.isAdmin();
    }
}
