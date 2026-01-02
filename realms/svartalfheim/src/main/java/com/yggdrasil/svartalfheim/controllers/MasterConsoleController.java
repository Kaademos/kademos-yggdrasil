package com.yggdrasil.svartalfheim.controllers;

import com.yggdrasil.svartalfheim.config.AppConfig;
import com.yggdrasil.svartalfheim.models.GuildBadge;
import com.yggdrasil.svartalfheim.services.BadgeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

/**
 * Master Console Controller 
 * 
 * 
 * 
 * 
 */
@RestController
@RequestMapping("/api")
public class MasterConsoleController {

    @Autowired
    private AppConfig config;

    @Autowired
    private BadgeService badgeService;

    /**
     * GET /api/master-console
     * 
     * 
     * 
     * FLAG HERE: Returned when accessed with admin badge
     */
    @GetMapping("/master-console")
    public ResponseEntity<Map<String, Object>> getMasterConsole(HttpServletRequest request) {
        Map<String, Object> response = new HashMap<>();
        
        // Get badge from cookie
        GuildBadge badge = getBadgeFromRequest(request);
        
        if (badge == null) {
            response.put("success", false);
            response.put("error", "No guild badge found");
            response.put("hint", "Create a badge first at /api/badge/create");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }

        //
        if (!badgeService.hasAdminPrivileges(badge)) {
            response.put("success", false);
            response.put("error", "Access Denied - Admin privileges required");
            response.put("hint", "Only Master Forgers with admin badges can access this console");
            response.put("currentBadge", Map.of(
                "guildName", badge.getGuildName(),
                "rank", badge.getRank(),
                "level", badge.getLevel(),
                "isAdmin", badge.isAdmin()
            ));
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
        }

        // 
        response.put("success", true);
        response.put("message", "Welcome to the Master Forge Console");
        response.put("realm", "Svartalfheim");
        response.put("forgemaster", badge.getGuildName());
        response.put("rank", badge.getRank());
        
        // 
        response.put("flag", config.getFlag());
        
        response.put("consoleData", Map.of(
            "forgeTemperature", 2800,
            "activeContracts", 42,
            "masterSecret", "Deserialization without integrity checks allows privilege escalation",
            "vulnerability", "A08:2025 - Software and Data Integrity Failures",
            "exploitMethod", "Client-controlled isAdmin field in serialized badge"
        ));

        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/master-console/status
     * 
     * Check access status for current badge
     */
    @GetMapping("/master-console/status")
    public ResponseEntity<Map<String, Object>> getConsoleStatus(HttpServletRequest request) {
        Map<String, Object> response = new HashMap<>();
        
        GuildBadge badge = getBadgeFromRequest(request);
        
        if (badge == null) {
            response.put("hasAccess", false);
            response.put("reason", "No badge");
            return ResponseEntity.ok(response);
        }

        boolean hasAccess = badgeService.hasAdminPrivileges(badge);
        
        response.put("hasAccess", hasAccess);
        response.put("badge", Map.of(
            "guildName", badge.getGuildName(),
            "rank", badge.getRank(),
            "level", badge.getLevel(),
            "isAdmin", badge.isAdmin()
        ));
        
        if (!hasAccess) {
            response.put("reason", "Badge is not admin");
            response.put("hint", "You need a badge with isAdmin=true to access the Master Console");
        }

        return ResponseEntity.ok(response);
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
