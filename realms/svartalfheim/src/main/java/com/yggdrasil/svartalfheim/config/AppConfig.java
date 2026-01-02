package com.yggdrasil.svartalfheim.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Application Configuration
 * 
 * Centralizes configuration management using Spring's @Value injection.
 */
@Configuration
public class AppConfig {

    @Value("${app.flag}")
    private String flag;

    @Value("${app.realm.name}")
    private String realmName;

    @Value("${server.port}")
    private int port;

    public String getFlag() {
        return flag;
    }

    public String getRealmName() {
        return realmName;
    }

    public int getPort() {
        return port;
    }
}
