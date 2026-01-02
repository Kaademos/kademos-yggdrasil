package com.yggdrasil.svartalfheim.controllers;

import com.yggdrasil.svartalfheim.config.AppConfig;
import com.yggdrasil.svartalfheim.models.GuildBadge;
import com.yggdrasil.svartalfheim.services.BadgeService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * Guild Controller
 * 
 * Handles guild badge management with insecure deserialization.
 */
@Controller
public class GuildController {

    @Autowired
    private BadgeService badgeService;

    @Autowired
    private AppConfig config;

    /**
     * Main landing page
     * 
     * VULNERABLE: Deserializes user-controlled cookie without validation
     */
    @GetMapping("/")
    public String index(
            @CookieValue(value = "guildBadge", required = false) String badgeCookie,
            Model model) {
        
        GuildBadge badge;
        
        if (badgeCookie != null && !badgeCookie.isEmpty()) {
            try {
                // VULNERABILITY: Deserialize untrusted cookie data
                badge = badgeService.deserializeBadge(badgeCookie);
            } catch (Exception e) {
                // On error, create default badge
                badge = badgeService.createDefaultBadge();
            }
        } else {
            // No cookie - create default badge
            badge = badgeService.createDefaultBadge();
        }
        
        model.addAttribute("badge", badge);
        model.addAttribute("realmName", config.getRealmName());
        
        return "index";
    }

    /**
     * Create/upgrade badge
     * 
     * Allows users to customize their badge (stored in cookie)
     */
    @PostMapping("/forge-badge")
    public String forgeBadge(
            @RequestParam(required = false, defaultValue = "Apprentice Guild") String guildName,
            @RequestParam(required = false, defaultValue = "Novice") String rank,
            @RequestParam(required = false, defaultValue = "1") int level,
            HttpServletResponse response,
            Model model) {
        
        try {
            GuildBadge badge = new GuildBadge(guildName, rank, level);
            
            // Serialize and set cookie
            String serialized = badgeService.serializeBadge(badge);
            
            Cookie cookie = new Cookie("guildBadge", serialized);
            cookie.setPath("/");
            cookie.setMaxAge(3600); // 1 hour
            response.addCookie(cookie);
            
            model.addAttribute("badge", badge);
            model.addAttribute("message", "Badge forged successfully!");
            model.addAttribute("realmName", config.getRealmName());
            
        } catch (Exception e) {
            model.addAttribute("error", "Failed to forge badge: " + e.getMessage());
        }
        
        return "index";
    }

    /**
     * Clear badge (remove cookie)
     */
    @PostMapping("/clear-badge")
    public String clearBadge(HttpServletResponse response) {
        Cookie cookie = new Cookie("guildBadge", "");
        cookie.setPath("/");
        cookie.setMaxAge(0); // Delete cookie
        response.addCookie(cookie);
        
        return "redirect:/";
    }
}
