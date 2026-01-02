package com.yggdrasil.svartalfheim.controllers;

import com.yggdrasil.svartalfheim.models.GuildBadge;
import com.yggdrasil.svartalfheim.services.BadgeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;

/**
 * Badge API Controller
 * 
 * OWASP A08:2025 - Software and Data Integrity Failures
 * 
 * REST API for badge creation, export, and import
 * VULNERABLE: Import endpoint accepts crafted badges with elevated privileges
 */
@RestController
@RequestMapping("/api")
public class BadgeApiController {

    @Autowired
    private BadgeService badgeService;

    /**
     * GET /api/badge
     * 
     * Get current badge information
     */
    @GetMapping("/badge")
    public ResponseEntity<Map<String, Object>> getBadge(HttpServletRequest request) {
        Map<String, Object> response = new HashMap<>();
        
        GuildBadge badge = getBadgeFromRequest(request);
        
        if (badge == null) {
            badge = badgeService.createDefaultBadge();
        }
        
        response.put("success", true);
        response.put("badge", Map.of(
            "guildName", badge.getGuildName(),
            "rank", badge.getRank(),
            "level", badge.getLevel(),
            "message", badge.getMessage(),
            "isAdmin", badge.isAdmin()
        ));
        
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/badge/create
     * 
     * Create a new badge
     * Note: Always creates with isAdmin=false (server-side)
     */
    @PostMapping("/badge/create")
    public ResponseEntity<Map<String, Object>> createBadge(
            @RequestBody Map<String, Object> payload,
            HttpServletResponse httpResponse) {
        Map<String, Object> response = new HashMap<>();
        
        String guildName = (String) payload.getOrDefault("guildName", "Apprentice Guild");
        String rank = (String) payload.getOrDefault("rank", "Novice");
        int level = payload.containsKey("level") ? ((Number) payload.get("level")).intValue() : 1;
        
        GuildBadge badge = badgeService.createCustomBadge(guildName, rank, level);
        
        try {
            String serialized = badgeService.serializeBadge(badge);
            
            // Set cookie
            Cookie cookie = new Cookie("guildBadge", serialized);
            cookie.setPath("/");
            cookie.setMaxAge(86400); // 24 hours
            httpResponse.addCookie(cookie);
            
            response.put("success", true);
            response.put("message", "Badge created successfully");
            response.put("badge", Map.of(
                "guildName", badge.getGuildName(),
                "rank", badge.getRank(),
                "level", badge.getLevel(),
                "isAdmin", badge.isAdmin()
            ));
            response.put("serialized", serialized);
            response.put("hint", "Use /api/badge/export to get your badge data");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", "Failed to create badge: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * GET /api/badge/export
     * 
     * Export current badge as Base64 serialized data
     * Allows users to backup and inspect badge structure
     */
    @GetMapping("/badge/export")
    public ResponseEntity<Map<String, Object>> exportBadge(HttpServletRequest request) {
        Map<String, Object> response = new HashMap<>();
        
        GuildBadge badge = getBadgeFromRequest(request);
        
        if (badge == null) {
            badge = badgeService.createDefaultBadge();
        }
        
        try {
            String serialized = badgeService.serializeBadge(badge);
            
            response.put("success", true);
            response.put("badge", serialized);
            response.put("badgeInfo", Map.of(
                "guildName", badge.getGuildName(),
                "rank", badge.getRank(),
                "level", badge.getLevel(),
                "isAdmin", badge.isAdmin()
            ));
            response.put("hint", "This is your serialized badge. You can modify and import it back.");
            response.put("warning", "Modifying serialized data can be dangerous in production systems.");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", "Failed to export badge: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * POST /api/badge/import
     * 
     * VULNERABLE: Import badge from Base64 serialized data
     * Sets the imported badge as guildBadge cookie
     * 
     * VULNERABILITY: No integrity check on deserialized data
     * EXPLOIT: Import crafted badge with isAdmin=true to gain privileges
     * 
     * EXPLOIT PATH:
     * 1. Export your current badge via GET /api/badge/export
     * 2. Use Java to deserialize, modify isAdmin=true, re-serialize
     * 3. Import modified badge via POST /api/badge/import
     * 4. Access /api/master-console with admin privileges
     */
    @PostMapping("/badge/import")
    public ResponseEntity<Map<String, Object>> importBadge(
            @RequestBody Map<String, String> payload,
            HttpServletResponse httpResponse) {
        Map<String, Object> response = new HashMap<>();
        
        String badgeData = payload.get("badge");
        
        if (badgeData == null || badgeData.trim().isEmpty()) {
            response.put("success", false);
            response.put("error", "Badge data is required");
            return ResponseEntity.badRequest().body(response);
        }
        
        try {
            // VULNERABLE: Deserialize untrusted badge data without validation
            GuildBadge badge = badgeService.deserializeBadge(badgeData);
            
            // Set as cookie
            Cookie cookie = new Cookie("guildBadge", badgeData);
            cookie.setPath("/");
            cookie.setMaxAge(86400); // 24 hours
            httpResponse.addCookie(cookie);
            
            response.put("success", true);
            response.put("message", "Badge imported successfully");
            response.put("badge", Map.of(
                "guildName", badge.getGuildName(),
                "rank", badge.getRank(),
                "level", badge.getLevel(),
                "isAdmin", badge.isAdmin()
            ));
            
            if (badge.isAdmin()) {
                response.put("adminDetected", true);
                response.put("hint", "Admin badge imported! Try accessing /api/master-console");
            }
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", "Failed to import badge: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * Helper: Extract badge from request cookies
     */
    private GuildBadge getBadgeFromRequest(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if ("guildBadge".equals(cookie.getName())) {
                try {
                    return badgeService.deserializeBadge(cookie.getValue());
                } catch (Exception e) {
                    return null;
                }
            }
        }

        return null;
    }
}
